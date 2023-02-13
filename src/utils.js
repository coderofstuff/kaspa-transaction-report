const {format} = require('date-fns');

function formatDate(dt) {
    return format(dt, 'yyyy-MM-dd HH:mm:ss');
}

function validateAddress(address) {
    return /^kaspa\:[a-z0-9]{61}$/.test(address);
}

function sompiToKas(amount) {
    return amount / 100000000;
}

module.exports = {
    formatDate,
    validateAddress,
    sompiToKas,
};