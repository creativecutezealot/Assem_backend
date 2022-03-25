const R = require('ramda');
const models = require('../model/index');

function sendResult(code, msg, response) {
    response.header('Access-Control-Allow-Origin', '*');
    response.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
    );
    response.status(code).json(msg);
}
function parseJSONorNot(mayBeJSON) {
    if (typeof mayBeJSON === 'string') {
        return JSON.parse(mayBeJSON);
    }
    return mayBeJSON;
}
function compare(a, b) {
    if (a.user_id < b.user_id) {
        return -1;
    }
    if (a.user_id > b.user_id) {
        return 1;
    }
    return 0;
}
function validatePhone(inputtxt) {
    const phoneno = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,8}$/im;
    return phoneno.test(inputtxt);
}

function validateEmail(email) {
    const re =
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}
function getTimeLine(interval) {
    let tstamp;
    let cur_date = new Date().setMilliseconds(0);
    cur_date = new Date(cur_date).setSeconds(0) / 1000;
    if (cur_date % Number(interval) == 0) {
        tstamp = cur_date;
    } else {
        tstamp = cur_date - (cur_date % Number(interval));
    }
    return tstamp;
}
function getMonday(interval) {
    let tstamp;
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    let cur_date = new Date(d.setDate(diff + 7)).setMilliseconds(0);
    cur_date = new Date(cur_date).setSeconds(0) / 1000;
    if (cur_date % Number(interval) == 0) {
        tstamp = cur_date;
    } else {
        tstamp = cur_date - (cur_date % Number(interval));
    }
    return tstamp - 604800;
}

function removeDuplicated(key, data) {
    const { pipe, sortBy, prop, reverse, uniqBy } = R;
    const convert = pipe(sortBy(prop(key)), reverse, uniqBy(prop(key)));
    return convert(data);
}
function createModel(model) {
    const newModel = {};
    Object.keys(model).map((key) => {
        newModel[key] = model[key];
    });
    return newModel;
}

function generateInitDataModel(payload = {}, model) {
    const newModel = createModel(model);
    const newDataModel = newModel;
    Object.keys(newDataModel).map((key) => {
        const valObj = payload[key];
        if (newDataModel[key] === 'Boolean') {
            newDataModel[key] = valObj !== undefined ? valObj : false;
        } else if (newDataModel[key] === 'Date') {
            newDataModel[key] = valObj || new Date().toISOString();
        } else if (newDataModel[key] === 'Array') {
            newDataModel[key] = valObj || [];
        } else if (newDataModel[key] === 'Map') {
            newDataModel[key] = valObj || {};
        } else if (newDataModel[key] === 'Number') {
            newDataModel[key] = valObj || 0;
        } else {
            newDataModel[key] = valObj || '';
        }
    });
    return newDataModel;
}
function createKeyModel(pri_prefix, pri_val, sort_prefix, sort_val) {
    const keyModel = createModel(models.general);
    const newKeyModel = keyModel;
    Object.keys(newKeyModel).map((key) => {
        if (key === 'pri_key') {
            newKeyModel[key] = `${pri_prefix.toUpperCase()}#${pri_val}`;
        } else if (key === 'sort_key') {
            newKeyModel[
                key
            ] = `#${sort_prefix.toUpperCase()}#${pri_prefix.toUpperCase()}#${sort_val}`;
        }
    });
    return keyModel;
}

function createConnectKeyModel(
    pri_prefix,
    pri_val,
    sort_prefix,
    sec_sort_prefix,
    sort_val
) {
    const keyModel = createModel(models.general);
    const newKeyModel = keyModel;
    Object.keys(newKeyModel).map((key) => {
        if (key === 'pri_key') {
            newKeyModel[key] = `${pri_prefix.toUpperCase()}#${pri_val}`;
        } else if (key === 'sort_key') {
            newKeyModel[
                key
            ] = `#${sort_prefix.toUpperCase()}#${sec_sort_prefix.toUpperCase()}#${sort_val}`;
        }
    });
    return keyModel;
}

function generateUpdateDataModel(payload = {}, model) {
    let expression = 'set';
    const arttributeValues = {};
    const extraPayload = {
        ...payload,
        updated_at: new Date().toISOString(),
    };
    const userObj = Object.keys(model).map((key) => {
        const valObj = extraPayload[key];
        if (valObj !== undefined && valObj !== null) {
            const updateKey = `:${key}Str`;
            if (model[key] === 'Boolean') {
                arttributeValues[updateKey] = String(valObj) === 'true';
            } else if (model[key] === 'Date') {
                arttributeValues[updateKey] = valObj;
            } else if (model[key] === 'Array') {
                arttributeValues[updateKey] = valObj;
            } else if (model[key] === 'Number') {
                arttributeValues[updateKey] = valObj;
            } else {
                arttributeValues[updateKey] = valObj;
            }
            expression = `${expression} ${key}= ${updateKey},`;
        }
    });
    // cut lastest comma
    expression = expression.slice(0, expression.length - 1);
    return { arttributeValues, expression };
}

function generateConnectExpAndAttris(pri_prefix, pri_val, sort_prefix) {
    const expression =
        'pri_key = :pri_key and sort_key between :from_prefix and :to_prefix';
    const firstRangeLetter = `${sort_prefix}`.replace('#', '').slice(0, 1);
    const secondRangeLetter = getNextLetter(firstRangeLetter);
    const arttributeValues = {};
    arttributeValues[':pri_key'] = `${pri_prefix.toUpperCase()}#${pri_val}`;
    arttributeValues[':from_prefix'] = `#${firstRangeLetter}`; // `#${sort_prefix.toUpperCase()}#${pri_prefix.toUpperCase()}#$`;
    arttributeValues[':to_prefix'] = `#${secondRangeLetter}`;
    return { arttributeValues, expression };
}

function getNextLetter(str) {
    return (
        str.substring(0, str.length - 1) +
        String.fromCharCode(str.charCodeAt(str.length - 1) + 1)
    );
}

function generateOpssiteExpAndAttris(pri_prefix, sort_prefix, sort_val) {
    const expression = 'sort_key = :s_k';
    const arttributeValues = {};
    arttributeValues[
        ':s_k'
    ] = `#${sort_prefix.toUpperCase()}#${pri_prefix.toUpperCase()}#${sort_val}`;
    return { arttributeValues, expression };
}

const getDisplayName = (text, frontSign = '@') => {
    if (text && text != '') {
        return `${frontSign}${text.replace(/\s/g, '').trim()}`;
    }
    return '';
};

module.exports = {
    compare,
    sendResult,
    parseJSONorNot,
    validatePhone,
    validateEmail,
    getTimeLine,
    getMonday,
    generateInitDataModel,
    generateUpdateDataModel,
    generateConnectExpAndAttris,
    generateOpssiteExpAndAttris,
    createKeyModel,
    createConnectKeyModel,
    removeDuplicated,
    getDisplayName,
};
