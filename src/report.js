const config = require('./config');

const {formatDate, validateAddress, sompiToKas} = require('./utils');
const fs = require('fs');

const axios = require('axios').create({
    baseURL: config.apiBase,
});

async function generateReport(addresses) {
    const txCache = {};
    const txs = await findAllTransactions(addresses, txCache);

    console.info('Generating report');
    console.info(txs);

    const suggestedAddresses = new Set();
    const additionalAddressesFound = [];
    const additionalTxToSearch = [];

    txs.forEach((tx) => {
        if (!tx.inputs) {
            tx.inputs = [];
        }
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
                return {transaction_id: inpoint.previous_outpoint_hash};
            }
            
            return txCache[inpoint.previous_outpoint_hash].outputs.find((o) => o.index == inpoint.previous_outpoint_index);
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
    for (let i = 0; i < txs.length; i += 10) {
        console.info(`Getting additional txs from idx ${i} to ${Math.min(i + 9, txs.length - 1)}`);
        const transactionIds = [];
        for (let j = i; j < i + 10 && j < txs.length; j++) {
            transactionIds.push(txs[j]);
        }

        const {data: transactionsResponse} = await axios.post(`transactions/search`, {
            transactionIds,
        });

        transactionsResponse.forEach((tx) => {
            txCache[tx.transaction_id] = tx;
        });
    }
}

async function getAddressTransactions(address, txCache) {
    let txs = [];

    const {data: txCountResponse} = await axios.get(`addresses/${address}/transactions-count`);
    
    const limit = 500;
    let lastFetchedOffsets = {};

    if (fs.existsSync('./address-last-fetched-offsets-cache.json')) {
        lastFetchedOffsets = JSON.parse(fs.readFileSync('./address-last-fetched-offsets-cache.json'));
    }

    let allAddressTxs = {};
    if (fs.existsSync('./address-tx-cache.json')) {
        allAddressTxs = JSON.parse(fs.readFileSync('./address-tx-cache.json')) || {};
        txs = allAddressTxs[address] || [];
    }

    allAddressTxs[address] = txs;

    let previousOffset = txCountResponse.total - 1;

    if (lastFetchedOffsets[address]) {
        const additionalPagesToQuery = Math.ceil((txCountResponse.total - lastFetchedOffsets[address].previousTotal) / limit);
        previousOffset = lastFetchedOffsets[address].offset + additionalPagesToQuery * limit;
        console.info(previousOffset, lastFetchedOffsets[address].offset, additionalPagesToQuery);
    } else {
        lastFetchedOffsets[address] = {};
    }

    lastFetchedOffsets[address].previousTotal = txCountResponse.total;
    lastFetchedOffsets[address].offset = previousOffset;

    console.info('Records to query: ', lastFetchedOffsets[address].previousTotal);
    for (let offset = previousOffset; offset >= 0; offset -= limit) {
        console.info(`Querying from ${Math.max(0, offset - limit + 1)} to ${Math.max(0, offset - limit + 1) + limit}`);
        const {data: pageTxs} = await axios.get(`addresses/${address}/full-transactions`, {
            params: {
                offset: Math.max(0, offset - limit + 1),
                limit,
            },
        });

        pageTxs.forEach((tx) => {
            txCache[tx.transaction_id] = tx;

            if (tx.is_accepted) {
                txs.push(tx);
            }
        });

        lastFetchedOffsets[address].offset = offset;

        // Save to cache after every iteration
        fs.writeFileSync('./address-last-fetched-offsets-cache.json', JSON.stringify(lastFetchedOffsets, null, 4));
        fs.writeFileSync('./address-tx-cache.json', JSON.stringify(allAddressTxs, null, 4));
    }

    return txs;
}

module.exports = {generateReport};
