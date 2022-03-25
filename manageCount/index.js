/// Routing assemble management
const R = require('ramda');
const utils = require('../utils/utils');
const models = require('../model/index');
const new_utils = require('../utils/new_utils');
const dbClient = require('../utils/dbClient');

const { TBLNAME } = process.env;
const PRI_KEY = 'TBLCOUNT';
const SORT_KEY = 'METADATA';
async function createTblCount(tbl_name, count = 1) {
    try {
        const createPayload = {
            table_count: count,
            table_name: PRI_KEY,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
        const createRes = await new_utils.createData(
            PRI_KEY,
            tbl_name,
            SORT_KEY,
            tbl_name,
            createPayload,
            models.count_tbl
        );
        if (createRes.data) {
            return true;
        }
        return false;
    } catch (error) {
        console.log('create tbl count error', tbl_name, error);
        return false;
    }
}

async function updateTblCount(tbl_name, tbl_count = 1) {
    try {
        await new_utils.increseCount(
            PRI_KEY,
            tbl_name,
            SORT_KEY,
            tbl_name,
            'table_count',
            tbl_count
        );
        return true;
    } catch (error) {
        console.log('update tbl count error', tbl_name, error);
        return false;
    }
}

async function getTblCount(tbl_name) {
    try {
        const getRes = await new_utils.getData(
            PRI_KEY,
            tbl_name,
            SORT_KEY,
            tbl_name
        );
        if (getRes.data) {
            return getRes.data.table_count;
        }
        return 0;
    } catch (error) {
        console.log('get tbl count error', tbl_name, error);
        return 0;
    }
}

module.exports = {
    createTblCount,
    updateTblCount,
    getTblCount,
};
