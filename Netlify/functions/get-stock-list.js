// netlify/functions/get-stock-list.js

const fetch = require('node-fetch');

// --- 安全地从Netlify环境变量中读取您的API密钥 ---
const EODHD_API_KEY = process.env.VITE_EODHD_API_KEY;
const FINNHUB_API_KEY = process.env.VITE_FINNHUB_API_KEY;

// --- MVP阶段，我们先聚焦这10只股票作为榜单 ---
const STOCK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'JNJ', 'V'];

/**
 * 这是一个辅助函数，用于获取单只股票的详细数据。
 * 它包含了我们讨论的“容错机制”。
 * @param {string} ticker - 股票代码, e.g., 'AAPL'
 * @returns {Promise<object|null>} - 包含处理好数据的对象，或在失败时返回null
 */
async function getStockDetails(ticker) {
    try {
        // --- 数据源1：主数据源 (eodhd - 您的付费API) ---
        const eodhdUrl = `https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${EODHD_API_KEY}&fmt=json`;
        const eodhdResponse = await fetch(eodhdUrl);
        if (!eodhdResponse.ok) throw new Error(`eodhd API failed for ${ticker}`); // 如果API失败，会抛出错误，进入catch块

        const eodhdData = await eodhdResponse.json();
        const highlights = eodhdData.Highlights || {};
        const general = eodhdData.General || {};

        // --- 数据源2：备用和补充数据源 (Finnhub) ---
        const finnhubMetricUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_API_KEY}`;
        const finnhubProfileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
        
        // 并行请求Finnhub的数据，提高效率
        const [metricRes, profileRes] = await Promise.all([
            fetch(finnhubMetricUrl),
            fetch(finnhubProfileUrl)
        ]);

        const finnhubMetric = metricRes.ok ? (await metricRes.json()).metric : {};
        const finnhubProfile = profileRes.ok ? await profileRes.json() : {};

        // --- 数据整合与容错 ---
        // 规则：优先用eodhd，如果eodhd没有，再尝试用Finnhub的数据
        const stockData = {
            ticker: ticker,
            name: general.Name || finnhubProfile.name || ticker,
            logo: finnhubProfile.logo || `https://eodhd.com${general.LogoURL}` || '', // Finnhub的logo通常质量更高
            pe: highlights.PERatio || finnhubMetric.peNormalizedAnnual,
            pb: highlights.PBRatio || finnhubMetric.pbAnnual,
            dividendYield: highlights.DividendYield || finnhubMetric.dividendYieldIndicatedAnnual,
            // 在这里添加您需要的其他8个指标，遵循 "eodhd || finnhub" 的模式
        };

        // 如果连最基本的PE和PB都没有，我们认为这条数据是无效的
        if (!stockData.pe || !stockData.pb) {
            console.warn(`Incomplete data for ${ticker}. Skipping.`);
            return null;
        }

        // --- 行业均值计算 (利用Finnhub Peers) ---
        const peersRes = await fetch(`https://finnhub.io/api/v1/stock/peers?symbol=${ticker}&token=${FINNHUB_API_KEY}`);
        const peers = peersRes.ok ? await peersRes.json() : [];
        
        let totalIndustryPE = 0;
        let validPeers = 0;
        if (peers && peers.length > 1) {
            // 取前5个同业公司计算均值，避免API调用过多和超时
            const peersToFetch = peers.slice(1, 6);
            for (const peer of peersToFetch) {
                const peerMetricRes = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${peer}&metric=all&token=${FINNHUB_API_KEY}`);
                if(peerMetricRes.ok) {
                    const peerMetric = (await peerMetricRes.json()).metric;
                    if (peerMetric && peerMetric.peNormalizedAnnual > 0) {
                        totalIndustryPE += peerMetric.peNormalizedAnnual;
                        validPeers++;
                    }
                }
            }
        }
        stockData.industryAvgPE = (validPeers > 0) ? (totalIndustryPE / validPeers).toFixed(2) : stockData.pe.toFixed(2);

        return stockData;

    } catch (error) {
        console.error(`Error fetching details for ${ticker}:`, error.message);
        return null; // 确保任何失败都会返回null，而不是让整个函数崩溃
    }
}

/**
 * 这是Netlify函数的主入口 (Handler)
 */
exports.handler = async function(event, context) {
    if (!EODHD_API_KEY || !FINNHUB_API_KEY) {
        return { statusCode: 500, body: "API keys are not configured." };
    }

    const promises = STOCK_TICKERS.map(ticker => getStockDetails(ticker));
    const results = await Promise.all(promises);

    // 过滤掉所有获取失败的股票 (结果为null的)
    const successfulResults = results.filter(res => res !== null);

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(successfulResults),
    };
};