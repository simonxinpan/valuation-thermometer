// netlify/functions/get-stock-list.js (SIMPLIFIED VERSION TO PREVENT TIMEOUT)

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
        
        // 为了提高速度，我们只获取最核心的数据
        const stockData = {
            ticker: ticker,
            name: general.Name || ticker,
            pe: highlights.PERatio,
            pb: highlights.PBRatio,
            dividendYield: highlights.DividendYield,
            industryAvgPE: null // 行业均值计算已移除，以避免超时
        };

        // 如果连PE都没有，就跳过这只股票
        if (!stockData.pe) {
            console.warn(`Incomplete PE for ${ticker}. Skipping.`);
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