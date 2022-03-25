const R = require('ramda');
const pass_hash = require('password-hash');
const uidGenerator = require('node-unique-id-generator');
const phoneToken = require('generate-sms-verification-code');
const express = require('express');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const dbClient = require('../utils/dbClient');
const utils = require('../utils/utils');
const new_utils = require('../utils/new_utils');
const sendMail = require('../utils/email');
const models = require('../model/index');

const { TBLNAME } = process.env;
const USER_PRI_KEY = 'USER';
const USER_SORT_KEY = 'METADATA';
const CLUB_PRI_KEY = 'CLUB';
const CONNECT_SORT_KEY = 'CONNECT';
const USEREMAILINDEXNAME = 'email-index';
const INVERTEDINDEXNAME = 'inverted-index';
const TABLEINDEXNAME = 'table_name-index';

/// get user by user_id
async function getuser(user_id) {
    try {
        const getRes = await new_utils.getData(
            USER_PRI_KEY,
            user_id,
            USER_SORT_KEY,
            user_id
        );
        if (getRes.data) {
            return getRes.data;
        }
        return null;
    } catch (error) {
        return null;
    }
}

/// get all clubs
async function getallclubs() {
    try {
        const findparams = {
            TableName: TBLNAME,
            IndexName: TABLEINDEXNAME,
            KeyConditionExpression: 'table_name = :table_name',
            ExpressionAttributeValues: {
                ':table_name': CLUB_PRI_KEY,
            },
        };
        const resultFind = await dbClient.getItems(findparams);
        return resultFind.Items;
    } catch (error) {
        console.log(error);
        return [];
    }
}

/// get users by club id
async function getUsersByClubid(clubid) {
    let users = [];
    const tokens = [];
    try {
        const queryRes = await new_utils.queryData(
            CLUB_PRI_KEY,
            clubid,
            CONNECT_SORT_KEY
        );
        if (queryRes.data) {
            /// After queried, we need to get data with userIds
            if (queryRes.data && queryRes.data.length > 0) {
                const batchRes = await new_utils.batchConnectGetData(
                    USER_PRI_KEY,
                    USER_SORT_KEY,
                    queryRes.data,
                    false
                );
                users = batchRes.data;
            }
        }
    } catch (error) {
        console.log(error);
    }
    console.log(users);
    if (users.length > 0) {
        for (let i = 0; i < users.length; i++) {
            if (users[i].fcm_token != null && users[i].fcm_token != '') {
                tokens.push(users[i].fcm_token);
            }
        }
    }
    return tokens;
}

module.exports = {
    getuser,
    getallclubs,
    getUsersByClubid,
};
