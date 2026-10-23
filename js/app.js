/**
 * Main Application Logic & UI Handler for Crypto Rate Calculator
 */

// Application State
const state = {
    amount: 1,
    selectedChain: 'bitcoin',
    selectedCoin: COIN_DATABASE[0], // default BTC native
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
    chainSelect: document.getElementById('layer1-chain-select'),
    coinSearchInput: document.getElementById('coin-search-input'),
    coinSuggestionsDropdown: document.getElementById('coin-suggestions-dropdown'),
    selectedCoinNameDisplay: document.getElementById('selected-coin-name-display'),
    selectedCoinAddressDisplay: document.getElementById('selected-coin-address-display'),
    verificationStatusBadge: document.getElementById('verification-status-badge'),
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
    statLow: document.getElementById('chart-stat-low'),

    // Wallet elements
    walletAddressInput: document.getElementById('wallet-address-input'),
    fetchWalletBtn: document.getElementById('fetch-wallet-btn'),
    walletLoading: document.getElementById('wallet-loading'),
    walletResultsContainer: document.getElementById('wallet-results-container'),

    // Admin elements
    keyBitquery: document.getElementById('key-bitquery'),
    keyBlockvision: document.getElementById('key-blockvision'),
    keyBitvavo: document.getElementById('key-bitvavo'),
    keyCetus: document.getElementById('key-cetus'),
    keySuiscan: document.getElementById('key-suiscan'),
    keySolscan: document.getElementById('key-solscan'),
    keyStakewiz: document.getElementById('key-stakewiz'),
    saveApiKeysBtn: document.getElementById('save-api-keys-btn'),
    clearApiKeysBtn: document.getElementById('clear-api-keys-btn'),
    apiKeySaveStatus: document.getElementById('api-key-save-status'),
    refreshOverviewBtn: document.getElementById('refresh-overview-btn'),
    overviewTableBody: document.getElementById('overview-table-body'),
    stakingChainSelect: document.getElementById('staking-chain-select'),
    stakingAddressInput: document.getElementById('staking-address-input'),
    stakingAmountInput: document.getElementById('staking-amount-input'),
    addStakingWalletBtn: document.getElementById('add-staking-wallet-btn'),
    stakingWalletsList: document.getElementById('staking-wallets-list')
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
    setupAdminEvents();

    // Initial fetch
    updateExchangeRates();
    loadChartData(state.chartSymbol);
    setupWalletEvents();
    // Fetch initial wallet balances automatically
    fetchAndDisplayWallet();
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

        // If switching to admin page, trigger admin table load if needed
        if (targetPageId === 'page-admin') {
            loadAdminOverviewTable();
        }
        });
    });
}

/**
 * Setup Admin Page Logic, API Keys Storage & Staking Wallet Management
 */
function setupAdminEvents() {
    loadStoredApiKeysUI();
    renderStakingWallets();

    if (DOM.saveApiKeysBtn) {
        DOM.saveApiKeysBtn.addEventListener('click', () => {
            const keysObj = {
                onchain: {
                    bitquery: DOM.keyBitquery ? DOM.keyBitquery.value.trim() : '',
                    blockvision: DOM.keyBlockvision ? DOM.keyBlockvision.value.trim() : ''
                },
                exchanges: {
                    bitvavo: DOM.keyBitvavo ? DOM.keyBitvavo.value.trim() : ''
                },
                dex: {
                    cetus: DOM.keyCetus ? DOM.keyCetus.value.trim() : ''
                },
                explorers: {
                    suiscan: DOM.keySuiscan ? DOM.keySuiscan.value.trim() : '',
                    solscan: DOM.keySolscan ? DOM.keySolscan.value.trim() : '',
                    stakewiz: DOM.keyStakewiz ? DOM.keyStakewiz.value.trim() : ''
                }
            };
            saveApiKeys(keysObj);

            if (DOM.apiKeySaveStatus) {
                DOM.apiKeySaveStatus.classList.remove('hidden');
                setTimeout(() => DOM.apiKeySaveStatus.classList.add('hidden'), 2500);
            }
        });
    }

    if (DOM.clearApiKeysBtn) {
        DOM.clearApiKeysBtn.addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEYS.API_KEYS);
            loadStoredApiKeysUI();
            if (DOM.apiKeySaveStatus) {
                DOM.apiKeySaveStatus.textContent = 'Schlüssel gelöscht!';
                DOM.apiKeySaveStatus.classList.remove('hidden');
                setTimeout(() => {
                    DOM.apiKeySaveStatus.textContent = 'Gespeichert!';
                    DOM.apiKeySaveStatus.classList.add('hidden');
                }, 2500);
            }
        });
    }

    if (DOM.refreshOverviewBtn) {
        DOM.refreshOverviewBtn.addEventListener('click', () => {
            loadAdminOverviewTable();
        });
    }

    if (DOM.addStakingWalletBtn) {
        DOM.addStakingWalletBtn.addEventListener('click', () => {
            addStakingWalletFromInput();
        });
    }
}

function loadStoredApiKeysUI() {
    const keys = getStoredApiKeys();
    if (DOM.keyBitquery) DOM.keyBitquery.value = keys.onchain?.bitquery || '';
    if (DOM.keyBlockvision) DOM.keyBlockvision.value = keys.onchain?.blockvision || '';
    if (DOM.keyBitvavo) DOM.keyBitvavo.value = keys.exchanges?.bitvavo || '';
    if (DOM.keyCetus) DOM.keyCetus.value = keys.dex?.cetus || '';
    if (DOM.keySuiscan) DOM.keySuiscan.value = keys.explorers?.suiscan || '';
    if (DOM.keySolscan) DOM.keySolscan.value = keys.explorers?.solscan || '';
    if (DOM.keyStakewiz) DOM.keyStakewiz.value = keys.explorers?.stakewiz || '';
}

async function loadAdminOverviewTable() {
    if (!DOM.overviewTableBody) return;
    DOM.overviewTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Daten werden geladen...</td></tr>';

    try {
        const overviewData = await fetchBitqueryAndBlockVisionOverview();
        let html = '';

        for (const item of overviewData) {
            html += `
                <tr>
                    <td><strong>${item.name} (${item.symbol})</strong></td>
                    <td><span class="badge chain-badge">${item.chain}</span></td>
                    <td class="font-mono text-sm">${item.address}</td>
                    <td>
                        <span class="badge-verification ${item.verified ? 'verified' : 'unverified'}">
                            ${item.verified ? 'verified' : 'unverified'}
                        </span>
                    </td>
                    <td>${formatCurrency(item.priceEur, 'EUR')}</td>
                    <td>${formatCurrency(item.marketCap, 'EUR', 0)}</td>
                    <td>${formatCurrency(item.volumeBitvavo, 'EUR', 0)}</td>
                </tr>
            `;
        }

        DOM.overviewTableBody.innerHTML = html;
    } catch (e) {
        console.error('Error rendering admin overview:', e);
        DOM.overviewTableBody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Fehler beim Laden der Übersicht.</td></tr>';
    }
}

function getStoredStakingWallets() {
    try {
        const data = localStorage.getItem(STORAGE_KEYS.STAKING_WALLETS);
        return data ? JSON.parse(data) : [
            { id: '1', chain: 'solana', address: '2LyT28MSjRpnek9hNNtqV2QxXVPyJuA4acckTKFcJoPF', symbol: 'SOL', amount: 45.5 },
            { id: '2', chain: 'ethereum', address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F', symbol: 'ETH', amount: 3.2 }
        ];
    } catch (e) {
        return [];
    }
}

function saveStakingWallets(wallets) {
    try {
        localStorage.setItem(STORAGE_KEYS.STAKING_WALLETS, JSON.stringify(wallets));
    } catch (e) {
        console.error('Error saving staking wallets:', e);
    }
}

async function renderStakingWallets() {
    if (!DOM.stakingWalletsList) return;
    const wallets = getStoredStakingWallets();

    if (wallets.length === 0) {
        DOM.stakingWalletsList.innerHTML = '<div class="empty-staking-msg">Keine Staking-Wallets gespeichert.</div>';
        return;
    }

    let html = '<div class="staking-grid">';
    for (const w of wallets) {
        let eurPrice = 0;
        try {
            eurPrice = await fetchBitvavoPrice(w.symbol || (w.chain === 'solana' ? 'SOL' : w.chain === 'ethereum' ? 'ETH' : w.chain === 'sui' ? 'SUI' : 'BNB'));
        } catch (e) {
            eurPrice = w.chain === 'solana' ? 180 : w.chain === 'ethereum' ? 2600 : 1.5;
        }

        const totalValEur = w.amount * eurPrice;

        html += `
            <div class="staking-item-card">
                <div class="staking-item-header">
                    <span class="badge chain-badge">${w.chain.toUpperCase()}</span>
                    <button class="delete-staking-btn" data-id="${w.id}" title="Löschen">🗑️</button>
                </div>
                <div class="staking-item-addr font-mono">${w.address}</div>
                <div class="staking-item-balance">
                    <span class="stk-amount">${w.amount} ${w.symbol || w.chain.toUpperCase()}</span>
                    <span class="stk-eur-val text-success">${formatCurrency(totalValEur, 'EUR')}</span>
                </div>
            </div>
        `;
    }
    html += '</div>';

    DOM.stakingWalletsList.innerHTML = html;

    const delBtns = DOM.stakingWalletsList.querySelectorAll('.delete-staking-btn');
    delBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const updated = getStoredStakingWallets().filter(w => w.id !== id);
            saveStakingWallets(updated);
            renderStakingWallets();
        });
    });
}

function addStakingWalletFromInput() {
    const chain = DOM.stakingChainSelect ? DOM.stakingChainSelect.value : 'solana';
    const address = DOM.stakingAddressInput ? DOM.stakingAddressInput.value.trim() : '';
    const amount = DOM.stakingAmountInput ? parseFloat(DOM.stakingAmountInput.value) || 0 : 0;

    if (!address) return;

    const symbolMap = { bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', sui: 'SUI', bnb: 'BNB' };
    const wallets = getStoredStakingWallets();
    wallets.push({
        id: Date.now().toString(),
        chain,
        address,
        symbol: symbolMap[chain] || 'SOL',
        amount
    });

    saveStakingWallets(wallets);
    if (DOM.stakingAddressInput) DOM.stakingAddressInput.value = '';
    renderStakingWallets();
}

/**
 * Setup Event Listeners for the Exchange Calculator
 */
function setupCalculatorEvents() {
    DOM.amountInput.addEventListener('input', (e) => {
        state.amount = parseFloat(e.target.value) || 0;
        recalculateResults();
    });

    // Feld 1: Chain selector change event
    if (DOM.chainSelect) {
        DOM.chainSelect.addEventListener('change', (e) => {
            state.selectedChain = e.target.value;
            // Pick first coin of selected chain as default
            const chainCoins = getCoinsForChain(state.selectedChain);
            if (chainCoins.length > 0) {
                selectCoin(chainCoins[0]);
            }
        });
    }

    // Feld 2: Coin search input events & suggestion dropdown
    if (DOM.coinSearchInput) {
        DOM.coinSearchInput.addEventListener('focus', () => {
            renderCoinSuggestions(DOM.coinSearchInput.value);
        });

        DOM.coinSearchInput.addEventListener('input', (e) => {
            renderCoinSuggestions(e.target.value);
        });

        // Hide suggestions on click outside
        document.addEventListener('click', (e) => {
            if (!DOM.coinSearchInput.contains(e.target) && !DOM.coinSuggestionsDropdown.contains(e.target)) {
                DOM.coinSuggestionsDropdown.classList.add('hidden');
            }
        });
    }

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
 * Render Feld 2 Coin Suggestions Dropdown based on search query and selected chain
 */
function renderCoinSuggestions(query = '') {
    const coins = getCoinsForChain(state.selectedChain, query);
    if (!DOM.coinSuggestionsDropdown) return;

    if (coins.length === 0) {
        DOM.coinSuggestionsDropdown.innerHTML = '<div class="no-coins-msg">Keine passenden Coins gefunden</div>';
        DOM.coinSuggestionsDropdown.classList.remove('hidden');
        return;
    }

    let html = '';
    coins.forEach(coin => {
        html += `
            <div class="suggestion-item" data-id="${coin.id}">
                <div class="suggestion-line1">
                    <span class="suggest-name">${coin.name}</span>
                    <span class="suggest-symbol">(${coin.symbol})</span>
                </div>
                <div class="suggestion-line2">
                    <span class="suggest-addr-label">Adresse:</span>
                    <span class="suggest-addr-val">${coin.address}</span>
                </div>
            </div>
        `;
    });

    DOM.coinSuggestionsDropdown.innerHTML = html;
    DOM.coinSuggestionsDropdown.classList.remove('hidden');

    // Attach click handlers to suggestion items
    const items = DOM.coinSuggestionsDropdown.querySelectorAll('.suggestion-item');
    items.forEach(item => {
        item.addEventListener('click', () => {
            const coinId = item.getAttribute('data-id');
            const foundCoin = COIN_DATABASE.find(c => c.id === coinId);
            if (foundCoin) {
                selectCoin(foundCoin);
            }
            DOM.coinSuggestionsDropdown.classList.add('hidden');
        });
    });
}

/**
 * Select coin and trigger verification check & exchange rate updates
 */
async function selectCoin(coin) {
    state.selectedCoin = coin;
    state.fromSymbol = coin.symbol;

    if (DOM.coinSearchInput) {
        DOM.coinSearchInput.value = `${coin.name} (${coin.symbol})`;
    }
    if (DOM.selectedCoinNameDisplay) {
        DOM.selectedCoinNameDisplay.textContent = `${coin.name} (${coin.symbol})`;
    }
    if (DOM.selectedCoinAddressDisplay) {
        DOM.selectedCoinAddressDisplay.textContent = coin.address;
    }

    // Trigger verification check via Bitquery / BlockVision
    if (DOM.verificationStatusBadge) {
        DOM.verificationStatusBadge.textContent = 'verifying...';
        DOM.verificationStatusBadge.className = 'badge-verification pending';

        const result = await verifyCoinAddress(coin.chain, coin.address, coin.isNative);
        if (result.verified) {
            DOM.verificationStatusBadge.textContent = 'verified';
            DOM.verificationStatusBadge.className = 'badge-verification verified';
        } else {
            DOM.verificationStatusBadge.textContent = 'unverified';
            DOM.verificationStatusBadge.className = 'badge-verification unverified';
        }
    }

    updateSelectedCryptoDisplays(state.fromSymbol);

    // Sync chart selection if matching symbol exists in chart select dropdown
    const optExists = Array.from(DOM.chartCryptoSelect.options).some(opt => opt.value === state.fromSymbol);
    if (optExists && DOM.chartCryptoSelect.value !== state.fromSymbol) {
        DOM.chartCryptoSelect.value = state.fromSymbol;
        state.chartSymbol = state.fromSymbol;
        loadChartData(state.chartSymbol);
    }

    updateExchangeRates();
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
 * Setup Wallet Events
 */
function setupWalletEvents() {
    if (DOM.fetchWalletBtn) {
        DOM.fetchWalletBtn.addEventListener('click', () => {
            fetchAndDisplayWallet();
        });
    }
}

/**
 * Fetch and render Solflare wallet balances with live conversions
 */
async function fetchAndDisplayWallet() {
    const address = DOM.walletAddressInput ? DOM.walletAddressInput.value.trim() : '';
    if (!address) {
        DOM.walletResultsContainer.innerHTML = '<div class="wallet-error">Bitte eine gültige Solana-Adresse eingeben.</div>';
        return;
    }

    DOM.walletLoading.classList.remove('hidden');
    DOM.walletResultsContainer.innerHTML = '';

    try {
        const balances = await fetchSolanaWalletBalances(address);

        if (!balances || balances.length === 0) {
            DOM.walletResultsContainer.innerHTML = '<div class="empty-wallet-msg">Keine aktiven Token-Bestände in dieser Wallet gefunden.</div>';
            return;
        }

        let html = '<div class="wallet-assets-grid">';

        for (const item of balances) {
            let eurRate = null;
            let usdtRate = null;

            try {
                eurRate = await fetchBitvavoPrice(item.symbol);
            } catch (e) {
                console.warn(`Bitvavo rate unavailable for wallet asset ${item.symbol}`);
            }

            try {
                const binanceRes = await fetchBinancePrice(item.symbol, eurRate);
                usdtRate = binanceRes.price;
            } catch (e) {
                console.warn(`Binance rate unavailable for wallet asset ${item.symbol}`);
            }

            const eurTotal = eurRate ? item.amount * eurRate : null;
            const usdtTotal = usdtRate ? item.amount * usdtRate : null;

            const formattedAmount = item.amount.toLocaleString('de-DE', {
                minimumFractionDigits: 0,
                maximumFractionDigits: item.amount < 1 ? 6 : 2
            });

            html += `
                <div class="asset-card">
                    <div class="asset-header">
                        <span class="asset-symbol-badge">${item.symbol}</span>
                        <span class="asset-name">${item.name}</span>
                    </div>
                    <div class="asset-amount-display">
                        <span class="amount-val">${formattedAmount}</span>
                        <span class="amount-code">${item.symbol}</span>
                    </div>
                    <div class="asset-conversions">
                        <div class="conv-row">
                            <span class="conv-label">Bitvavo (EUR):</span>
                            <span class="conv-val text-success">${formatCurrency(eurTotal, 'EUR')}</span>
                        </div>
                        <div class="conv-row">
                            <span class="conv-label">Binance (USDT):</span>
                            <span class="conv-val text-amber">${formatCurrency(usdtTotal, 'USDT')}</span>
                        </div>
                    </div>
                    <button class="use-in-calc-btn" data-symbol="${item.symbol}" data-amount="${item.amount}">
                        ⇄ In Rechner übernehmen
                    </button>
                </div>
            `;
        }

        html += '</div>';
        DOM.walletResultsContainer.innerHTML = html;

        // Attach event listeners for "In Rechner übernehmen" buttons
        const useBtns = DOM.walletResultsContainer.querySelectorAll('.use-in-calc-btn');
        useBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const symbol = e.currentTarget.getAttribute('data-symbol');
                const amount = parseFloat(e.currentTarget.getAttribute('data-amount'));

                state.amount = amount;
                DOM.amountInput.value = amount;

                // Check if symbol exists in dropdown
                const optExists = Array.from(DOM.fromSelect.options).some(opt => opt.value === symbol);
                if (optExists) {
                    DOM.fromSelect.value = symbol;
                    state.fromSymbol = symbol;
                    updateSelectedCryptoDisplays(symbol);
                }

                updateExchangeRates();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
        });

    } catch (err) {
        console.error('Error loading Solana wallet:', err);
        DOM.walletResultsContainer.innerHTML = `<div class="wallet-error">Fehler beim Abrufen der Wallet-Daten: ${err.message}</div>`;
    } finally {
        DOM.walletLoading.classList.add('hidden');
    }
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
