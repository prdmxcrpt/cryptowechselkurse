const assert = require('assert');
const test = require('node:test');
const { calculateSMA, calculateConvertedAmount } = require('../js/api.js');

test('calculateSMA - empty or invalid inputs', () => {
    assert.deepStrictEqual(calculateSMA([]), []);
    assert.deepStrictEqual(calculateSMA(null), []);
    assert.deepStrictEqual(calculateSMA(undefined), []);
});

test('calculateSMA - window size equal to 10', () => {
    // Array of 12 prices: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120
    const prices = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120];
    const sma = calculateSMA(prices, 10);

    assert.strictEqual(sma.length, 12);
    // First 9 items must be null
    for (let i = 0; i < 9; i++) {
        assert.strictEqual(sma[i], null, `Index ${i} should be null`);
    }

    // Index 9: average of 10..100 = 55
    assert.strictEqual(sma[9], 55);

    // Index 10: average of 20..110 = 65
    assert.strictEqual(sma[10], 65);

    // Index 11: average of 30..120 = 75
    assert.strictEqual(sma[11], 75);
});

test('calculateSMA - less than 10 values', () => {
    const prices = [100, 102, 104, 101, 105];
    const sma = calculateSMA(prices, 10);

    assert.strictEqual(sma.length, 5);
    assert.deepStrictEqual(sma, [null, null, null, null, null]);
});

test('calculateConvertedAmount - valid calculations', () => {
    assert.strictEqual(calculateConvertedAmount(2, 75000), 150000);
    assert.strictEqual(calculateConvertedAmount(0.5, 2600), 1300);
    assert.strictEqual(calculateConvertedAmount(0, 1000), 0);
});

test('calculateConvertedAmount - invalid inputs handle gracefully', () => {
    assert.strictEqual(calculateConvertedAmount(-1, 500), 0);
    assert.strictEqual(calculateConvertedAmount(10, -50), 0);
    assert.strictEqual(calculateConvertedAmount('invalid', 500), 0);
    assert.strictEqual(calculateConvertedAmount(10, NaN), 0);
});
