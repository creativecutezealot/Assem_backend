const R = require('ramda');
const AWS = require('aws-sdk');

AWS.config.loadFromPath('./aws_config.json');
const db = new AWS.DynamoDB.DocumentClient({
    region: 'us-east-1',
});
const mapKeys = R.curry((fn, obj) =>
    R.reduce(
        (acc, key) => {
            acc[fn(key)] = obj[key];
            return acc;
        },
        {},
        R.keys(obj)
    )
);

const prefixTableName4Normal = (params) => ({
    ...params,
    TableName: `${params.TableName}`,
});
const prefixTableName4Batch = (params) => ({
    ...params,
    RequestItems: mapKeys((tableName) => `${tableName}`, params.RequestItems),
});
const SaveChartTblName = 'savechart_record';
async function dbClient(action, params) {
    const gParams = action.startsWith('batch')
        ? prefixTableName4Batch(params)
        : prefixTableName4Normal(params);
    return db[action](gParams).promise();
}
async function putItem(params) {
    try {
        return dbClient('put', params);
    } catch (error) {
        console.log('Put Item error dbClient');
        console.error(error.toString());
    }
}
async function batchPutItems(params) {
    try {
        return dbClient('batchWrite', params);
    } catch (error) {
        console.error('batch write Items dbClient');
        console.error(error.toString());
    }
}
async function getItems(params) {
    try {
        return dbClient('query', params);
    } catch (error) {
        console.error('Get Items dbClient');
        console.error(error.toString());
    }
}
async function batchGetItem(params) {
    try {
        return dbClient('batchGet', params);
    } catch (error) {
        console.error('Get Items dbClient');
        console.error(error.toString());
    }
}
async function getItem(params) {
    try {
        return dbClient('get', params);
    } catch (error) {
        console.error('Get Item dbClient');
        console.error(error.toString());
    }
}
async function updateItem(updateParam) {
    try {
        return dbClient('update', updateParam);
    } catch (error) {
        console.error('Update Item error dbClient');
        console.error(error.toString());
    }
}
async function deleteItem(param) {
    try {
        return dbClient('delete', param);
    } catch (error) {
        console.error('Delete Item error dbClient');
        console.error(error.toString());
    }
}
async function scanItems(param) {
    try {
        return dbClient('scan', param);
    } catch (error) {
        console.error('Scan Item error dbClient');
        console.error(error.toString());
    }
}
async function scanItemsLastEvaluate(TableName, lastEvaluatedKey) {
    const params = {
        TableName,
        ExclusiveStartKey: lastEvaluatedKey,
    };
    return dbClient('scan', params);
}

async function batchDelete(TableName, resources) {
    const params = { RequestItems: {} };
    params.RequestItems[TableName] = resources.map((res) => ({
        DeleteRequest: {
            Key: {
                pri_key: res.pri_key,
                sort_key: res.sort_key,
            },
        },
    }));
    return dbClient('batchWrite', params);
}
/// /////////////////
/// /////////////////

module.exports = {
    dbClient,
    putItem,
    batchPutItems,
    getItems,
    batchGetItem,
    getItem,
    updateItem,
    deleteItem,
    scanItems,
    scanItemsLastEvaluate,
    batchDelete,
};
