const assessmentData = [
    { id: 0, test: "DASS-21", sub: "Depression", score: 2, threshold: 9, direction: "Lower the better", mean: 5.43, sd: 6.18, weight: 1/14 },
    { id: 1, test: "DASS-21", sub: "Anxiety", score: 0, threshold: 7, direction: "Lower the better", mean: 6.82, sd: 6.17, weight: 1/14 },
    { id: 2, test: "DASS-21", sub: "Stress", score: 12, threshold: 14, direction: "Lower the better", mean: 8.82, sd: 7.27, weight: 1/14 },
    { id: 3, test: "BFI-2-S", sub: "Conscientiousness", score: 3.17, threshold: 3.1, direction: "Higher the better", mean: 3.45, sd: 0.69, weight: 1/14 },
    { id: 4, test: "BFI-2-S", sub: "Negative Emotionality", score: 1.83, threshold: 3.3, direction: "Lower the better", mean: 2.94, sd: 0.77, weight: 1/14 },
    { id: 5, test: "BFI-2-S", sub: "Agreeableness", score: 4.17, threshold: 3.3, direction: "Higher the better", mean: 3.65, sd: 0.61, weight: 1/14 },
    { id: 6, test: "FSES", sub: "Overall", score: 29, threshold: 21, direction: "Higher the better", mean: 20.48, sd: 4.2, weight: 1/14 },
    { id: 7, test: "GSE", sub: "Overall", score: 48, threshold: 35, direction: "Higher the better", mean: 23.05, sd: 4.39, weight: 1/14 },
    { id: 8, test: "CFC", sub: "Overall", score: 43, threshold: 33, direction: "Higher the better", mean: 32.7, sd: 5, weight: 1/14 },
    { id: 9, test: "MLQ", sub: "Presence of Meaning", score: 11, threshold: 16, direction: "Higher the better", mean: 23.63, sd: 5.68, weight: 1/14 },
    { id: 10, test: "Growth Mindset", sub: "Overall", score: 3.38, threshold: 2.4, direction: "Higher the better", mean: 3.08, sd: 0.83, weight: 1/14 },
    { id: 11, test: "MAS", sub: "Retention-Time", score: 4, threshold: 2.9, direction: "Higher the better", mean: 2.87, sd: 1.0, weight: 1/14 },
    { id: 12, test: "MAS", sub: "Power-Prestige", score: 1.78, threshold: 2.5, direction: "Lower the better", mean: 2.04, sd: 1.0, weight: 1/14 },
    { id: 13, test: "BIS-11", sub: "Overall", score: 19, threshold: 10.48, direction: "Lower the better", mean: 8.61, sd: 3.57, weight: 1/14 }
];

const tuTable = [
    { score: 0, grade: "A+", pd: 0.0000 },
    { score: 371, grade: "A", pd: 0.0013 },
    { score: 650, grade: "B", pd: 0.0028 },
    { score: 705, grade: "C", pd: 0.0098 },
    { score: 760, grade: "D", pd: 0.0117 },
    { score: 803, grade: "E", pd: 0.0191 },
    { score: 847, grade: "F", pd: 0.0277 },
    { score: 890, grade: "G", pd: 0.0531 },
    { score: 937, grade: "H", pd: 0.1154 },
    { score: 990, grade: "I", pd: 0.9949 },
    { score: 1000, grade: "J", pd: 1.0 }
];

const sliderMaxScores = [42, 42, 42, 5, 5, 5, 30, 50, 50, 25, 5, 5, 5, 35];

const newAdjustmentFactor = 84.65 / 61;
const conversionFactor = 1000;
let charts = {};

function erf(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    const sign = (x >= 0) ? 1 : -1;
    x = Math.abs(x);
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
}

function cumulativeDistribution(z) {
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
}

function probabilityDensity(x, mean, sd) {
    if (sd <= 0) return 0;
    return (1 / (sd * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mean) / sd, 2));
}

function calculateAll() {
    let weightedPercentileSum = 0;

    assessmentData.forEach(test => {
        const zScore = test.sd > 0 ? (test.score - test.mean) / test.sd : 0;
        const percentile = cumulativeDistribution(zScore);
        
        let normalizedPercentile;
        if (test.direction === "Lower the better") {
            normalizedPercentile = percentile;
        } else {
            normalizedPercentile = 1 - percentile;
        }
        
        weightedPercentileSum += normalizedPercentile * test.weight;
    });

    const finalPsychometricScore = weightedPercentileSum;
    const normalizedScore = finalPsychometricScore * conversionFactor * newAdjustmentFactor;

    let tuGrade = "J";
    let pd = 1.0;

    for (let i = 0; i < tuTable.length; i++) {
        if (normalizedScore <= tuTable[i].score) {
            tuGrade = tuTable[i].grade;
            pd = tuTable[i].pd;
            break;
        }
    }
    updateUI(normalizedScore, tuGrade, pd);
}

function updateUI(normalizedScore, tuGrade, pd) {
    document.getElementById('norm-score').textContent = normalizedScore.toFixed(2);
    document.getElementById('tu-grade').textContent = tuGrade;
    document.getElementById('pd').textContent = (pd * 100).toFixed(2) + '%';
    
    updateTable();
    updateOverallChart(normalizedScore);
    updateSubCharts();
}

function updateTable() {
    const tableBody = document.getElementById('results-table-body');
    tableBody.innerHTML = '';

    assessmentData.forEach(test => {
        let pass = false;
        if (test.direction === "Lower the better") {
            pass = test.score <= test.threshold;
        } else {
            pass = test.score >= test.threshold;
        }
        const scoreDisplay = typeof test.score === 'number' ? test.score.toFixed(1) : 'N/A';
        const row = `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${test.test}${test.sub !== 'Overall' ? ` - ${test.sub}` : ''}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${scoreDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${test.threshold} (${test.direction.split(' ')[0]})</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${pass ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${pass ? 'Pass' : 'Fail'}
                    </span>
                </td>
            </tr>
        `;
        tableBody.innerHTML += row;
    });
}

function createOverallChart() {
    const gradeColors = ['#28a745', '#52b545', '#7cc346', '#a5d146', '#cfde47', '#f8eb48', '#f9c83a', '#f9a52b', '#f9811d', '#f95e0e', '#f93a00'];
    const datasets = [];
    let lastScore = 0;

    tuTable.forEach((grade, index) => {
        datasets.push({
            label: grade.grade,
            data: [grade.score - lastScore],
            backgroundColor: gradeColors[index % gradeColors.length],
            barPercentage: 1.0,
            categoryPercentage: 1.0,
        });
        lastScore = grade.score;
    });

    const ctx = document.getElementById('overallDistributionChart').getContext('2d');
    const chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [''],
            datasets: datasets
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    min: 0,
                    max: 1000,
                    title: { display: true, text: 'Normalized Score' }
                },
                y: {
                    stacked: true,
                    display: false
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { 
                    enabled: true,
                    callbacks: {
                        label: function(context) {
                            return ` ${context.dataset.label}: Up to ${tuTable[context.datasetIndex].score}`;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        userScoreLine: {
                            type: 'line',
                            scaleID: 'x',
                            value: 0,
                            borderColor: '#ffd700',
                            borderWidth: 4,
                            label: {
                                content: 'Your Score',
                                enabled: true,
                                position: 'start',
                                backgroundColor: 'rgba(0,0,0,0.6)',
                                yAdjust: -15,
                            }
                        }
                    }
                }
            }
        }
    });
    charts.overall = chart;
}

function updateOverallChart(userScore) {
    const chart = charts.overall;
    if (!chart) return;
    
    if (chart.options.plugins.annotation && chart.options.plugins.annotation.annotations) {
        chart.options.plugins.annotation.annotations.userScoreLine.value = userScore;
        chart.options.plugins.annotation.annotations.userScoreLine.label.content = `Your Score: ${userScore.toFixed(2)}`;
    }
    chart.update();
}

function createSubCharts() {
    const container = document.getElementById('sub-charts-container');
    container.innerHTML = '';
    assessmentData.forEach(test => {
        const chartId = `subchart-${test.id}`;
        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'sub-chart-container';
        const canvas = document.createElement('canvas');
        canvas.id = chartId;
        chartWrapper.appendChild(canvas);
        container.appendChild(chartWrapper);

        const directionArrow = test.direction === 'Higher the better' ? '↑ Higher' : '↓ Lower';
        const chartTitle = `${test.test}${test.sub !== 'Overall' ? ` - ${test.sub}` : ''} (${directionArrow} is better)`;

        const ctx = canvas.getContext('2d');
        const chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ data: [] }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { 
                    y: { display: false }, 
                    x: { 
                        display: true,
                        type: 'linear'
                    } 
                },
                plugins: {
                    legend: { display: false },
                    title: { 
                        display: true, 
                        text: chartTitle, 
                        padding: { top: 10, bottom: 5 } 
                    },
                    tooltip: { enabled: true },
                    annotation: {
                        annotations: {
                            thresholdLine: {
                                type: 'line',
                                scaleID: 'x',
                                value: test.threshold,
                                borderColor: '#333333',
                                borderWidth: 2,
                                label: { content: 'Threshold', enabled: true, position: 'start', yAdjust: -15 }
                            },
                            userScoreLine: {
                                type: 'line',
                                scaleID: 'x',
                                value: test.score,
                                borderColor: '#ffd700',
                                borderWidth: 3,
                                label: { content: 'Score', enabled: true, position: 'start' }
                            }
                        }
                    }
                }
            }
        });
        charts[chartId] = chart;
    });
    updateSubCharts();
}

function updateSubCharts() {
    assessmentData.forEach(test => {
        const chartId = `subchart-${test.id}`;
        const chart = charts[chartId];
        if (!chart) return;

        const labels = [];
        const data = [];
        
        const importantPoints = [test.mean, test.score, test.threshold];
        const sd = test.sd > 0 ? test.sd : 1;
        const minX = Math.max(0, Math.min(...importantPoints) - sd * 1.5);
        const maxX = Math.max(...importantPoints) + sd * 1.5;

        const step = (maxX - minX) / 100;

        for (let x = minX; x <= maxX; x += step) {
            labels.push(x);
            data.push(probabilityDensity(x, test.mean, test.sd));
        }
        
        chart.options.scales.x.min = minX;
        chart.options.scales.x.max = maxX;

        chart.data.labels = labels;
        chart.data.datasets = [{
            label: 'Distribution',
            data: data,
            borderColor: '#002e5d',
            backgroundColor: 'rgba(0, 46, 93, 0.1)',
            borderWidth: 2,
            fill: true,
            pointRadius: 0,
            tension: 0.4
        }];

        if (chart.options.plugins.annotation && chart.options.plugins.annotation.annotations) {
            const pass = (test.direction === "Lower the better") ? (test.score <= test.threshold) : (test.score >= test.threshold);
            chart.options.plugins.annotation.annotations.userScoreLine.value = test.score;
            chart.options.plugins.annotation.annotations.thresholdLine.value = test.threshold;
            chart.options.plugins.annotation.annotations.userScoreLine.borderColor = pass ? '#ffd700' : '#dc3545';
        }
        chart.update();
    });
}

function createSliders() {
    const container = document.getElementById('sliders-container');
    container.innerHTML = '';
    assessmentData.forEach(test => {
        const testName = `${test.test}${test.sub !== 'Overall' ? ` - ${test.sub}` : ''}`;
        const maxScore = sliderMaxScores[test.id];
        
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <label for="slider-${test.id}" class="block text-sm font-medium">${testName}</label>
            <div class="flex items-center space-x-2">
                    <input type="range" id="slider-${test.id}" min="0" max="${maxScore}" value="${test.score}" step="0.1" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb">
                    <span id="slider-value-${test.id}" class="text-sm font-semibold w-12 text-right">${test.score.toFixed(1)}</span>
            </div>
        `;
        container.appendChild(wrapper);

        const slider = document.getElementById(`slider-${test.id}`);
        const valueDisplay = document.getElementById(`slider-value-${test.id}`);

        slider.addEventListener('input', (e) => {
            const newValue = parseFloat(e.target.value);
            assessmentData[test.id].score = newValue;
            valueDisplay.textContent = newValue.toFixed(1);
            calculateAll();
        });
    });
}

function switchTab(tabName) {
    const summaryTab = document.getElementById('tab-summary');
    const analysisTab = document.getElementById('tab-analysis');
    const summaryContent = document.getElementById('content-summary');
    const analysisContent = document.getElementById('content-analysis');

    if (tabName === 'summary') {
        summaryTab.classList.replace('tab-inactive', 'tab-active');
        analysisTab.classList.replace('tab-active', 'tab-inactive');
        summaryContent.classList.remove('hidden');
        analysisContent.classList.add('hidden');
    } else {
        analysisTab.classList.replace('tab-inactive', 'tab-active');
        summaryTab.classList.replace('tab-active', 'tab-inactive');
        analysisContent.classList.remove('hidden');
        summaryContent.classList.add('hidden');
    }
}

window.onload = () => {
    createSliders();
    createOverallChart();
    createSubCharts();
    calculateAll();
};

