const jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
const utils = require('./utils');

const adminString = 'admin';
const managerString = 'manager';

function verifyUserToken(req, res, next) {
    try {
        const token = req.headers['x-access-token'];
        if (!token) {
            utils.sendResult(
                401,
                { status: false, data: 'No token provided.' },
                res
            );
            return;
        }
        jwt.verify(token, 'SECRET', (err, decoded) => {
            if (err) {
                utils.sendResult(
                    401,
                    { status: false, data: 'Failed to authenticate token.' },
                    res
                );
            } else {
                req.body.userid = decoded.userid;
                next();
            }
        });
    } catch (error) {
        utils.sendResult(
            500,
            { status: false, data: 'Failed to authenticate token.' },
            res
        );
    }
}

function verifyAdminToken(req, res, next) {
    try {
        const token = req.headers['x-access-token'];
        if (!token) {
            utils.sendResult(
                401,
                { status: false, data: 'No token provided.' },
                res
            );
            return;
        }
        jwt.verify(token, 'SECRET', (err, decoded) => {
            if (err) {
                utils.sendResult(
                    401,
                    { status: false, data: 'Failed to authenticate token.' },
                    res
                );
            } else {
                req.body.userid = decoded.userid;
                next();
            }
        });
    } catch (error) {
        utils.sendResult(
            500,
            { status: false, data: 'Failed to authenticate token.' },
            res
        );
    }
}
module.exports = {
    verifyAdminToken,
    verifyUserToken,
};
