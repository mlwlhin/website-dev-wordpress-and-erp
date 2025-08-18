/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

const assessmentData = [
    { id: 0, test: "BFI-2-S", sub: "Conscientiousness", score: 5, threshold: 3.0, direction: "Higher the better", mean: 3.29, sd: 0.59, weight: 0.3, area: 'R', maxScore: 5, minScore: 1 },
    { id: 1, test: "BFI-2-S", sub: "Negative Emotionality", score: 1, threshold: 3.3, direction: "Lower the better", mean: 2.96, sd: 0.67, weight: 0.15, area: 'L', maxScore: 5, minScore: 1 },
    { id: 2, test: "BFI-2-S", sub: "Agreeableness", score: 5, threshold: 3.4, direction: "Higher the better", mean: 3.69, sd: 0.47, weight: 0, area: 'R', maxScore: 5, minScore: 1 },
    { id: 3, test: "BFI-2-S", sub: "Extraversion", score: 5, threshold: 2.8, direction: "Higher the better", mean: 3.19, sd: 0.66, weight: 0, area: 'R', maxScore: 5, minScore: 1 },
    { id: 4, test: "BFI-2-S", sub: "Open-Mindedness", score: 5, threshold: 3.3, direction: "Higher the better", mean: 3.57, sd: 0.59, weight: 0, area: 'R', maxScore: 5, minScore: 1 },
    { id: 5, test: "GSE", sub: "Overall", score: 50, threshold: 19.3, direction: "Higher the better", mean: 23.05, sd: 7.09, weight: 0.15, area: 'R', maxScore: 50, minScore: 10 },
    { id: 6, test: "CFC", sub: "Overall", score: 60, threshold: 27.4, direction: "Higher the better", mean: 30.20, sd: 5.40, weight: 0.15, area: 'R', maxScore: 60, minScore: 12 },
    { id: 7, test: "MLQ", sub: "Presence of Meaning", score: 25, threshold: 11.9, direction: "Higher the better", mean: 14.24, sd: 4.46, weight: 0.05, area: 'R', maxScore: 25, minScore: 5 },
    { id: 8, test: "MLQ", sub: "Search for meaning", score: 25, threshold: 13.4, direction: "Higher the better", mean: 15.70, sd: 4.41, weight: 0.05, area: 'R', maxScore: 25, minScore: 5 },
    { id: 9, test: "Growth Mindset", sub: "Overall", score: 5, threshold: 4.1, direction: "Higher the better", mean: 4.30, sd: 0.44, weight: 0.05, area: 'R', maxScore: 5, minScore: 1 },
    { id: 10, test: "BIS-11", sub: "Overall", score: 8, threshold: 15.1, direction: "Lower the better", mean: 13.49, sd: 3.09, weight: 0.1, area: 'L', maxScore: 40, minScore: 8 }
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
    let weightedAreaSum = 0;

    assessmentData.forEach(test => {
        const zScore = test.sd > 0 ? (test.score - test.mean) / test.sd : 0;
        const areaLeft = cumulativeDistribution(zScore);
        
        let area;
        if (test.area === "L") {
            area = areaLeft; // Area on the left
        } else { // 'R'
            area = 1 - areaLeft; // Area on the right
        }
        
        weightedAreaSum += area * test.weight;
    });

    const normalizedScore = weightedAreaSum * 1000;

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
        const scoreDisplay = typeof test.score === 'number' ? test.score.toFixed(2) : 'N/A';
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
        const maxScore = test.maxScore;
        const minScore = test.minScore;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <label for="slider-${test.id}" class="block text-sm font-medium text-gray-700">${testName}</label>
            <div class="flex items-center space-x-3 mt-1">
                <input type="range" id="slider-${test.id}" min="${minScore}" max="${maxScore}" value="${test.score}" step="0.01" class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb">
                <input type="number" id="input-value-${test.id}" min="${minScore}" max="${maxScore}" step="0.01" value="${test.score.toFixed(2)}" 
                       class="w-20 p-1.5 text-sm text-center bg-white border border-gray-300 rounded-md shadow-sm focus:ring-[#002e5d] focus:border-[#002e5d]">
            </div>
        `;
        container.appendChild(wrapper);

        const slider = document.getElementById(`slider-${test.id}`);
        const valueInput = document.getElementById(`input-value-${test.id}`);

        // Sync slider changes to input box
        slider.addEventListener('input', () => {
            const newValue = parseFloat(slider.value);
            valueInput.value = newValue.toFixed(2);
            assessmentData[test.id].score = newValue;
            calculateAll();
        });

        // Sync input box changes to slider
        valueInput.addEventListener('change', () => {
            let newValue = parseFloat(valueInput.value);

            // Validate and clamp the value
            if (isNaN(newValue)) {
                newValue = assessmentData[test.id].score; // revert if invalid
            } else if (newValue > maxScore) {
                newValue = maxScore;
            } else if (newValue < minScore) {
                newValue = minScore;
            }

            valueInput.value = newValue.toFixed(2); // Format and update input
            slider.value = newValue.toString();     // Update slider
            assessmentData[test.id].score = newValue; // Update data model
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
    
    document.getElementById('tab-summary').addEventListener('click', () => switchTab('summary'));
    document.getElementById('tab-analysis').addEventListener('click', () => switchTab('analysis'));
};