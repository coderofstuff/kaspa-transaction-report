const config = require('./config');

const {formatDate, validateAddress, sompiToKas} = require('./utils');

const axios = require('axios').create({
    baseURL: config.apiBase,
});

async function generateReport(addresses) {
    const txCache = {};
    const txs = await findAllTransactions(addresses, txCache);

    console.info('Generating report');

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

        const compound = outpointedInputs.length && isAllMyOutput && tx.outputs.length === 1;
        const isSendToSelf = outpointedInputs.length && isAllMyOutput;

        return {
            timestamp: formatDate(new Date(tx.block_time)),
            sendAmount: isAllMyInput && !isAllMyOutput ? sompiToKas(sendAmount - receiveAmount - feeAmount) : 0,
            receiveAmount: !isSendToSelf && receiveAmount > sendAmount ? sompiToKas(receiveAmount - sendAmount) : 0,
            feeAmount: isAnyMyInput && tx.inputs.length ? sompiToKas(feeAmount) : 0,
            txHash: tx.transaction_id,
            compound,
            sendToSelf: isSendToSelf,
        };
    });

    return processedTxs;
}

async function findAllTransactions(addresses, txCache) {    
    let txs = [];

    for (const address of addresses) {
        if (validateAddress(address)) {
            console.info('Fetching transactions from:', address);

            const addressTxs = await getAddressTransactions(address, txCache);

            txs = txs.concat(addressTxs);

            await sleep(500);
        }
    }

    // Sort all the transactions in block_time order
    txs.sort((a, b) => a.block_time - b.block_time);

    return txs;
}

async function getAdditionalTransactions(txs, txCache) {
    // Process it in batches to not overload the rest api
    for (let offset = 0; offset < txs.length; offset += 500) {

        const transactionIds = [];

        for (let i = offset; i < offset + 500; i++) {
            // If we know about this tx, we'll skip it
            if (txCache[txs[i].transaction_id]) {
                continue;
            }

            transactionIds.push(txs[i]);
        }

        if (!transactionIds.length) {
            continue;
        }

        await sleep(1000);

        const {data: transactionsResponse} = await axios.post(`transactions/search`, {
            transactionIds,
        });

        transactionsResponse.forEach((tx) => {
            txCache[tx.transaction_id] = tx;
        });
    }
}

async function getAddressTransactions(address, txCache) {
    const txs = [];

    const {data: txCountResponse} = await axios.get(`addresses/${address}/transactions-count`);
    
    const limit = 500;

    for (let offset = 0; offset < txCountResponse.total; offset += limit) {
        await sleep(500);

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export {generateReport};
