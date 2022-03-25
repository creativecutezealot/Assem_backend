/// Routing user management
const R = require('ramda');
const pass_hash = require('password-hash');
const uidGenerator = require('node-unique-id-generator');
const jwt = require('jsonwebtoken');
const dbClient = require('../utils/dbClient');
const utils = require('../utils/utils');
const new_utils = require('../utils/new_utils');
const notification = require('../utils/notificaion');
const sendMail = require('../utils/email');
const models = require('../model/index');

const { TBLNAME } = process.env;
const PRI_KEY = 'REFRERRAL';
const SORT_KEY = 'METADATA';
const TABLEINDEXNAME = 'table_name-index';
const USER_ID_INDEX = 'referral_user_id-index';
const CLUB_ID_INDEX = 'referral_club_id-index';

// create referral
async function createReferral(req, res) {
    req.assert('referral_email', 'Email is not valid').isEmail();
    req.assert('referral_email', 'Email cannot be blank').notEmpty();
    req.sanitize('referral_email').normalizeEmail({ gmail_remove_dots: false });
    req.assert('referral_name', 'Name cannot be blank').notEmpty();
    const errors = req.validationErrors();
    if (errors) {
        utils.sendResult(400, { status: false, data: errors[0].msg }, res);
        return;
    }
    try {
        const referral_id = uidGenerator.generateGUID();
        const createPayload = {
            ...req.body,
            referral_id,
            table_name: PRI_KEY,
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            referral_id,
            SORT_KEY,
            referral_id,
            createPayload,
            models.memberReferral
        );
        utils.sendResult(201, { status: true, data: createRes.data }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function getAllReferrals(req, res) {
    try {
        const findparams = {
            TableName: TBLNAME,
            IndexName: TABLEINDEXNAME,
            KeyConditionExpression: 'table_name = :table_name',
            ExpressionAttributeValues: {
                ':table_name': PRI_KEY,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        utils.sendResult(200, { status: true, data: resultFind.Items }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function deleteReferral(req, res) {
    try {
        const referral_id = req.params.id;
        const delRes = await new_utils.deleteData(
            PRI_KEY,
            referral_id,
            SORT_KEY,
            referral_id
        );
        utils.sendResult(200, { status: true, data: delRes.data }, res);
    } catch (error) {
        console.log(error);
        utils.sendResult(400, { status: false, data: error }, res);
    }
}

async function getRefferalsByUserId(req, res) {
    try {
        const { user_id } = req.params;
        const findparams = {
            TableName: TBLNAME,
            IndexName: USER_ID_INDEX,
            KeyConditionExpression: 'referral_user_id = :referral_user_id',
            ExpressionAttributeValues: {
                ':referral_user_id': user_id,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        utils.sendResult(200, { status: true, data: resultFind.Items }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

async function getRefferalsByClubId(req, res) {
    try {
        const { club_id } = req.params;
        const findparams = {
            TableName: TBLNAME,
            IndexName: CLUB_ID_INDEX,
            KeyConditionExpression: 'referral_club_id = :referral_club_id',
            ExpressionAttributeValues: {
                ':referral_club_id': club_id,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        utils.sendResult(200, { status: true, data: resultFind.Items }, res);
    } catch (error) {
        utils.sendResult(404, { status: false, data: error }, res);
    }
}

module.exports = {
    createReferral,
    getAllReferrals,
    deleteReferral,
    getRefferalsByClubId,
    getRefferalsByUserId,
};
