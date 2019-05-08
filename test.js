const encrypt = require('sjcl');

const { Schema, model, types } = require('./index');

const testSubSchema = new Schema({
    name: types.requiredString,
    address: String,
    email: types.email,
    password: types.password,
    dt: types.date
});

const testSchema = new Schema({
    name: types.requiredString,
    address: String,
    email: types.email,
    cpf: {
        type: types.cpf,
        required: true
    },
    password: types.password,
    dt: types.date,
    subField: [testSubSchema],
    balance: types.requiredNumber
}, true);

const Test = model('TestTable', testSchema);

const test = new Test({
    name: 'Test 01',
    address: 'address',
    email: 'myemail@testemail.com',
    cpf: '528.948.220-22',
    password: 'testPWS123',
    dt: new Date(),
    subField: [{
        name: 'subfieldname',
        email: 'test@email.com',
        inex: 'inex',
        password: 'senhaSegura123'
    }],
    inex: 'inex',
    balance: 0.0
});

// console.log('123.123/123-123'.replace(/[^\d]+/g,''));

async function doTest() {

    let obj = encrypt.encrypt('123456', 'felipe');

    // let valor = encrypt.decrypt('chave', '{"iv":"LEtq4YkxIOIj5kLxzWGyVw==","v":1,"iter":10000,"ks":128,"ts":64,"mode":"ccm","adata":"","cipher":"aes","salt":"gjsgNfqHIuM=","ct":"zmEZL5gHLbm86E+0hJg="}');


    console.log(obj);
}

doTest();

// console.log(crypt.encrypt('felipe', 'felipe'));

// console.log(types.password.toDBValue('Felipe'));
// console.log(types.password.toObjValue({value: 'giK7kPmZiG5pzwNgeZ3n0Q==#|!kkzLxMXAVEg=@|?hixzbfGrcCW7DDF/SZU=', key: 'Felipe'}));