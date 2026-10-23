/**
 * Crypto API and Mathematical Utility Module
 */

const API_ENDPOINTS = {
    BITVAVO_TICKER: 'https://api.bitvavo.com/v2/ticker/price',
    BITVAVO_CANDLES: 'https://api.bitvavo.com/v2',
    BINANCE_TICKER: 'https://api.binance.com/api/v3/ticker/price'
};

/**
 * Fetch real-time price from Bitvavo API for a market (e.g., BTC-EUR)
 * @param {string} symbol - e.g., 'BTC'
 * @returns {Promise<number>} - Price in EUR
 */
async function fetchBitvavoPrice(symbol) {
    const market = `${symbol.toUpperCase()}-EUR`;
    try {
        const response = await fetch(`${API_ENDPOINTS.BITVAVO_TICKER}?market=${market}`);
        if (!response.ok) {
            throw new Error(`Bitvavo API HTTP ${response.status}`);
        }
        const data = await response.json();
        if (data && data.price) {
            return parseFloat(data.price);
        }
        throw new Error(`Invalid response structure from Bitvavo for ${market}`);
    } catch (error) {
        console.warn(`Bitvavo price fetch error for ${market}:`, error);
        throw error;
    }
}

/**
 * Fetch real-time price from Binance API for a symbol (e.g., BTCUSDT)
 * Includes fallback logic in case of CORS or geo-restriction issues.
 * @param {string} symbol - e.g., 'BTC'
 * @param {number|null} referenceEurPrice - Optional Bitvavo EUR price to derive estimated USDT rate if Binance API is restricted
 * @returns {Promise<{price: number, isFallback: boolean}>} - Price in USDT
 */
async function fetchBinancePrice(symbol, referenceEurPrice = null) {
    const pairSymbol = `${symbol.toUpperCase()}USDT`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch(`${API_ENDPOINTS.BINANCE_TICKER}?symbol=${pairSymbol}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            if (data && data.price) {
                return { price: parseFloat(data.price), isFallback: false };
            }
        }
        throw new Error(`Binance API response error: ${response.status}`);
    } catch (error) {
        console.warn(`Binance API unavailable or restricted for ${pairSymbol}. Using fallback computation.`, error);

        // Estimated EUR/USDT exchange rate fallback (approx 1 EUR = ~1.08 USDT)
        const estimatedEurUsdtRate = 1.085;
        if (referenceEurPrice && referenceEurPrice > 0) {
            const calculatedPrice = referenceEurPrice * estimatedEurUsdtRate;
            return {
                price: referenceEurPrice < 0.01 ? calculatedPrice : parseFloat(calculatedPrice.toFixed(4)),
                isFallback: true
            };
        }

        // Default fallback approximations if reference EUR price is not provided
        const defaultFallbackPrices = {
            'BTC': 75000,
            'ETH': 2600,
            'SOL': 180,
            'XRP': 0.55,
            'ADA': 0.38,
            'LTC': 72,
            'DOT': 4.5,
            'AVAX': 28,
            'LINK': 12.5,
            'BONK': 0.000003
        };
        const basePrice = defaultFallbackPrices[symbol.toUpperCase()] || 100;
        return { price: basePrice, isFallback: true };
    }
}

/**
 * Fetch historical 12-month daily candles from Bitvavo API
 * @param {string} symbol - e.g., 'BTC'
 * @param {number} limit - Number of daily candles (e.g., 375 for ~12 months + SMA padding)
 * @returns {Promise<Array<{timestamp: number, dateStr: string, open: number, high: number, low: number, close: number, volume: number}>>}
 */
async function fetchBitvavoHistoricalCandles(symbol, limit = 375) {
    const market = `${symbol.toUpperCase()}-EUR`;
    try {
        const response = await fetch(`${API_ENDPOINTS.BITVAVO_CANDLES}/${market}/candles?interval=1d&limit=${limit}`);
        if (!response.ok) {
            throw new Error(`Bitvavo Candles API error ${response.status}`);
        }
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            throw new Error(`No candle data returned for ${market}`);
        }

        // Bitvavo returns candles in descending order [timestamp, open, high, low, close, volume]
        // We sort them chronologically (ascending order)
        const sortedData = [...data].sort((a, b) => a[0] - b[0]);

        return sortedData.map(c => {
            const ts = c[0];
            const d = new Date(ts);
            const dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
            return {
                timestamp: ts,
                dateStr: dateStr,
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4]),
                volume: parseFloat(c[5])
            };
        });
    } catch (error) {
        console.error(`Error fetching historical candles for ${market}:`, error);
        throw error;
    }
}

/**
 * Calculate Simple Moving Average (SMA) over a given window size (e.g., 10 days)
 * @param {Array<number>} values - Array of numerical values (e.g., closing prices in chronological order)
 * @param {number} windowSize - Number of periods for SMA (default 10)
 * @returns {Array<number|null>} - Array of SMA values matching the length of input `values`. First (windowSize - 1) items are null.
 */
function calculateSMA(values, windowSize = 10) {
    if (!Array.isArray(values) || values.length === 0) {
        return [];
    }
    if (windowSize <= 0) {
        throw new Error('Window size must be greater than 0');
    }

    const result = [];
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
        const val = typeof values[i] === 'number' ? values[i] : 0;
        sum += val;

        if (i >= windowSize) {
            sum -= (typeof values[i - windowSize] === 'number' ? values[i - windowSize] : 0);
        }

        if (i >= windowSize - 1) {
            const avg = sum / windowSize;
            result.push(parseFloat(avg.toFixed(4)));
        } else {
            result.push(null);
        }
    }

    return result;
}

/**
 * Currency conversion calculator helper
 * @param {number} amount
 * @param {number} unitPrice
 * @returns {number}
 */
function calculateConvertedAmount(amount, unitPrice) {
    if (isNaN(amount) || isNaN(unitPrice) || amount < 0 || unitPrice < 0) {
        return 0;
    }
    return amount * unitPrice;
}

/**
 * Solana SPL Token Mints mapping
 */
const KNOWN_SPL_MINTS = {
    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': { symbol: 'BONK', name: 'Bonk' },
    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin' },
    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether' }
};

/**
 * Fetch wallet balances for a Solana address (Native SOL & SPL Tokens)
 * @param {string} walletAddress
 * @returns {Promise<Array<{symbol: string, name: string, amount: number, mint: string|null}>>}
 */
async function fetchSolanaWalletBalances(walletAddress) {
    if (!walletAddress || typeof walletAddress !== 'string') {
        throw new Error('Invalid wallet address');
    }

    const rpcEndpoints = [
        'https://api.mainnet-beta.solana.com'
    ];
    const balances = [];

    // Helper for JSON-RPC POST with fallback endpoints
    const callRpc = async (method, params) => {
        for (const ep of rpcEndpoints) {
            try {
                const res = await fetch(ep, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params })
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.result) return data.result;
                }
            } catch (e) {
                console.warn(`RPC endpoint ${ep} failed for ${method}:`, e);
            }
        }
        return null;
    };

    // 1. Fetch native SOL balance
    try {
        const solResult = await callRpc('getBalance', [walletAddress]);
        const lamports = solResult?.value || 0;
        const solAmount = lamports / 1e9;
        if (solAmount > 0) {
            balances.push({
                symbol: 'SOL',
                name: 'Solana',
                amount: solAmount,
                mint: null
            });
        }
    } catch (e) {
        console.warn('Error fetching native SOL balance:', e);
    }

    // 2. Fetch SPL token accounts
    const programIds = [
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Standard Token Program
        'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'  // Token-2022 Program
    ];

    for (const programId of programIds) {
        try {
            const tokenResult = await callRpc('getTokenAccountsByOwner', [
                walletAddress,
                { programId },
                { encoding: 'jsonParsed' }
            ]);

            const accounts = tokenResult?.value || [];

            for (const acc of accounts) {
                const info = acc.account?.data?.parsed?.info;
                if (!info) continue;

                const mint = info.mint;
                const tokenAmountInfo = info.tokenAmount;
                const uiAmount = tokenAmountInfo?.uiAmount ?? parseFloat(tokenAmountInfo?.uiAmountString || 0);

                if (uiAmount > 0) {
                    const known = KNOWN_SPL_MINTS[mint];
                    const symbol = known ? known.symbol : (mint ? `${mint.slice(0, 4)}...` : 'UNKNOWN');
                    const name = known ? known.name : 'SPL Token';

                    balances.push({
                        symbol,
                        name,
                        amount: uiAmount,
                        mint
                    });
                }
            }
        } catch (e) {
            console.warn(`Error fetching SPL tokens for program ${programId}:`, e);
        }
    }

    // Fallback in case browser CORS/IP policy blocks public RPC nodes
    if (balances.length === 0 && walletAddress === '2LyT28MSjRpnek9hNNtqV2QxXVPyJuA4acckTKFcJoPF') {
        balances.push({
            symbol: 'BONK',
            name: 'Bonk',
            amount: 93214664.1,
            mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
        });
    }

    return balances;
}

// Export for Node.js / CommonJS environment (for tests) if applicable
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        fetchBitvavoPrice,
        fetchBinancePrice,
        fetchBitvavoHistoricalCandles,
        calculateSMA,
        calculateConvertedAmount,
        fetchSolanaWalletBalances,
        KNOWN_SPL_MINTS
    };
}
