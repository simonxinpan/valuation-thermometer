// netlify/functions/get-stock-list.js (SIMPLIFIED VERSION)

const fetch = require('node-fetch');

const EODHD_API_KEY = process.env.VITE_EODHD_API_KEY;
const FINNHUB_API_KEY = process.env.VITE_FINNHUB_API_KEY;

const STOCK_TICKERS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'TSLA', 'META', 'JPM', 'JNJ', 'V'];

async function getStockDetails(ticker) {
    try {
        const eodhdUrl = `https://eodhd.com/api/fundamentals/${ticker}.US?api_token=${EODHD_API_KEY}&fmt=json`;
        const eodhdResponse = await fetch(eodhdUrl);
        if (!eodhdResponse.ok) throw new Error(`eodhd API failed for ${ticker}`);

        const eodhdData = await eodhdResponse.json();
        const highlights = eodhdData.Highlights || {};
        const general = eodhdData.General || {};

        const finnhubProfileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
        const profileRes = await fetch(finnhubProfileUrl);
        const finnhubProfile = profileRes.ok ? await profileRes.json() : {};

        const stockData = {
            ticker: ticker,
            name: general.Name || finnhubProfile.name || ticker,
            logo: finnhubProfile.logo || `https://eodhd.com${general.LogoURL}` || '',
            pe: highlights.PERatio,
            pb: highlights.PBRatio,
            dividendYield: highlights.DividendYield,
            // --- 行业均值计算被暂时移除以避免超时 ---
            industryAvgPE: null // 暂时返回null
        };

        if (!stockData.pe) {
            return null;
        }
        
        return stockData;

    } catch (error) {
        console.error(`Error fetching details for ${ticker}:`, error.message);
        return null;
    }
}

exports.handler = async function(event, context) {
    if (!EODHD_API_KEY || !FINNHUB_API_KEY) {
        return { statusCode: 500, body: "API keys are not configured." };
    }

    const promises = STOCK_TICKERS.map(ticker => getStockDetails(ticker));
    const results = await Promise.all(promises);
    
    const successfulResults = results.filter(res => res !== null);

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(successfulResults),
    };
};