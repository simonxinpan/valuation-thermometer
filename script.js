document.addEventListener('DOMContentLoaded', function() {
    // --- 初始数据源 ---
    const initialStockData = {
        ticker: "AAPL", companyName: "苹果公司", currentPrice: 172.50,
        metrics: [
            { id: 'growth', name: "营收增长率", stockValue: 8.1, industryValue: 10.0, unit: '%', direction: 'higher-is-better' },
            { id: 'roe', name: "净资产收益率", stockValue: 147.3, industryValue: 18.0, unit: '%', direction: 'higher-is-better' },
            { id: 'eps', name: "每股收益(EPS)", stockValue: 5.89, industryValue: 4.5, unit: '$', direction: 'higher-is-better' },
            { id: 'dividend', name: "股息率", stockValue: 1.1, industryValue: 1.5, unit: '%', direction: 'higher-is-better' },
            { id: 'margin', name: "净利润率", stockValue: 25.3, industryValue: 12.0, unit: '%', direction: 'higher-is-better' },
            { id: 'fcf', name: "自由现金流/营收", stockValue: 28.1, industryValue: 15.0, unit: '%', direction: 'higher-is-better' },
            { id: 'pe', name: "市盈率(PE)", stockValue: 28.5, industryValue: 25.0, direction: 'lower-is-better' },
            { id: 'pb', name: "市净率(PB)", stockValue: 4.8, industryValue: 5.5, direction: 'lower-is-better' },
            { id: 'ps', name: "市销率(PS)", stockValue: 7.2, industryValue: 4.0, direction: 'lower-is-better' },
            { id: 'debt', name: "资产负债率", stockValue: 79.8, industryValue: 60.0, unit: '%', direction: 'lower-is-better' },
        ]
    };

    let currentStockData = JSON.parse(JSON.stringify(initialStockData)); 
    let mainGaugeChart = echarts.init(document.getElementById('main-gauge'));
    let summaryChart = echarts.init(document.getElementById('summary-chart'));
    const elements = {
        timestamp: document.getElementById('timestamp'), currentPrice: document.getElementById('current-price'),
        summaryText: document.getElementById('summary-text'),
        higherBetterGrid: document.getElementById('higher-is-better-grid'), higherBetterList: document.getElementById('higher-is-better-list'),
        lowerBetterGrid: document.getElementById('lower-is-better-grid'), lowerBetterList: document.getElementById('lower-is-better-list'),
        viewToggleGaugeBtn: document.getElementById('view-toggle-gauge'),
        viewToggleListBtn: document.getElementById('view-toggle-list'), reanalyzeBtn: document.getElementById('re-analyze-btn')
    };
    const colors = { undervalued: '#2E93fA', fair: '#67C23A', overvalued: '#FF9800', high_risk: '#F56C6C' };
    
    function calculateRiskValue(stockValue, industryValue, direction) {
        if (industryValue === 0) return 50;
        const ratio = stockValue / industryValue;
        let riskValue = direction === 'lower-is-better' ? 50 * ratio : 50 / ratio;
        return Math.max(0, Math.min(100, riskValue));
    }

    function getValuationStatus(riskValue) {
        const roundedValue = Math.round(riskValue);
        if (roundedValue <= 35) return { text: '低估', color: colors.undervalued };
        if (roundedValue <= 65) return { text: '合理估值', color: colors.fair };
        if (roundedValue <= 85) return { text: '高估', color: colors.overvalued };
        return { text: '风险', color: colors.high_risk };
    }
    
    function updateMainGauge(riskValue) {
        const status = getValuationStatus(riskValue);
        const option = {
            series: [{
                type: 'gauge', startAngle: 180, endAngle: 0,
                animationDurationUpdate: 1000, animationEasingUpdate: 'cubicInOut',
                min: 0, max: 100, splitNumber: 100, // Use 100 splits for precise label positioning
                progress: { show: true, width: 30, roundCap: true, itemStyle: { color: status.color } },
                axisLine: {
                    roundCap: true,
                    lineStyle: { width: 30,
                        color: [[0.35, colors.undervalued], [0.65, colors.fair], [0.85, colors.overvalued], [1, colors.high_risk]]
                    }
                },
                axisTick: { show: false },
                splitLine: { show: false },
                axisLabel: {
                    distance: -20, fontSize: 12,
                    formatter: function (value) {
                        if (value === 17) return '{undervalued|低估}';
                        if (value === 50) return '{fair|合理估值}';
                        if (value === 75) return '{overvalued|高估}';
                        if (value === 93) return '{risk|风险}';
                        return '';
                    },
                    rich: {
                        undervalued: { color: 'white', fontWeight: 'bold', padding: [0, 0, 0, 5] },
                        fair: { color: 'white', fontWeight: 'bold' },
                        overvalued: { color: 'white', fontWeight: 'bold' },
                        risk: { color: 'white', fontWeight: 'bold', padding: [0, 5, 0, 0] }
                    }
                },
                pointer: { length: '60%', width: 6, itemStyle: { color: 'auto' } },
                anchor: { show: true, showAbove: true, size: 20, itemStyle: { borderWidth: 5, borderColor: '#fff' } },
                detail: {
                    valueAnimation: true, offsetCenter: [0, '-15%'],
                    fontSize: 60, fontWeight: 'bold', formatter: (v) => `${Math.round(v)}`, color: status.color
                },
                title: { offsetCenter: [0, '25%'], fontSize: 28, fontWeight: 'bold', color: status.color },
                data: [{ value: riskValue, name: status.text }]
            }]
        };
        mainGaugeChart.setOption(option, true);
    }

    function renderMetricGroup(metrics, gridContainer, listContainer) {
        gridContainer.innerHTML = ''; listContainer.innerHTML = '';
        const sortedMetrics = [...metrics].sort((a, b) => a.riskValue - b.riskValue);
        sortedMetrics.forEach(metric => {
            const status = getValuationStatus(metric.riskValue);
            const unit = metric.unit || '';
            const ratio = (metric.stockValue / metric.industryValue).toFixed(2);
            
            const card = document.createElement('div');
            card.className = 'metric-card';
            card.style.borderColor = status.color;
            card.innerHTML = `
                <div class="metric-name">${metric.name}</div>
                <div class="mini-gauge" id="mini-gauge-${metric.id}"></div>
                <div class="metric-details">个股: ${metric.stockValue.toFixed(2)}${unit} / 行业: ${metric.industryValue}${unit}</div>
                <div class="metric-ratio">${ratio}x</div>
                <div class="metric-status" style="background-color: ${status.color};">${status.text}</div>`;
            gridContainer.appendChild(card);
            
            let miniGaugeChart = echarts.init(document.getElementById(`mini-gauge-${metric.id}`));
            miniGaugeChart.setOption({
                 series: [{
                    type: 'gauge', center: ['50%', '70%'], startAngle: 180, endAngle: 0,
                    min: 0, max: 100, itemStyle: { color: status.color },
                    progress: { show: true, width: 8, roundCap: true }, axisLine: { lineStyle: { width: 8 } },
                    axisTick: { show: false }, splitLine: { show: false }, axisLabel: { show: false }, pointer: { show: false },
                    detail: { valueAnimation: true, offsetCenter: [0, '-10%'], fontSize: 22, fontWeight: 'bold', color: status.color, formatter: (v) => `${Math.round(v)}`},
                    data: [{ value: metric.riskValue }]
                }]
            });
            
            const item = document.createElement('div');
            item.className = 'list-item';
            item.style.borderColor = status.color;
            item.innerHTML = `
                <div class="list-item-main">
                    <div class="list-item-name">${metric.name}</div>
                    <div class="list-item-values">个股: ${metric.stockValue.toFixed(2)}${unit} / 行业: ${metric.industryValue}${unit}</div>
                </div>
                <div class="list-item-score">
                    <div class="list-item-ratio">${ratio}x</div>
                    <div class="list-item-badge" style="background-color: ${status.color};">${status.text}</div>
                </div>`;
            listContainer.appendChild(item);
        });
    }

    function updateSummary() {
        const counts = { undervalued: 0, fair: 0, overvalued: 0, risk: 0 };
        currentStockData.metrics.forEach(metric => {
            const status = getValuationStatus(metric.riskValue);
            if (status.text === '低估') counts.undervalued++;
            else if (status.text === '合理估值') counts.fair++;
            else if (status.text === '高估') counts.overvalued++;
            else if (status.text === '风险') counts.risk++;
        });

        // Update bar chart
        summaryChart.setOption({
            grid: { left: 0, right: 0, top: 0, bottom: 0 },
            xAxis: { show: false, max: currentStockData.metrics.length },
            yAxis: { show: false, type: 'category' },
            animationDurationUpdate: 500,
            series: [
                { name: '低估', type: 'bar', stack: 'total', itemStyle: { color: colors.undervalued }, label: { show: true, color: '#fff' }, data: [counts.undervalued] },
                { name: '合理估值', type: 'bar', stack: 'total', itemStyle: { color: colors.fair }, label: { show: true, color: '#fff' }, data: [counts.fair] },
                { name: '高估', type: 'bar', stack: 'total', itemStyle: { color: colors.overvalued }, label: { show: true, color: '#fff' }, data: [counts.overvalued] },
                { name: '风险', type: 'bar', stack: 'total', itemStyle: { color: colors.high_risk }, label: { show: true, color: '#fff' }, data: [counts.risk] },
            ]
        }, true);
        
        // Update summary text
        const textParts = [];
        if (counts.undervalued > 0) textParts.push(`<span style="color:${colors.undervalued}; font-weight:bold;">${counts.undervalued}个低估</span>`);
        if (counts.fair > 0) textParts.push(`<span style="color:${colors.fair}; font-weight:bold;">${counts.fair}个合理估值</span>`);
        if (counts.overvalued > 0) textParts.push(`<span style="color:${colors.overvalued}; font-weight:bold;">${counts.overvalued}个高估</span>`);
        if (counts.risk > 0) textParts.push(`<span style="color:${colors.high_risk}; font-weight:bold;">${counts.risk}个风险</span>`);
        
        elements.summaryText.innerHTML = `发现: ${textParts.join(', ')} 指标`;
    }

    function processData() {
        currentStockData.metrics.forEach(m => { m.riskValue = calculateRiskValue(m.stockValue, m.industryValue, m.direction); });
        const totalRisk = currentStockData.metrics.reduce((sum, m) => sum + m.riskValue, 0);
        currentStockData.overallRiskValue = totalRisk / currentStockData.metrics.length;
    }

    function simulateDataUpdate() {
        currentStockData.metrics.forEach(metric => { metric.stockValue *= (1 + (Math.random() - 0.5) * 0.1); });
        currentStockData.currentPrice *= (1 + (Math.random() - 0.5) * 0.02);
        processData();
    }

    function runAnalysis() {
        updateMainGauge(currentStockData.overallRiskValue);
        updateSummary();
        const higherIsBetterMetrics = currentStockData.metrics.filter(m => m.direction === 'higher-is-better');
        const lowerIsBetterMetrics = currentStockData.metrics.filter(m => m.direction === 'lower-is-better');
        renderMetricGroup(higherIsBetterMetrics, elements.higherBetterGrid, elements.higherBetterList);
        renderMetricGroup(lowerIsBetterMetrics, elements.lowerBetterGrid, elements.lowerBetterList);
        elements.currentPrice.textContent = `$${currentStockData.currentPrice.toFixed(2)}`;
        elements.timestamp.textContent = `数据更新于: ${new Date().toLocaleString('zh-CN', { hour12: false })}`;
    }

    // --- Event Listeners & Initialization ---
    elements.viewToggleGaugeBtn.addEventListener('click', () => {
        elements.viewToggleGaugeBtn.classList.add('active'); elements.viewToggleListBtn.classList.remove('active');
        elements.higherBetterGrid.style.display = 'grid'; elements.lowerBetterGrid.style.display = 'grid';
        elements.higherBetterList.style.display = 'none'; elements.lowerBetterList.style.display = 'none';
    });
    elements.viewToggleListBtn.addEventListener('click', () => {
        elements.viewToggleListBtn.classList.add('active'); elements.viewToggleGaugeBtn.classList.remove('active');
        elements.higherBetterList.style.display = 'flex'; elements.lowerBetterList.style.display = 'flex';
        elements.higherBetterGrid.style.display = 'none'; elements.lowerBetterGrid.style.display = 'none';
    });
    elements.reanalyzeBtn.addEventListener('click', () => {
        elements.reanalyzeBtn.disabled = true; elements.reanalyzeBtn.textContent = '分析中...';
        setTimeout(() => {
            simulateDataUpdate(); runAnalysis();
            elements.reanalyzeBtn.disabled = false; elements.reanalyzeBtn.textContent = '重新分析';
        }, 800);
    });
    function initialize() { processData(); runAnalysis(); }
    initialize();
    window.addEventListener('resize', () => {
        mainGaugeChart.resize();
        summaryChart.resize();
        currentStockData.metrics.forEach(metric => {
            const chartInstance = echarts.getInstanceByDom(document.getElementById(`mini-gauge-${metric.id}`));
            if (chartInstance) chartInstance.resize();
        });
    });
});