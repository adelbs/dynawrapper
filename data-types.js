
function validateType(schemaField, fieldValue) {
    const invalidTypeString = ((schemaField.type == String || schemaField == String) && typeof fieldValue != 'string');
    const invalidTypeNumber = ((schemaField.type == Number || schemaField == Number) && typeof fieldValue != 'number');
    const invalidTypeBoolean = ((schemaField.type == Boolean || schemaField == Boolean) && typeof fieldValue != 'boolean');

    const invalidCustomType = (schemaField.validate && !schemaField.validate());

    return !(invalidTypeString || invalidTypeNumber || invalidTypeBoolean || invalidCustomType);
}

/**
 * @param {function(value)} validate 
 */
const DataType = function(validate) {
    this.validate = function(value) { return validate(value); };
    this.toDBValue = function(value) { return value; };
    this.toObjValue = function(value) { return value; };
}

const typeEmail = new DataType(value => {
    let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(value).toLowerCase());
});

const typePassword = new DataType(value => {
    let re = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/;
    return re.test(value);
});

const typeCPF = new DataType(value => {
    let re = /([0-9]{3}[\.]?[0-9]{3}[\.]?[0-9]{3}[-]?[0-9]{2})/;
    return re.test(value);
});

const typeCNPJ = new DataType(value => {
    let re = /([0-9]{2}[\.]?[0-9]{3}[\.]?[0-9]{3}[\/]?[0-9]{4}[-]?[0-9]{2})/;
    return re.test(value);
});

const types = {
    requiredString: {
        type: String,
        required: true
    },
    requiredNumber: {
        type: Number,
        required: true
    },
    cpf: typeCPF,
    cnpj: typeCNPJ,
    email: typeEmail,
    password: typePassword
};

module.exports.types = types;
module.exports.validateType = validateType;