const fs = require('fs');
const readline = require('readline');

const {validateAddress} = require('./src/utils');
const {generateReport} = require('./src/report');

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

if (require.main === module) {
    parseAddresses()
        .then(generateReport)
        .then((processedTxs) => writeToFile(processedTxs, 'kaspa-transactions.csv'));
}