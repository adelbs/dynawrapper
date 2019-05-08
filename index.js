'use strict';

const AWS = require('aws-sdk');
const uuid = require('uuid/v1');

const config = require('./config');
const { validateType } = require('./data-types');

AWS.config.update({ region: config.awsRegion });
const docClient = new AWS.DynamoDB.DocumentClient();


/**
 * Find for the tableName at the DynamoDB region. If it doesn't exist, creates the table.
 * @param {*} model 
 */
async function initModel(model) {
    if (config.dynamoDB.autoCreateTables && !model.initialized) {
        const dynamoDB = new AWS.DynamoDB();
        let awsRequest = await dynamoDB.listTables();
        let result = await awsRequest.promise();
        let hasTable = false;
        for (let table in result.TableNames) {
            if (result.TableNames[table] == model.tableName) {
                hasTable = true;
                break;
            }
        }

        if (!hasTable) {
            const params = {
                TableName: model.tableName,
                KeySchema: [{ AttributeName: "_id", KeyType: "HASH" }],
                AttributeDefinitions: [{ AttributeName: "_id", AttributeType: "S" }],
                ProvisionedThroughput: {
                    ReadCapacityUnits: 5,
                    WriteCapacityUnits: 5
                }
            };

            awsRequest = await dynamoDB.createTable(params);
            result = await awsRequest.promise();

            awsRequest = await dynamoDB.waitFor('tableExists', { TableName: model.tableName });
            result = await awsRequest.promise();
        }

        model.initialized = true;
    }
}

/**
 * @param {*} obj 
 * @param {Schema} schema 
 */
function validateSchema(obj, schema) {
    for (let attr in schema) {
        if (attr.indexOf('_') == -1) {

            //Checking if it is a list and if the values of the list matches with the schema list type
            if (obj[attr] && obj[attr].push && schema[attr].push && !validateType(schema[attr][0], obj[attr][0]))
                throw new Error(`Invalid data type list: the Object value does not match with the schema: field "${attr}"`);

            //Checking the required fields and default values
            if (!obj[attr] && schema[attr].required && obj[attr] != 0) {
                if (schema[attr].default || schema[attr].default == 0)
                    obj[attr] = schema[attr].default;
                else
                    throw new Error(`The field "${attr}" is required`);
            }

            //Checking the types
            if (obj[attr] && !validateType(schema[attr], obj[attr]))
                throw new Error(`Invalid data type: the Object value does not match with the schema: field "${attr}"`);

            //If it's an enum, validate the value
            if (obj[attr] && schema[attr].enum) {
                let enumValueFound = false;
                for (let enumItem in schema[attr].enum) {
                    if (schema[attr].enum[enumItem] == obj[attr]) {
                        enumValueFound = true;
                        break;
                    }
                }

                if (!enumValueFound)
                    throw new Error(`Invalid enum item: field "${attr}"`);
            }

            //If it's a sub-document, validates its schema also
            if (obj[attr] && schema[attr]._isSchema)
                validateSchema(obj[attr], schema[attr]);
            else if (obj[attr] && schema[attr].type && schema[attr].type._isSchema)
                validateSchema(obj[attr], schema[attr].type);
        }
    }
}

/**
 * @param {*} obj 
 * @param {Schema} schema 
 */
function getObjToSave(obj, schema, isSubdocument = false) {
    let retObj = {};

    if (!obj._id) {
        retObj._id = uuid();
        if (!isSubdocument) retObj._isNew = true;
    }
    else {
        retObj._id = obj._id;
        if (!isSubdocument) retObj._isNew = false;
    }

    for (let attr in obj) {
        if (schema[attr] && schema[attr].toDBValue)
            retObj[attr] = schema[attr].toDBValue(obj[attr]);
        else if (schema[attr] && schema[attr].type && schema[attr].type.toDBValue)
            retObj[attr] = schema[attr].type.toDBValue(obj[attr]);
        else if (schema[attr] && schema[attr]._isSchema)
            retObj[attr] = getObjToSave(obj[attr], schema[attr], true);
        else if (schema[attr] && schema[attr].type && schema[attr].type._isSchema)
            retObj[attr] = getObjToSave(obj[attr], schema[attr].type, true);
        else if (schema[attr] && schema[attr].push && schema[attr][0]._isSchema) {
            retObj[attr] = [];
            for (let i = 0; i < obj[attr].length; i++) {
                retObj[attr][i] = getObjToSave(obj[attr][i], schema[attr][0], true);
            }
        }
        else if (schema[attr] || (!schema[attr] && !schema._blocked))
            retObj[attr] = obj[attr];
    }

    return retObj;
}

/**
 * @param {*} obj 
 * @param {Schema} schema 
 */
function getSavedObj(obj, schema) {
    let retObj = {};

    if (obj._id) retObj._id = obj._id;

    for (let attr in obj) {
        if (schema[attr] && schema[attr].toObjValue)
            retObj[attr] = schema[attr].toObjValue(obj[attr]);
        else if (schema[attr] && schema[attr].type && schema[attr].type.toObjValue)
            retObj[attr] = schema[attr].type.toObjValue(obj[attr]);
        else if (schema[attr] && schema[attr]._isSchema)
            retObj[attr] = getSavedObj(obj[attr], schema[attr]);
        else if (schema[attr] && schema[attr].type && schema[attr].type._isSchema)
            retObj[attr] = getSavedObj(obj[attr], schema[attr].type);
        else if (schema[attr] && schema[attr].push && schema[attr][0]._isSchema) {
            retObj[attr] = [];
            for (let i = 0; i < obj[attr].length; i++) {
                retObj[attr][i] = getSavedObj(obj[attr][i], schema[attr][0]);
            }
        }
        else if (schema[attr] || (!schema[attr] && !schema._blocked))
            retObj[attr] = obj[attr];
    }

    return retObj;
}

function Schema(obj, blocked = false) {
    for (let attr in obj) {
        this[attr] = obj[attr];
    }

    this._isSchema = true;
    this._blocked = blocked;
};

/**
 * @param {String} tableName 
 * @param {Schema} objSchema 
 */
function model(tableName, objSchema) {

    /**
     * @param {objSchema} obj 
     */
    let Model = function (obj = objSchema) {
        this.tableName = tableName;
        this.schema = objSchema;

        let tmpObj = getSavedObj(obj, objSchema);
        for (let attr in tmpObj) this[attr] = tmpObj[attr];

        /**
         * Load the obj according to the _id
         */
        this.load = async function () {
            await initModel(this);

            let tmpObj = await scan(this, {
                FilterExpression: '#id = :id',
                ExpressionAttributeNames: { '#id': '_id' },
                ExpressionAttributeValues: { ':id': this._id }
            });

            delete this['_id'];

            if (tmpObj) {
                tmpObj = getSavedObj(tmpObj[0], objSchema);
                for (let attr in tmpObj) this[attr] = tmpObj[attr];
            }
        };

        /**
         * Creates or Updates an Item (depending on the _id)
         */
        this.save = async function () {
            await initModel(this);

            let awsRequest;
            let params = { TableName: tableName };

            //Validating the fields
            validateSchema(this, objSchema);

            //Preparing the obj to save
            params.Item = getObjToSave(this, objSchema);

            if (params.Item._isNew) {
                delete params.Item._isNew;
                awsRequest = await docClient.put(params);
                await awsRequest.promise();
            }
            else {
                delete params.Item._isNew;
                params.Key = { _id: params.Item._id };
                params.UpdateExpression = 'set ';
                params.ExpressionAttributeNames = {};
                params.ExpressionAttributeValues = {};

                for (let attr in params.Item) {
                    if (attr != '_id') {
                        params.UpdateExpression += `#${attr} = :${attr}, `;
                        params.ExpressionAttributeNames[`#${attr}`] = attr;
                        params.ExpressionAttributeValues[`:${attr}`] = params.Item[attr];
                    }
                }

                params.UpdateExpression = params.UpdateExpression.substring(0, params.UpdateExpression.length - 2);

                awsRequest = await docClient.update(params);
                await awsRequest.promise();
            }

            this._id = params.Item._id;
            return params.Item;
        };

        this.push = async function () {
            // const params = {
            //     TableName: "top-ten",
            //     Key: {
            //         "UserId": 'abc123',
            //     },
            // UpdateExpression : "SET #attrName = list_append(#attrName, :attrValue)",
            // ExpressionAttributeNames : {
            //   "#attrName" : "Lists"
            // },
            // ExpressionAttributeValues : {
            //   ":attrValue" : [{
            //             "id": 2,
            //             "title": "Favorite TV Shows",
            //             "topMovies": [{"id": 1, "title" : "The Simpsons"}]
            
            //         }]
            // },
            // ReturnValues: "UPDATED_NEW"
            // };
        };

        this.delete = async function () {
            await initModel(this);

            let params = {
                TableName: tableName,
                Key: { '_id': this._id }
            };

            const awsRequest = await docClient.delete(params);
            const result = await awsRequest.promise();

            for (let attr in this) delete this[attr];

            return result;
        };

        /**
         * Return a printable object without the Model and Schemas function
         */
        this.printObj = function () {
            let newObj = this;
            delete newObj['initialized'];
            delete newObj['load'];
            delete newObj['save'];
            delete newObj['delete'];
            delete newObj['tableName'];
            delete newObj['schema'];
            delete newObj['toString'];

            let returnObj = JSON.stringify(newObj);

            return JSON.parse(returnObj);
        };

    };

    return Model;
}

/**
* Performs a scan at the DynamoDB table
* @param {Model} model
* @param { {ProjectionExpression: '', FilterExpression: '', ExpressionAttributeNames: { }, ExpressionAttributeValues: { }} } query 
*/
async function scan(model, query) {

    let params = {
        TableName: model.tableName
    };

    params.FilterExpression = query.FilterExpression;
    params.ExpressionAttributeNames = query.ExpressionAttributeNames;
    params.ExpressionAttributeValues = query.ExpressionAttributeValues;

    if (query.ProjectionExpression) {
        params.ProjectionExpression = query.ProjectionExpression;
    }
    else {
        if (!params.ExpressionAttributeNames)
            params.ExpressionAttributeNames = { };

        params.ProjectionExpression = '#_id, ';
        params.ExpressionAttributeNames['#_id'] = '_id';

        for (let attr in model.schema) {
            // if (!model.schema[attr].push) {
                params.ProjectionExpression += `#${attr}, `;
                params.ExpressionAttributeNames[`#${attr}`] = attr;
            // }
        }

        params.ProjectionExpression = params.ProjectionExpression.substring(0, params.ProjectionExpression.length - 2);
    }

    const awsRequest = await docClient.scan(params);
    let result = await awsRequest.promise();
    result = result.Items;

    return result;
}

module.exports.scan = scan;
module.exports.model = model;
module.exports.Schema = Schema;