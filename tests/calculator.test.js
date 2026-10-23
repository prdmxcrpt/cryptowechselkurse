const assert = require('assert');
const test = require('node:test');
const {
    calculateSMA,
    calculateConvertedAmount,
    KNOWN_SPL_MINTS,
    fetchSolanaWalletBalances,
    LAYER1_CHAINS,
    COIN_DATABASE,
    getCoinsForChain,
    verifyCoinAddress,
    fetchBitqueryAndBlockVisionOverview
} = require('../js/api.js');

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

test('KNOWN_SPL_MINTS contains Bonk mint mapping', () => {
    const bonkMint = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
    assert.ok(KNOWN_SPL_MINTS[bonkMint]);
    assert.strictEqual(KNOWN_SPL_MINTS[bonkMint].symbol, 'BONK');
    assert.strictEqual(KNOWN_SPL_MINTS[bonkMint].name, 'Bonk');
});

test('fetchSolanaWalletBalances throws error on empty address', async () => {
    await assert.rejects(async () => {
        await fetchSolanaWalletBalances('');
    }, { message: 'Invalid wallet address' });
});

test('fetchSolanaWalletBalances calculates token conversions correctly', () => {
    const amount = 93214664.1;
    const bitvavoBonkPrice = 0.00000289;
    const binanceBonkPrice = 0.00000313;

    const totalEur = calculateConvertedAmount(amount, bitvavoBonkPrice);
    const totalUsdt = calculateConvertedAmount(amount, binanceBonkPrice);

    assert.ok(totalEur > 269 && totalEur < 270);
    assert.ok(totalUsdt > 291 && totalUsdt < 292);
});

test('LAYER1_CHAINS contains expected 5 chains', () => {
    assert.ok(LAYER1_CHAINS.BITCOIN);
    assert.ok(LAYER1_CHAINS.ETHEREUM);
    assert.ok(LAYER1_CHAINS.SOLANA);
    assert.ok(LAYER1_CHAINS.SUI);
    assert.ok(LAYER1_CHAINS.BNB);
});

test('getCoinsForChain filters coins by chain and search query', () => {
    const solCoins = getCoinsForChain('solana');
    assert.ok(solCoins.length >= 3);
    assert.strictEqual(solCoins[0].address, 'Nativ');

    const bonkCoins = getCoinsForChain('solana', 'bonk');
    assert.strictEqual(bonkCoins.length, 1);
    assert.strictEqual(bonkCoins[0].symbol, 'BONK');
});

test('verifyCoinAddress verifies native coins as verified', async () => {
    const res = await verifyCoinAddress('solana', 'Nativ', true);
    assert.strictEqual(res.verified, true);
    assert.strictEqual(res.message, 'Native Chain Coin');
});

test('fetchBitqueryAndBlockVisionOverview returns formatted token list', async () => {
    const overview = await fetchBitqueryAndBlockVisionOverview();
    assert.ok(Array.isArray(overview));
    assert.ok(overview.length > 0);
    assert.ok('verified' in overview[0]);
    assert.ok('priceEur' in overview[0]);
    assert.ok('marketCap' in overview[0]);
    assert.ok('volumeBitvavo' in overview[0]);
});
