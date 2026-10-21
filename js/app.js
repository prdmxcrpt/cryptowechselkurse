/**
 * Main Application Logic & UI Handler for Crypto Rate Calculator
 */

// Application State
const state = {
    amount: 1,
    fromSymbol: 'BTC',
    targetFiat: 'EUR',
    bitvavoUnitPrice: null,
    binanceUnitPrice: null,
    isBinanceFallback: false,
    chartSymbol: 'BTC',
    historicalCandles: []
};

// DOM Elements
const DOM = {
    navButtons: document.querySelectorAll('.nav-btn'),
    pageSections: document.querySelectorAll('.page-section'),

    // Calculator elements
    amountInput: document.getElementById('amount-input'),
    fromSelect: document.getElementById('from-symbol'),
    targetSelect: document.getElementById('target-fiat'),
    swapBtn: document.getElementById('swap-btn'),
    quickBtns: document.querySelectorAll('.quick-btn'),
    refreshBtn: document.getElementById('refresh-prices-btn'),

    // Output elements
    loadingIndicator: document.getElementById('loading-indicator'),
    bitvavoUnitPriceEl: document.getElementById('bitvavo-unit-price'),
    binanceUnitPriceEl: document.getElementById('binance-unit-price'),
    bitvavoResultEl: document.getElementById('bitvavo-converted-result'),
    binanceResultEl: document.getElementById('binance-converted-result'),
    impliedRatioEl: document.getElementById('implied-ratio'),
    cryptoCodeDisplays: document.querySelectorAll('.selected-crypto-code'),

    // Chart elements
    chartCryptoSelect: document.getElementById('chart-crypto-select'),
    chartLoading: document.getElementById('chart-loading'),
    statCurrent: document.getElementById('chart-stat-current'),
    statSma: document.getElementById('chart-stat-sma'),
    statHigh: document.getElementById('chart-stat-high'),
    statLow: document.getElementById('chart-stat-low')
};

// Formatting utilities
const formatCurrency = (val, currency = 'EUR', decimals = 2) => {
    if (val === null || val === undefined || isNaN(val)) return '--';
    const symbolMap = { 'EUR': '€', 'USDT': '$', 'USD': '$' };
    const currSymbol = symbolMap[currency] || currency;

    // Auto adjust decimals for low-value coins
    if (val < 1 && val > 0) {
        decimals = Math.max(4, decimals);
    }

    const formattedNum = new Intl.NumberFormat('de-DE', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(val);

    return `${formattedNum} ${currSymbol}`;
};

// Application Initialization
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
    setupCalculatorEvents();
    setupChartEvents();

    // Initial fetch
    updateExchangeRates();
    loadChartData(state.chartSymbol);
});

/**
 * Setup navigation tab switching
 */
function setupNavigation() {
    DOM.navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetPageId = btn.getAttribute('data-target');

            DOM.navButtons.forEach(b => b.classList.remove('active'));
            DOM.pageSections.forEach(s => s.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(targetPageId).classList.add('active');

            // If switching to chart page, trigger chart sync/resize if needed
            if (targetPageId === 'page-chart' && state.historicalCandles.length === 0) {
                loadChartData(state.chartSymbol);
            }
        });
    });
}

/**
 * Setup Event Listeners for the Exchange Calculator
 */
function setupCalculatorEvents() {
    DOM.amountInput.addEventListener('input', (e) => {
        state.amount = parseFloat(e.target.value) || 0;
        recalculateResults();
    });

    DOM.fromSelect.addEventListener('change', (e) => {
        state.fromSymbol = e.target.value;
        updateSelectedCryptoDisplays(state.fromSymbol);

        // Also sync chart selection if user changed crypto in calculator
        if (DOM.chartCryptoSelect.value !== state.fromSymbol) {
            DOM.chartCryptoSelect.value = state.fromSymbol;
            state.chartSymbol = state.fromSymbol;
            loadChartData(state.chartSymbol);
        }

        updateExchangeRates();
    });

    DOM.targetSelect.addEventListener('change', (e) => {
        state.targetFiat = e.target.value;
        recalculateResults();
    });

    DOM.swapBtn.addEventListener('click', () => {
        // Toggle fiat target preference
        state.targetFiat = state.targetFiat === 'EUR' ? 'USDT' : 'EUR';
        DOM.targetSelect.value = state.targetFiat;
        recalculateResults();
    });

    DOM.quickBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = parseFloat(btn.getAttribute('data-val'));
            state.amount = val;
            DOM.amountInput.value = val;
            recalculateResults();
        });
    });

    DOM.refreshBtn.addEventListener('click', () => {
        updateExchangeRates();
    });
}

/**
 * Update crypto symbol text indicators across the UI
 */
function updateSelectedCryptoDisplays(symbol) {
    DOM.cryptoCodeDisplays.forEach(el => {
        el.textContent = symbol;
    });
}

/**
 * Fetch and update live rates from Bitvavo and Binance
 */
async function updateExchangeRates() {
    DOM.loadingIndicator.classList.remove('hidden');

    try {
        // 1. Fetch Bitvavo EUR price
        const bitvavoPrice = await fetchBitvavoPrice(state.fromSymbol);
        state.bitvavoUnitPrice = bitvavoPrice;

        // 2. Fetch Binance USDT price (pass bitvavoPrice as reference for fallback if needed)
        const binanceResult = await fetchBinancePrice(state.fromSymbol, bitvavoPrice);
        state.binanceUnitPrice = binanceResult.price;
        state.isBinanceFallback = binanceResult.isFallback;

        // Display unit prices
        DOM.bitvavoUnitPriceEl.textContent = formatCurrency(state.bitvavoUnitPrice, 'EUR');
        DOM.binanceUnitPriceEl.textContent = formatCurrency(state.binanceUnitPrice, 'USDT') + (state.isBinanceFallback ? ' *' : '');

        // Implied ratio (USDT price / EUR price)
        if (state.bitvavoUnitPrice > 0 && state.binanceUnitPrice > 0) {
            const ratio = state.binanceUnitPrice / state.bitvavoUnitPrice;
            DOM.impliedRatioEl.textContent = `1 EUR ≈ ${ratio.toFixed(4)} USDT`;
        } else {
            DOM.impliedRatioEl.textContent = '--';
        }

        recalculateResults();
    } catch (err) {
        console.error('Error fetching live rates:', err);
        DOM.bitvavoUnitPriceEl.textContent = 'Fehler beim Laden';
        DOM.binanceUnitPriceEl.textContent = 'Fehler beim Laden';
    } finally {
        DOM.loadingIndicator.classList.add('hidden');
    }
}

/**
 * Recalculate converted totals based on amount & selected rates
 */
function recalculateResults() {
    const bitvavoTotal = calculateConvertedAmount(state.amount, state.bitvavoUnitPrice);
    const binanceTotal = calculateConvertedAmount(state.amount, state.binanceUnitPrice);

    DOM.bitvavoResultEl.textContent = formatCurrency(bitvavoTotal, 'EUR');
    DOM.binanceResultEl.textContent = formatCurrency(binanceTotal, 'USDT');
}

/**
 * Setup chart controls
 */
function setupChartEvents() {
    DOM.chartCryptoSelect.addEventListener('change', (e) => {
        state.chartSymbol = e.target.value;

        // Sync calculator crypto symbol
        if (DOM.fromSelect.value !== state.chartSymbol) {
            DOM.fromSelect.value = state.chartSymbol;
            state.fromSymbol = state.chartSymbol;
            updateSelectedCryptoDisplays(state.fromSymbol);
            updateExchangeRates();
        }

        loadChartData(state.chartSymbol);
    });
}

/**
 * Fetch 12 months historical candles, compute 10D SMA, update chart & summary stats
 */
async function loadChartData(symbol) {
    DOM.chartLoading.classList.remove('hidden');

    try {
        // Fetch 375 daily candles (~12 months + extra 10 days for SMA padding)
        const candles = await fetchBitvavoHistoricalCandles(symbol, 375);
        state.historicalCandles = candles;

        const closingPrices = candles.map(c => c.close);
        const sma10 = calculateSMA(closingPrices, 10);

        // Compute summary statistics over 12 months
        const currentPrice = candles[candles.length - 1].close;
        const currentSma = sma10[sma10.length - 1];
        const highPrice = Math.max(...closingPrices);
        const lowPrice = Math.min(...closingPrices);

        DOM.statCurrent.textContent = formatCurrency(currentPrice, 'EUR');
        DOM.statSma.textContent = formatCurrency(currentSma, 'EUR');
        DOM.statHigh.textContent = formatCurrency(highPrice, 'EUR');
        DOM.statLow.textContent = formatCurrency(lowPrice, 'EUR');

        // Render Chart using Chart.js module
        renderHistoricalChart(symbol, candles, sma10);
    } catch (error) {
        console.error('Error loading chart data:', error);
        DOM.statCurrent.textContent = 'Fehler';
        DOM.statSma.textContent = 'Fehler';
        DOM.statHigh.textContent = 'Fehler';
        DOM.statLow.textContent = 'Fehler';
    } finally {
        DOM.chartLoading.classList.add('hidden');
    }
}
