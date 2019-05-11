const { Schema, model, types, Transaction } = require('./index');

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

const Test1 = model('TestTable1', testSchema);
const Test2 = model('TestTable2', testSchema);

const test1 = new Test1({
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

const test2 = new Test2({
    name: 'Test 02',
    address: 'address',
    email: 'myemail@testemail.com',
    cpf: '528.948.220-22',
    password: 'testPWS123',
    dt: new Date(),
    subField: [{
        name: 'subfieldname',
        email: 'test@email.com',
        inex: 'inex',
        password: 'senha'
    }],
    inex: 'inex',
    balance: 0.0
});

async function doTest() {

    const tr = new Transaction();

    await test1.save(tr);
    await test2.save(tr);

    await tr.run();
}

doTest();
