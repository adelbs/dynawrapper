'use strict';

const AWS = require('aws-sdk');
const uuid = require('uuid/v1');

const config = require('./config');
const { validateType, types } = require('./data-types');

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

function validateSchema(obj, schema) {
    for (let attr in schema) {
        if (attr != '_id' && attr != '_isSchema') {
            //Checking if it is a list and if the values of the list matches with the schema list type
            if (obj[attr] && obj[attr].push && schema[attr].push && !validateType(schema[attr][0], obj[attr][0]))
                throw new Error(`Invalid data type list: the Object value does not match with the schema: field "${attr}"`);

            //Checking the required fields and default values
            if (!obj[attr] && schema[attr].required) {
                if (schema[attr].default)
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

function Schema(obj, blocked = false) {
    for (let attr in obj) {
        this[attr] = obj[attr];
    }

    this._isSchema = true;
    this._blocked = blocked;
};

/**
 * @param {String} tableName 
 * @param {Schema} schema 
 */
function model(tableName, schema) {

    /**
     * @param {*} obj 
     */
    let Model = function (obj) {
        this.tableName = tableName;

        /**
         * Creates or Updates an Item (depending on the _id)
         */
        this.save = async function () {
            await initModel(this);

            let params = {
                TableName: tableName,
                Item: obj
            };

            //Validating the fields
            validateSchema(obj, schema);

            let awsRequest;
            let result;

            //If there is no _id, then it means it is a new data
            if (obj._id) {
                params.Key = { _id: obj._id };
                params.UpdateExpression = 'set ';
                params.ExpressionAttributeValues = {};

                for (let attr in obj) {
                    if (attr != '_id') {
                        params.UpdateExpression += `${attr} = :${attr}, `;
                        params.ExpressionAttributeValues[`:${attr}`] = obj[attr];
                    }
                }

                params.UpdateExpression = params.UpdateExpression.substring(0, params.UpdateExpression.length - 2);

                awsRequest = await docClient.update(params);
                result = await awsRequest.promise();
                result = obj;
            }
            else {
                obj._id = uuid();
                awsRequest = await docClient.put(params);
                result = await awsRequest.promise();
                result = obj;
            }

            return result;
        };

        this.delete = async function () {
            let params = {
                TableName: tableName,
                Key: { '_id': obj._id }
            };

            const awsRequest = await docClient.delete(params);
            const result = await awsRequest.promise();
            return result;
        };
    };

    /**
     * Performs a scan at the DynamoDB table
     * @param {*} query 
     */
    Model.find = async function (query) {
        let params = {
            TableName: tableName
        };

        params.FilterExpression = query.FilterExpression;
        params.ExpressionAttributeValues = query.ExpressionAttributeValues;

        const awsRequest = await docClient.scan(params);
        const result = await awsRequest.promise();

        return result.Items;
    };

    return Model;
}

module.exports.types = types;
module.exports.model = model;
module.exports.Schema = Schema;