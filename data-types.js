const crypt = require('sjcl');
const DEFAULT_CRYPTO_KEY = '27389&wueyASA';

function validateType(schemaField, fieldValue) {
    const invalidTypeString = ((schemaField.type == String || schemaField == String) && typeof fieldValue != 'string');
    const invalidTypeNumber = ((schemaField.type == Number || schemaField == Number) && typeof fieldValue != 'number');
    const invalidTypeBoolean = ((schemaField.type == Boolean || schemaField == Boolean) && typeof fieldValue != 'boolean');

    const invalidCustomType = ((schemaField.validate && !schemaField.validate(fieldValue)) ||
        (schemaField.type && schemaField.type.validate && !schemaField.type.validate(fieldValue)))
        ? true : false;

    return !(invalidTypeString || invalidTypeNumber || invalidTypeBoolean || invalidCustomType);
}

/**
 * @param {function(value)} validate 
 * @param {function(value)} toDBValue 
 * 
 * New Obj means this is a new Object and the value is not comming from the database
 * @param {function(value, newObj)} toObjValue 
 */
const DataType = function (validate, toDBValue, toObjValue) {
    this.validate = function (value) { return validate(value); };
    this.toDBValue = function (value) { return toDBValue(value); };
    this.toObjValue = function (value, newObj) { return toObjValue(value, newObj); };
}

const typeEmail = new DataType(
    //Validate
    value => {
        let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(value).toLowerCase());
    },
    //To DB Value
    value => { return value; },
    //To Obj Value
    value => { return value; }
);

const typePassword = new DataType(
    //Validate
    value => {
        let re = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}/;
        return re.test(value);
    },
    //To DB Value
    value => {
        let pwd = JSON.parse(crypt.encrypt(value + DEFAULT_CRYPTO_KEY, value));
        pwd = `${pwd.iv}#|!${pwd.salt}@|?${pwd.ct}`;
        return pwd;
    },
    //To Obj Value
    (value, newObj) => {
        // value = { key: 'pwdToOpen', value: 'valueFromDB' }
        let result = '';

        if (newObj) result = value;
        else {

            try {
                let a = value.value.split('#|!')[0];
                let b = value.value.split('#|!')[1].split('@|?')[0];
                let c = value.value.split('#|!')[1].split('@|?')[1];
                let pwd = {
                    iv: a,
                    iter: 10000,
                    ks: 128,
                    ts: 64,
                    mode: 'ccm',
                    adata: '',
                    cipher: 'aes',
                    salt: b,
                    ct: c
                };

                result = crypt.decrypt(value.key + DEFAULT_CRYPTO_KEY, JSON.stringify(pwd));
            }
            catch (err) { result = null; }
        }
        
        return result;
    }
);

const typeCPF = new DataType(
    //Validate
    value => {
        let re = /([0-9]{3}[\.]?[0-9]{3}[\.]?[0-9]{3}[-]?[0-9]{2})/;
        let isValid = (typeof value == 'string' && re.test(value));

        if (isValid) {
            let sum = 0;
            let left;
            let unformattedValue;

            if (value == '00000000000' || value == '000.000.000-00' || (value.length != 11 && value.length != 14)) isValid = false;
            else {
                unformattedValue = value.replace(/[^\d]+/g, '');

                for (i = 1; i <= 9; i++) sum = sum + parseInt(unformattedValue.substring(i - 1, i)) * (11 - i);
                left = (sum * 10) % 11;

                if ((left == 10) || (left == 11)) left = 0;
                if (left != parseInt(unformattedValue.substring(9, 10))) isValid = false;
                else {
                    sum = 0;
                    for (i = 1; i <= 10; i++) sum = sum + parseInt(unformattedValue.substring(i - 1, i)) * (12 - i);
                    left = (sum * 10) % 11;

                    if ((left == 10) || (left == 11)) left = 0;
                    if (left != parseInt(unformattedValue.substring(10, 11))) isValid = false;
                }
            }
        }

        return isValid;
    },
    //To DB Value
    value => { return value; },
    //To Obj Value
    value => { return value; }
);

const typeCNPJ = new DataType(
    //Validate
    value => {
        let re = /([0-9]{2}[\.]?[0-9]{3}[\.]?[0-9]{3}[\/]?[0-9]{4}[-]?[0-9]{2})/;
        let isValid = (typeof value == 'string' && re.test(value));

        if (isValid) {
            let unformattedValue = value.replace(/[^\d]+/g, '');

            if (unformattedValue == '' || unformattedValue.length != 14) isValid = false;
            else if (unformattedValue == "00000000000000" || unformattedValue == "11111111111111" ||
                unformattedValue == "22222222222222" || unformattedValue == "33333333333333" ||
                unformattedValue == "44444444444444" || unformattedValue == "55555555555555" ||
                unformattedValue == "66666666666666" || unformattedValue == "77777777777777" ||
                unformattedValue == "88888888888888" || unformattedValue == "99999999999999")
                isValid = false;
            else {
                // Valida DVs
                let size = value.length - 2
                let numbers = value.substring(0, size);
                let digits = value.substring(size);
                let sum = 0;
                let pos = size - 7;
                for (i = size; i >= 1; i--) {
                    sum += numbers.charAt(size - i) * pos--;
                    if (pos < 2) pos = 9;
                }

                let result = sum % 11 < 2 ? 0 : 11 - sum % 11;
                if (result != digits.charAt(0)) isValid = false;
                else {
                    size = size + 1;
                    numbers = value.substring(0, size);
                    sum = 0;
                    pos = size - 7;
                    for (i = size; i >= 1; i--) {
                        sum += numbers.charAt(size - i) * pos--;
                        if (pos < 2) pos = 9;
                    }
                    result = sum % 11 < 2 ? 0 : 11 - sum % 11;
                    if (result != digits.charAt(1)) isValid = false;
                }
            }
        }

        return isValid;
    },
    //To DB Value
    value => { return value; },
    //To Obj Value
    value => { return value; }
);

const typeDate = new DataType(
    //Validate
    value => { return (typeof value == 'object' && value.toISOString); },
    //To DB Value
    value => { return value.toISOString(); },
    //To Obj Value
    value => { return new Date(value); }
);

const types = {
    requiredString: {
        type: String,
        required: true
    },
    requiredNumber: {
        type: Number,
        required: true
    },
    date: typeDate,
    cpf: typeCPF,
    cnpj: typeCNPJ,
    email: typeEmail,
    password: typePassword
};

module.exports.types = types;
module.exports.validateType = validateType;