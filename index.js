const express = require('express');
const expressValidator = require('express-validator');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const morgan = require('morgan');
var path = require('path');
const rfs = require('rotating-file-stream');

const app = express();
const cors = require('cors');
const mqttClient = require('./socket');
const firebaseConfig = require('./config/firebase_cloudstore');

dotenv.load();

const PORT = normalizePort(process.env.PORT || 8001);
/// //Process env load

// Morgan write log
const logDirectory = path.join(__dirname, 'log');
fs.existsSync(logDirectory) || fs.mkdirSync(logDirectory);
const accessLogStream = rfs('access.log', {
    interval: '1d', // rotate daily
    path: logDirectory,
});
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    next();
});
app.use(cors());
app.use(morgan('combined', { stream: accessLogStream }));
/// /////////////////////////////////////
app.set('port', PORT);
/// ///////////////////////
app.set('jwt_secret', process.env.JWTSECRET);
/// ///////////////////////
app.use(bodyParser.json());
app.use(bodyParser.json({ limit: '100mb' }));
app.use(
    bodyParser.urlencoded({
        limit: '100mb',
        extended: true,
        parameterLimit: 100000,
    })
);
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);
app.use(expressValidator());
app.get('/', (req, res) => {
    res.json('Assembly backend api');
});

require('./route/index')(app);
/// //////// Server configuration
function normalizePort(val) {
    const port = parseInt(val, 10);
    if (isNaN(port)) {
        return val;
    }
    if (port >= 0) {
        return port;
    }
    return false;
}

app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
    mqttClient.createClient();
});
