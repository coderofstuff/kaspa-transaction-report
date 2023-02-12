const config = require('./config');

const fs = require('fs');
const readline = require('readline');

const axios = require('axios').create({
    baseURL: config.apiBase,
});

async function generateReport() {
    const addresses = await parseAddresses();
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

    // fs.writeFileSync('./mydatacache.json', JSON.stringify(txs, null, 2));
    // fs.writeFileSync('./txCache.json', JSON.stringify(txCache, null, 2));
    // const txs = require('./mydatacache.json');
    // const txCache = require('./txCache.json');

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

        const isAllMyOutput = !tx.outputs.some((outpoint) => addresses.indexOf(outpoint.script_public_key_address) == -1);
        const isAllMyInput = outpointedInputs.length && !outpointedInputs.some((outpoint) => addresses.indexOf(outpoint.script_public_key_address) == -1);
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



    writeToFile(processedTxs, 'kaspa-transactions.csv');
}

function sompiToKas(amount) {
    return amount / 100000000;
}

function writeToFile(txs, outputFile) {
    const writer = fs.createWriteStream(outputFile);

    writer.write('"Date","Sent Amount","Sent Currency","Received Amount","Received Currency","Fee Amount","Fee Currency","TxHash"\n');

    let prev = null;

    txs.forEach((tx) => {
        if (prev && prev.txHash == tx.txHash) {
            return;
        }

        if (!tx.compound && !tx.sendToSelf) {
            writer.write(`"${tx.timestamp}","${tx.sendAmount || ''}","${tx.sendAmount ? 'KAS' : ''}","${tx.receiveAmount || ''}","${tx.receiveAmount ? 'KAS' : ''}","${tx.sendAmount ? tx.feeAmount : ''}","${tx.sendAmount ? 'KAS' : ''}","${tx.txHash}"\n`);
        }

        prev = tx;
    });

    writer.end();
}

async function parseAddresses() {
    const addresses = [];

    const readStream = fs.createReadStream('./addresses.txt');

    const readLineInterface = readline.createInterface({
        input: readStream,
        crlfDelay: Infinity,
    });
    
    for await (const address of readLineInterface) {
        if (validateAddress(address)) {
            addresses.push(address);
        }
    }

    return addresses;
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

function formatDate(dt) {
    const dtStr = dt.toISOString();

    return dtStr.substring(0, 19).replace('T', ' ');
}

function validateAddress(address) {
    return /^kaspa\:[a-z0-9]{61}$/.test(address);
} 

if (require.main === module) {
    generateReport();
}