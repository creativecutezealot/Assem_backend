const request = require('axios');
const http = require('http');

function sendResult(code, msg, response) {
    response.header('Access-Control-Allow-Origin', '*');
    response.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
    );
    response.status(code).json(msg);
}
async function generalRequest(url) {
    const res = await request.get(url);
    return res.data;
}
module.exports = {
    generalRequest,
    sendResult,
};
