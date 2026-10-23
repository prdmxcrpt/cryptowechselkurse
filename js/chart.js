/**
 * Chart rendering module for 12-Month historical exchange rates and 10-day SMA
 */

let cryptoChartInstance = null;

/**
 * Renders or updates Chart.js line chart
 * @param {string} symbol - Crypto symbol (e.g., BTC)
 * @param {Array<{dateStr: string, close: number}>} candleData - Chronological daily candles
 * @param {Array<number|null>} smaData - 10-day SMA values matching candleData length
 */
function renderHistoricalChart(symbol, candleData, smaData) {
    const canvas = document.getElementById('cryptoHistoryChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const labels = candleData.map(c => c.dateStr);
    const prices = candleData.map(c => c.close);

    // Destroy existing chart instance if present
    if (cryptoChartInstance) {
        cryptoChartInstance.destroy();
    }

    // Gradient fill for daily price line
    const priceGradient = ctx.createLinearGradient(0, 0, 0, 350);
    priceGradient.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
    priceGradient.addColorStop(1, 'rgba(56, 189, 248, 0.0)');

    cryptoChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${symbol}/EUR Tageskurs`,
                    data: prices,
                    borderColor: '#38bdf8',
                    backgroundColor: priceGradient,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: '#38bdf8',
                    pointHoverBorderColor: '#ffffff',
                    order: 2
                },
                {
                    label: '10-Tage SMA',
                    data: smaData,
                    borderColor: '#f59e0b',
                    borderWidth: 2.5,
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0.2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    pointHoverBackgroundColor: '#f59e0b',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: false // We use custom legend overlay
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('de-DE', {
                                    style: 'currency',
                                    currency: 'EUR'
                                }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(51, 65, 85, 0.4)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        maxTicksLimit: 12,
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(51, 65, 85, 0.4)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#94a3b8',
                        font: {
                            size: 11
                        },
                        callback: function(value) {
                            return new Intl.NumberFormat('de-DE', {
                                style: 'currency',
                                currency: 'EUR',
                                maximumFractionDigits: value < 10 ? 4 : 2
                            }).format(value);
                        }
                    }
                }
            }
        }
    });
}
