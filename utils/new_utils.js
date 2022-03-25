const R = require('ramda');
const models = require('../model/index');
const utils = require('./utils');
const dbClient = require('./dbClient');

const { TBLNAME } = process.env;
const INVERTEDINDEXNAME = 'inverted-index';

async function getData(pri_prefix, pri_val, sort_prefix, sort_val) {
    try {
        console.log(
            'GET STARTED ==> ',
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        const keyModel = utils.createKeyModel(
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        const getParam = {
            TableName: TBLNAME,
            Key: keyModel,
        };
        const resultFind = await dbClient.getItem(getParam);
        console.log('Get RES ==>', resultFind);
        return { data: resultFind.Item, error: null };
    } catch (error) {
        console.log('Get ERROR ==>', error);
        return { data: null, error };
    }
}

async function createData(
    pri_prefix,
    pri_val,
    sort_prefix,
    sort_val,
    payload,
    model
) {
    try {
        console.log(
            'CRATE STARTED ==> ',
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        console.log('CRATE PAYLOAD ==> ', payload);
        const createPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
        };
        const keyModel = utils.createKeyModel(
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        const dataModel = utils.generateInitDataModel(createPayload, model);
        const createparam = {
            TableName: TBLNAME,
            Item: { ...keyModel, ...dataModel },
        };
        const resultCreate = await dbClient.putItem(createparam);
        console.log('CRATE RES ==>', resultCreate);
        return { data: { ...keyModel, ...dataModel }, error: null };
    } catch (error) {
        console.log('CRATE ERROR ==>', error);
        return { data: null, error };
    }
}

async function createConnectData(
    pri_prefix,
    pri_val,
    sort_prefix,
    sec_sort_prefix,
    sort_val,
    payload,
    model
) {
    try {
        console.log(
            'CRATE STARTED ==> ',
            pri_prefix,
            pri_val,
            sort_prefix,
            sec_sort_prefix,
            sort_val
        );
        console.log('CRATE PAYLOAD ==> ', payload);
        const createPayload = {
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...payload,
        };
        const keyModel = utils.createConnectKeyModel(
            pri_prefix,
            pri_val,
            sort_prefix,
            sec_sort_prefix,
            sort_val
        );
        const dataModel = utils.generateInitDataModel(createPayload, model);
        const createparam = {
            TableName: TBLNAME,
            Item: { ...keyModel, ...dataModel },
        };
        const resultCreate = await dbClient.putItem(createparam);
        console.log('CRATE RES ==>', resultCreate);
        return { data: { ...keyModel, ...dataModel }, error: null };
    } catch (error) {
        console.log('CRATE ERROR ==>', error);
        return { data: null, error };
    }
}

async function updateData(
    pri_prefix,
    pri_val,
    sort_prefix,
    sort_val,
    payload,
    model
) {
    try {
        console.log(
            'UPDATE STARTED ==> ',
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        console.log('UPDATE PAYLOAD ==> ', payload);
        const keyModel = utils.createKeyModel(
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        const { expression, arttributeValues } = utils.generateUpdateDataModel(
            payload,
            model
        );
        console.log(expression);
        const updateParam = {
            TableName: TBLNAME,
            Key: keyModel,
            UpdateExpression: expression,
            ExpressionAttributeValues: arttributeValues,
            ReturnValues: 'ALL_NEW',
        };
        const result = await dbClient.updateItem(updateParam);
        console.log('UPDATE RES ==>', result);
        return { data: result.Attributes, error: null };
    } catch (error) {
        console.log('UPDATE ERROR ==>', error);
        return { data: null, error };
    }
}

async function increseCount(
    pri_prefix,
    pri_val,
    sort_prefix,
    sort_val,
    update_key,
    count = 1
) {
    try {
        console.log(
            'INCREASE COUNT STARTED ==> ',
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        const keyModel = utils.createKeyModel(
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        const expression = `set ${update_key} = ${update_key} + :val`;
        let condition = `${update_key} >= :num`;
        if (count < 0) {
            condition = `${update_key} > :num`;
        }
        const updateParam = {
            TableName: TBLNAME,
            Key: keyModel,
            UpdateExpression: expression,
            ConditionExpression: condition,
            ExpressionAttributeValues: {
                ':val': count,
                ':num': 0,
            },
            ReturnValues: 'ALL_NEW',
        };
        const result = await dbClient.updateItem(updateParam);
        console.log('UPDATE RES ==>', result);
        return { data: result.Attributes, error: null };
    } catch (error) {
        console.log('INCREASE COUNT  ==>', error);
        return { data: null, error };
    }
}

async function queryData(pri_prefix, pri_val, sort_prefix) {
    try {
        console.log('QUERY STARTED ==> ', pri_prefix, pri_val, sort_prefix);
        const { arttributeValues, expression } =
            utils.generateConnectExpAndAttris(pri_prefix, pri_val, sort_prefix);
        const queryParam = {
            TableName: TBLNAME,
            KeyConditionExpression: expression,
            ExpressionAttributeValues: arttributeValues,
            ScanIndexForward: true,
        };
        const resultQuery = await dbClient.getItems(queryParam);
        console.log('QUERY RES ==>', resultQuery);
        return { data: resultQuery.Items, error: null };
    } catch (error) {
        console.log('QUERY ERROR ==>', error);
        return { data: null, error };
    }
}

async function queryInvertData(pri_prefix, sort_prefix, sort_val) {
    try {
        console.log(
            'QUERY INVERT STARTED ==> ',
            pri_prefix,
            sort_prefix,
            sort_val
        );
        const { arttributeValues, expression } =
            utils.generateOpssiteExpAndAttris(
                pri_prefix,
                sort_prefix,
                sort_val
            );
        const queryParam = {
            TableName: TBLNAME,
            IndexName: INVERTEDINDEXNAME,
            KeyConditionExpression: expression,
            ExpressionAttributeValues: arttributeValues,
            ScanIndexForward: true,
        };
        const resultQuery = await dbClient.getItems(queryParam);
        console.log('QUERY INVERT RES ==>', resultQuery);
        return { data: resultQuery.Items, error: null };
    } catch (error) {
        console.log('QUERY INVERT ERROR ==>', error);
        return { data: null, error };
    }
}

async function deleteData(pri_prefix, pri_val, sort_prefix, sort_val) {
    try {
        console.log(
            'DEL STARTED ==> ',
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        const keyModel = utils.createKeyModel(
            pri_prefix,
            pri_val,
            sort_prefix,
            sort_val
        );
        const delParam = {
            TableName: TBLNAME,
            Key: keyModel,
        };
        const resultDel = await dbClient.deleteItem(delParam);
        console.log('DEL RES ==>', resultDel);
        return { data: true, error: null };
    } catch (error) {
        console.log('DEL ERROR ==>', error);
        return { data: null, error };
    }
}
const batchGETParams = (TableName, resources) => {
    const params = { RequestItems: {} };
    params.RequestItems[TableName] = resources;
    return params;
};

async function batchConnectGetData(
    pri_prefix,
    sort_prefix,
    data,
    isInverted = false
) {
    try {
        const keyParams = { Keys: [] };
        const sortedData = R.sort((a, b) => {
            if (a.pri_key < b.pri_key) {
                return -1;
            }
            if (a.pri_key > b.pri_key) {
                return 1;
            }
            return 0;
        }, data);
        let dupicated_id = '';
        for (const idx in sortedData) {
            const obj = sortedData[idx];
            const id = isInverted
                ? R.last(R.split('#', obj.pri_key))
                : R.last(R.split('#', obj.sort_key));
            if (dupicated_id !== id) {
                const keyParam = {};
                keyParam.pri_key = `${pri_prefix}#${id}`;
                keyParam.sort_key = `#${sort_prefix}#${pri_prefix}#${id}`;
                keyParams.Keys.push(keyParam);
            }
            dupicated_id = id;
        }
        dupicated_id = '';
        const res = await dbClient.batchGetItem(
            batchGETParams(TBLNAME, keyParams)
        );
        if (res.Responses) {
            return { data: res.Responses[TBLNAME], error: null };
        }
        return { data: null, error: null };
    } catch (error) {
        return { data: null, error };
    }
}

async function batchUserGetData(data) {
    try {
        const keyParams = { Keys: [] };
        const sortedData = R.sort((a, b) => {
            if (a.user_id < b.user_id) {
                return -1;
            }
            if (a.user_id > b.user_id) {
                return 1;
            }
            return 0;
        }, data);
        let dupicated_id = '';
        for (const idx in data) {
            const id = sortedData[idx].user_id;
            if (id !== dupicated_id) {
                const keyParam = {};
                keyParam.pri_key = `USER#${id}`;
                keyParam.sort_key = `#METADATA#USER#${id}`;
                keyParams.Keys.push(keyParam);
            }
            dupicated_id = id;
        }
        dupicated_id = '';
        const res = await dbClient.batchGetItem(
            batchGETParams(TBLNAME, keyParams)
        );
        if (res.Responses) {
            return { data: res.Responses[TBLNAME], error: null };
        }
        return { data: null, error: null };
    } catch (error) {
        return { data: null, error };
    }
}
// Batch Write
const batchWrite = (TableName, resources) => {
    const params = { RequestItems: {} };
    params.RequestItems[TableName] = resources.map((res) => ({
        PutRequest: { Item: res },
    }));
    return dbClient.batchPutItems(params);
};
const batchWriteUnprocessedProject = (param) => {
    const params = { RequestItems: param };
    return dbClient.batchPutItems(params);
};

async function batchWriteData(data) {
    const writeDatas = R.splitEvery(10, data);
    for (let i = 0; i < writeDatas.length; i++) {
        const data = writeDatas[i];
        const res = await batchWrite(TBLNAME, data);
        await writeUnprocessedItems(res, TBLNAME);
    }
    return true;
}
async function writeUnprocessedItems(res, tableName) {
    if (res.UnprocessedItems[tableName]) {
        if (res.UnprocessedItems[tableName].length) {
            const res1 = await batchWriteUnprocessedProject(
                res.UnprocessedItems
            );
            await writeUnprocessedItems(res1, tableName);
        } else {
            return true;
        }
    } else {
        return true;
    }
}

module.exports = {
    getData,
    createData,
    createConnectData,
    updateData,
    queryData,
    queryInvertData,
    deleteData,
    batchConnectGetData,
    batchUserGetData,
    increseCount,
    batchWriteData,
};
