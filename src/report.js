const config = require('./config');

const {formatDate, validateAddress, sompiToKas} = require('./utils');

const axios = require('axios').create({
    baseURL: config.apiBase,
});

async function generateReport(addresses) {
    const txCache = {};
    const txs = await findAllTransactions(addresses, txCache);

    console.info('Generating report');

    const suggestedAddresses = new Set();
    const additionalAddressesFound = [];
    const additionalTxToSearch = [];

    txs.forEach((tx) => {
        tx.inputs.forEach((i) => {
            if (!txCache[i.previous_outpoint_hash]) {
                additionalTxToSearch.push(i.previous_outpoint_hash);
            }
        });
    });

    await getAdditionalTransactions(additionalTxToSearch, txCache);

    const processedTxs = txs.map((tx) => {
        const outpointedInputs = tx.inputs.map((inpoint) => {
            if (!txCache[inpoint.previous_outpoint_hash]) {
                // Transaction couldn't be found in outpoint, just reference it here
                return `tx:${inpoint.previous_outpoint_hash}`;
            }
            return txCache[inpoint.previous_outpoint_hash].outputs[inpoint.previous_outpoint_index];
        });

        const addOutpoint = (total, outpoint) => total + outpoint.amount;

        const addIfMyOutpoint = (total, outpoint) => {
            if (addresses.indexOf(outpoint.script_public_key_address) > -1) {
                return addOutpoint(total, outpoint);
            }

            return total;
        };

        const sendAmount = outpointedInputs.reduce(addIfMyOutpoint, 0);
        const receiveAmount = tx.outputs.reduce(addIfMyOutpoint, 0);

        const feeAmount = outpointedInputs.reduce(addOutpoint, 0) - tx.outputs.reduce(addOutpoint, 0);

        const isAllMyOutput = !tx.outputs.some((outpoint) => addresses.indexOf(outpoint.script_public_key_address) === -1);
        const isAllMyInput = outpointedInputs.length && !outpointedInputs.some((outpoint) => addresses.indexOf(outpoint.script_public_key_address) === -1);
        const isAnyMyInput = outpointedInputs.length && outpointedInputs.some((outpoint) => addresses.indexOf(outpoint.script_public_key_address) > -1);

        if (isAnyMyInput && !isAllMyInput) {
            // Might have some suggestions here:
            for (const outpoint of outpointedInputs) {
                if (addresses.indexOf(outpoint.script_public_key_address) === -1) {
                    // This is a possible suggestion:
                    suggestedAddresses.add(outpoint.script_public_key_address);
                }
            }
        }

        const compound = isAllMyInput && isAllMyOutput && tx.outputs.length === 1;
        const isSendToSelf = isAllMyInput && isAllMyOutput && outpointedInputs.length;

        const txResult = {
            timestamp: formatDate(new Date(tx.block_time)),
            txHash: tx.transaction_id,
            compound,
            sendToSelf: isSendToSelf,
        };

        if (compound || isSendToSelf) {
            txResult.sendAmount = sompiToKas(feeAmount);
            txResult.receiveAmount = 0;
            txResult.feeAmount = 0;
            txResult.description = compound ? 'Fee for Compound transaction' : 'Fee to send to own addresses';
            txResult.label = 'cost';
        } else {
            txResult.sendAmount = isAllMyInput && !isAllMyOutput ? sompiToKas(sendAmount - receiveAmount - feeAmount) : 0;
            txResult.receiveAmount = !isSendToSelf && receiveAmount > sendAmount ? sompiToKas(receiveAmount - sendAmount) : 0;
            txResult.feeAmount = isAnyMyInput && tx.inputs.length ? sompiToKas(feeAmount) : 0;
        }

        return txResult;
    });

    for (const suggestion of suggestedAddresses) {
        additionalAddressesFound.push(suggestion);
    }

    return [processedTxs, additionalAddressesFound];
}

async function findAllTransactions(addresses, txCache) {    
    let txs = [];

    for (const address of addresses) {
        if (validateAddress(address)) {
            console.info('Fetching transactions from:', address);

            const addressTxs = await getAddressTransactions(address, txCache);

            txs = txs.concat(addressTxs);
        }
    }

    // Sort all the transactions in block_time order
    txs.sort((a, b) => a.block_time - b.block_time);

    return txs;
}

async function getAdditionalTransactions(txs, txCache) {
    const {data: transactionsResponse} = await axios.post(`transactions/search`, {
        transactionIds: txs,
    });

    transactionsResponse.forEach((tx) => {
        txCache[tx.transaction_id] = tx;
    });
}

async function getAddressTransactions(address, txCache) {
    const txs = [];

    const {data: txCountResponse} = await axios.get(`addresses/${address}/transactions-count`);
    
    const limit = 500;

    for (let offset = 0; offset < txCountResponse.total; offset += limit) {
        const {data: pageTxs} = await axios.get(`addresses/${address}/full-transactions`, {
            params: {
                offset,
                limit,
            },
        });

        pageTxs.forEach((tx) => {
            txCache[tx.transaction_id] = tx;

            if (tx.is_accepted) {
                txs.push(tx);
            }
        });
    }

    return txs;
}

export {generateReport};
