const { Schema, model, types } = require('./index');

const crypt = require('sjcl');

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
    subField: testSubSchema
}, true);

const Test = model('TestTable', testSchema);

const test = new Test({
    name: 'Test 01',
    address: 'address',
    email: 'myemail@testemail.com',
    cpf: '528.948.220-22',
    password: 'testPWS123',
    dt: new Date(),
    subField: {
        name: 'subfieldname',
        email: 'test@email.com',
        inex: 'inex'
    },
    inex: 'inex'
});

// console.log('123.123/123-123'.replace(/[^\d]+/g,''));

// test.save();

// console.log(crypt.encrypt('felipe', 'felipe'));

// console.log(types.password.toDBValue('Felipe'));
// console.log(types.password.toObjValue({value: 'giK7kPmZiG5pzwNgeZ3n0Q==#|!kkzLxMXAVEg=@|?hixzbfGrcCW7DDF/SZU=', key: 'Felipe'}));