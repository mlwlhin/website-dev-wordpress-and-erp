// --- CHART & APP STATE ---
let attributionChart, dsrPdChart, sensitivityChart;
let scenariosResult = [];
let sortDirection = { column: 4, asc: false };
let isAggregatedView = false;

const psyGrades = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const pdRwMap = {
    'A': 0.0013, 'B': 0.0028, 'C': 0.0098, 'D': 0.0117, 'E': 0.0191,
    'F': 0.0277, 'G': 0.0531, 'H': 0.1154, 'I': 0.9946, 'J': 1.0
};

// --- CORE CALCULATION ENGINE ---
function getInputs() {
    const p_unemp = parseFloat(document.getElementById('p_unemp').value) / 100;
    const p_unemp_drop = parseFloat(document.getElementById('p_unemp_drop').value) / 100;
    const p_parent_unemp = parseFloat(document.getElementById('p_parent_unemp').value) / 100;

    return {
        p: parseFloat(document.getElementById('p').value),
        i: parseFloat(document.getElementById('i').value) / 100,
        tr: parseFloat(document.getElementById('tr').value),
        ts: parseInt(document.getElementById('ts').value),
        sal_dad: parseFloat(document.getElementById('sal_dad').value),
        sal_mum: parseFloat(document.getElementById('sal_mum').value),
        sal_stud_dest: parseFloat(document.getElementById('sal_stud_dest').value),
        sal_stud_home: parseFloat(document.getElementById('sal_stud_home').value),
        psy_grd: document.getElementById('psy_grd').value,
        p_drop: parseFloat(document.getElementById('p_drop').value) / 100,
        p_emp: 1 - p_unemp,
        p_dest_emp: parseFloat(document.getElementById('p_dest_emp').value) / 100,
        p_emp_drop: 1 - p_unemp_drop,
        p_dad_unemp: p_parent_unemp,
        p_mum_unemp: p_parent_unemp,
        L: parseFloat(document.getElementById('L').value),
        k: parseFloat(document.getElementById('k').value),
        DSR_0: parseFloat(document.getElementById('DSR_0').value),
    };
}

function calculatePmt(p, i, tr) {
    if (tr <= 0) return p;
    const monthly_i = i / 12;
    const n = tr * 12;
    if (monthly_i === 0) return p / n;
    return p * (monthly_i * Math.pow(1 + monthly_i, n)) / (Math.pow(1 + monthly_i, n) - 1);
}

function logisticFunction(dsr, L, k, DSR_0) {
    if (dsr >= 1000) return L;
    return L / (1 + Math.exp(-k * (dsr - DSR_0)));
}

function runFullModel(currentInputs) {
    const pmt = calculatePmt(currentInputs.p, currentInputs.i, currentInputs.tr);
    const pd_rw = pdRwMap[currentInputs.psy_grd];
    
    let allScenarios = [];
    const studentOutcomes = [
        { major: "Graduate, Employed", sub: "Destination", path: ["grad", "emp", "dest"] },
        { major: "Graduate, Employed", sub: "Home", path: ["grad", "emp", "home"] },
        { major: "Graduate, Unemployed", sub: "Unemployed", path: ["grad", "unemp", "na"] },
        { major: "Dropout, Employed", sub: "Employed", path: ["drop", "emp_drop", "na"] },
        { major: "Dropout, Unemployed", sub: "Unemployed", path: ["drop", "unemp_drop", "na"] },
    ];
    const parentOutcomes = ["both_emp", "dad_unemp", "mum_unemp", "both_unemp"];

    studentOutcomes.forEach(studentOutcome => {
        parentOutcomes.forEach(parentStatus => {
            let currentPath = [...studentOutcome.path];
            let desc = "";
            if(studentOutcome.major.startsWith("Dropout")) desc += "Drop, "; else desc += "Grad, ";
            if(studentOutcome.sub === "Destination") desc += "Emp Dest, ";
            else if (studentOutcome.sub === "Home") desc += "Emp Home, ";
            else if (studentOutcome.sub === "Employed") desc += "Emp, ";
            else if (studentOutcome.sub === "Unemployed") desc += "Unemp, ";

            if (parentStatus === "both_emp") { currentPath.push("dad_emp", "mum_emp"); desc += "Both Emp"; }
            if (parentStatus === "dad_unemp") { currentPath.push("dad_unemp", "mum_emp"); desc += "Dad Unemp"; }
            if (parentStatus === "mum_unemp") { currentPath.push("dad_emp", "mum_unemp"); desc += "Mum Unemp"; }
            if (parentStatus === "both_unemp") { currentPath.push("dad_unemp", "mum_unemp"); desc += "Both Unemp"; }
            allScenarios.push({ desc: desc, path: currentPath, majorOutcome: studentOutcome.major });
        });
    });
    
    const p_cont = 1 - currentInputs.p_drop;
    const p_unemp_val = 1 - currentInputs.p_emp;
    const p_home_emp = 1 - currentInputs.p_dest_emp;
    const p_unemp_drop_val = 1 - currentInputs.p_emp_drop;
    const p_dad_emp = 1 - currentInputs.p_dad_unemp;
    const p_mum_emp = 1 - currentInputs.p_mum_unemp;

    const calculatedScenarios = allScenarios.map(scen => {
        let pathWeight = 1.0;
        let studentSalary = 0;

        if (scen.path.includes("grad")) {
            pathWeight *= Math.pow(p_cont, currentInputs.ts);
            if (scen.path.includes("emp")) {
                pathWeight *= currentInputs.p_emp;
                if (scen.path.includes("dest")) {
                    pathWeight *= currentInputs.p_dest_emp;
                    studentSalary = currentInputs.sal_stud_dest;
                } else {
                    pathWeight *= p_home_emp;
                    studentSalary = currentInputs.sal_stud_home;
                }
            } else { pathWeight *= p_unemp_val; studentSalary = 0; }
        } else {
            pathWeight *= (1 - Math.pow(p_cont, currentInputs.ts));
            if (scen.path.includes("emp_drop")) {
                pathWeight *= currentInputs.p_emp_drop;
                studentSalary = currentInputs.sal_stud_home;
            } else { pathWeight *= p_unemp_drop_val; studentSalary = 0; }
        }

        let dadSalary = currentInputs.sal_dad;
        let mumSalary = currentInputs.sal_mum;

        if (scen.path.includes("dad_unemp")) { pathWeight *= currentInputs.p_dad_unemp; dadSalary = 0; } else { pathWeight *= p_dad_emp; }
        if (scen.path.includes("mum_unemp")) { pathWeight *= currentInputs.p_mum_unemp; mumSalary = 0; } else { pathWeight *= p_mum_emp; }

        const householdSalary = studentSalary + dadSalary + mumSalary;
        const dsr = householdSalary > 0 ? pmt / householdSalary : 1000;
        const pd_ra = logisticFunction(dsr, currentInputs.L, currentInputs.k, currentInputs.DSR_0);
        const conditionalPD = 1 - ((1 - pd_ra) * (1 - pd_rw));
        const weightedPD = conditionalPD * pathWeight;

        return { ...scen, pathWeight, conditionalPD, pd_ra, weightedPD };
    });

    return {
        scenarios: calculatedScenarios,
        totalPD: calculatedScenarios.reduce((sum, scen) => sum + scen.weightedPD, 0)
    };
}

function calculateModel() {
    const inputs = getInputs();
    const result = runFullModel(inputs);
    scenariosResult = result.scenarios;
    updateUI(result.totalPD);
}

function runSensitivityAnalysis() {
    const baseInputs = getInputs();
    const basePD = runFullModel(baseInputs).totalPD;
    
    if (basePD === 0) {
        sensitivityChart.data.labels = [];
        sensitivityChart.data.datasets[0].data = [];
        sensitivityChart.update();
        return;
    }

    const sensitivityResults = [];
    const shock = 0.10;

    const shockableVars = {
        'p': (inputs, val) => ({ ...inputs, p: val }),
        'i': (inputs, val) => ({ ...inputs, i: val / 100 }),
        'tr': (inputs, val) => ({ ...inputs, tr: val }),
        'ts': (inputs, val) => ({ ...inputs, ts: val }),
        'sal_dad': (inputs, val) => ({ ...inputs, sal_dad: val }),
        'sal_mum': (inputs, val) => ({ ...inputs, sal_mum: val }),
        'sal_stud_dest': (inputs, val) => ({ ...inputs, sal_stud_dest: val }),
        'sal_stud_home': (inputs, val) => ({ ...inputs, sal_stud_home: val }),
        'p_drop': (inputs, val) => ({ ...inputs, p_drop: val / 100 }),
        'p_unemp': (inputs, val) => ({ ...inputs, p_emp: 1 - (val / 100) }),
        'p_dest_emp': (inputs, val) => ({ ...inputs, p_dest_emp: val / 100 }),
        'p_unemp_drop': (inputs, val) => ({ ...inputs, p_emp_drop: 1 - (val / 100) }),
        'p_parent_unemp': (inputs, val) => {
            const rate = val / 100;
            return { ...inputs, p_dad_unemp: rate, p_mum_unemp: rate };
        }
    };
    
    const varsToTest = [
        { id: 'p', label: 'Principal' }, { id: 'i', label: 'Interest Rate' },
        { id: 'tr', label: 'Repayment Period'}, { id: 'ts', label: 'Study Period'},
        { id: 'sal_dad', label: `Dad's Salary` }, { id: 'sal_stud_dest', label: 'Student Salary (Dest)' },
        { id: 'sal_stud_home', label: 'Student Salary (Home)' }, { id: 'p_drop', label: 'Dropout Rate' },
        { id: 'p_unemp', label: 'Post-Grad Unemp.' }, { id: 'p_dest_emp', label: 'Dest. Employment' },
        { id: 'p_unemp_drop', label: 'Dropout Unemp.' }, { id: 'p_parent_unemp', label: 'Parental Unemp.' },
    ];

    varsToTest.forEach(v => {
        const originalValue = parseFloat(document.getElementById(v.id).value);
        const shockedValue = originalValue * (1 + shock);
        const shockerFunction = shockableVars[v.id];
        const shockedInputs = shockerFunction(getInputs(), shockedValue);
        const shockedPD = runFullModel(shockedInputs).totalPD;
        const delta = ((shockedPD - basePD) / basePD) * 100;
        sensitivityResults.push({ label: v.label, delta: delta });
    });
    
    sensitivityResults.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    
    sensitivityChart.data.labels = sensitivityResults.map(r => r.label);
    sensitivityChart.data.datasets[0].data = sensitivityResults.map(r => r.delta);
    sensitivityChart.update();
}

function getPdColorClass(pd) {
    return pd > 0.06 ? 'pd-red' : 'pd-green';
}

function updateUI(totalPD) {
    const pdRw = pdRwMap[document.getElementById('psy_grd').value];
    const totalPathWeight = scenariosResult.reduce((sum, s) => sum + s.pathWeight, 0);
    const weightedPdRa = scenariosResult.reduce((sum, s) => sum + s.pd_ra * s.pathWeight, 0);
    const avgPdRa = totalPathWeight > 0 ? weightedPdRa / totalPathWeight : 0;
    
    const overallPdEl = document.getElementById('overall-pd');
    const pdRaEl = document.getElementById('pd-ra-metric');
    const pdRwEl = document.getElementById('pd-rw-metric');

    overallPdEl.textContent = `${(totalPD * 100).toFixed(2)}%`;
    pdRaEl.textContent = `${(avgPdRa * 100).toFixed(2)}%`;
    pdRwEl.textContent = `${(pdRw * 100).toFixed(2)}%`;
    
    overallPdEl.className = `text-5xl font-bold metric-value mt-2 ${getPdColorClass(totalPD)}`;
    pdRaEl.className = `text-2xl font-semibold ${getPdColorClass(avgPdRa)}`;
    pdRwEl.className = `text-2xl font-semibold ${getPdColorClass(pdRw)}`;

    let attributionData;
    if (isAggregatedView) {
        attributionData = scenariosResult.reduce((acc, scen) => {
            const key = scen.majorOutcome;
            if (!acc[key]) acc[key] = 0;
            acc[key] += scen.weightedPD;
            return acc;
        }, {});
    } else {
        attributionData = scenariosResult.reduce((acc, scen) => {
            let parentStatus = "Both Emp";
            const dadUnemp = scen.path.includes('dad_unemp');
            const mumUnemp = scen.path.includes('mum_unemp');
            if (dadUnemp && mumUnemp) parentStatus = "Both Unemp";
            else if (dadUnemp) parentStatus = "Dad Unemp";
            else if (mumUnemp) parentStatus = "Mum Unemp";
            const key = `${scen.majorOutcome} (${parentStatus})`;
            if (!acc[key]) acc[key] = 0;
            acc[key] += scen.weightedPD;
            return acc;
        }, {});
    }

    attributionChart.data.labels = Object.keys(attributionData);
    const totalAttribution = Object.values(attributionData).reduce((s, v) => s + v, 0);
    attributionChart.data.datasets[0].data = Object.values(attributionData).map(v => (totalAttribution > 0 ? (v / totalAttribution) * 100 : 0));
    attributionChart.update();

    updateDsrPdChart(totalPD);
    updateSankeyDiagram();
    runSensitivityAnalysis();
    renderTable();
}

function updateDsrPdChart(totalPD) {
    const inputs = getInputs();
    const pd_rw = pdRwMap[inputs.psy_grd];
    const dsrValues = Array.from({ length: 101 }, (_, i) => i * 0.015);
    
    const pdRaValues = dsrValues.map(dsr => logisticFunction(dsr, inputs.L, inputs.k, inputs.DSR_0));
    const pdOverallValues = pdRaValues.map(pd_ra => 1 - ((1 - pd_ra) * (1 - pd_rw)));

    dsrPdChart.data.labels = dsrValues;
    dsrPdChart.data.datasets[0].data = pdRaValues;
    dsrPdChart.data.datasets[1].data = pdOverallValues;
    
    if(dsrPdChart.options.plugins.annotation) {
        dsrPdChart.options.plugins.annotation.annotations.line1.yMin = totalPD;
        dsrPdChart.options.plugins.annotation.annotations.line1.yMax = totalPD;
    }
    
    dsrPdChart.update();
}

function updateSankeyDiagram() {
    const inputs = getInputs();
    const p_cont = 1 - inputs.p_drop;
    
    let labels = ['Cohort'];
    let sources = [];
    let targets = [];
    let values = [];
    
    let lastContinueNode = 0;
    let dropoutPoolNode = -1;

    for (let y = 1; y <= inputs.ts; y++) {
        const continueNode = labels.length; labels.push(`Y${y} Continue`);
        const dropoutNode = labels.length; labels.push(`Y${y} Dropout`);
        if (dropoutPoolNode === -1) { dropoutPoolNode = labels.length; labels.push('Dropout Pool'); }
        const probContinue = Math.pow(p_cont, y);
        const probDropoutThisYear = Math.pow(p_cont, y - 1) * inputs.p_drop;
        sources.push(lastContinueNode, lastContinueNode, dropoutNode);
        targets.push(continueNode, dropoutNode, dropoutPoolNode);
        values.push(probContinue, probDropoutThisYear, probDropoutThisYear);
        lastContinueNode = continueNode;
    }

    const graduateNode = lastContinueNode;
    labels[graduateNode] = 'Graduate';

    const gradEmpNode = labels.length; labels.push('Grad-Employed');
    const gradUnempNode = labels.length; labels.push('Grad-Unemployed');
    const dropEmpNode = labels.length; labels.push('Drop-Employed');
    const dropUnempNode = labels.length; labels.push('Drop-Unemployed');

    const p_grad = Math.pow(p_cont, inputs.ts);
    const p_drop_total = 1 - p_grad;
    
    sources.push(graduateNode, graduateNode, dropoutPoolNode, dropoutPoolNode);
    targets.push(gradEmpNode, gradUnempNode, dropEmpNode, dropUnempNode);
    values.push(p_grad * inputs.p_emp, p_grad * (1 - inputs.p_emp), p_drop_total * inputs.p_emp_drop, p_drop_total * (1 - inputs.p_emp_drop));

    const studentNodes = [
        { base: gradEmpNode, type: 'grad_emp' }, { base: gradUnempNode, type: 'grad_unemp' },
        { base: dropEmpNode, type: 'drop_emp' }, { base: dropUnempNode, type: 'drop_unemp' }
    ];
    const parentLabels = ['Both Emp', 'Dad Unemp', 'Mum Unemp', 'Both Unemp'];
    const defaultNode = labels.length; labels.push('Default');
    const noDefaultNode = labels.length; labels.push('No Default');

    studentNodes.forEach(sNode => {
        parentLabels.forEach(pLabel => {
            const parentNode = labels.length; labels.push(`${sNode.type.substring(0,5)}-${pLabel}`);
            const relevantScenarios = scenariosResult.filter(scen => {
                const isGrad = scen.majorOutcome.startsWith('Graduate');
                const isEmp = scen.majorOutcome.includes('Employed');
                if (sNode.type !== `${isGrad ? 'grad' : 'drop'}_${isEmp ? 'emp' : 'unemp'}`) return false;
                const dadUnemp = scen.path.includes('dad_unemp');
                const mumUnemp = scen.path.includes('mum_unemp');
                if (pLabel === 'Both Emp' && !dadUnemp && !mumUnemp) return true;
                if (pLabel === 'Dad Unemp' && dadUnemp && !mumUnemp) return true;
                if (pLabel === 'Mum Unemp' && !dadUnemp && mumUnemp) return true;
                if (pLabel === 'Both Unemp' && dadUnemp && mumUnemp) return true;
                return false;
            });
            const totalPathWeight = relevantScenarios.reduce((sum, scen) => sum + scen.pathWeight, 0);
            const totalWeightedPD = relevantScenarios.reduce((sum, scen) => sum + scen.weightedPD, 0);
            if (totalPathWeight > 1e-9) {
                sources.push(sNode.base, parentNode, parentNode);
                targets.push(parentNode, defaultNode, noDefaultNode);
                values.push(totalPathWeight, totalWeightedPD, totalPathWeight - totalWeightedPD);
            }
        });
    });
    
    const nodeColors = labels.map(label => {
        if (label === 'Default') return '#ffd700'; // Sharp Yellow
        if (label.includes('No Default')) return '#002e5d'; // Dark Blue
        if (label.includes('Grad') || label.includes('Continue') || label.includes('Emp')) return '#002e5d'; // Dark Blue
        if (label.includes('Drop') || label.includes('Unemp')) return '#FFEFE1'; // Soft Amber
        if (label.includes('Cohort')) return '#333333'; // Dark Grey
        if (label.startsWith('Grad-')) return '#002e5d';
        if (label.startsWith('Drop-')) return '#FFEFE1';
        return '#333333';
    });

    const data = { type: "sankey", orientation: "h", node: { pad: 15, thickness: 20, line: { color: "black", width: 0.5 }, label: labels, color: nodeColors }, link: { source: sources, target: targets, value: values, color: "#d9d9d9" } };
    const layout = { title: { text: 'Probability Flow to Default', font: { color: '#002e5d' } }, font: { size: 10, family: 'Inter', color: '#333333' }, margin: { t: 50, b: 20, l:20, r:20 }, paper_bgcolor: 'rgba(0,0,0,0)' };
    Plotly.newPlot('sankey-container', [data], layout, {responsive: true});
}

function aggregateScenarios(scenarios) {
    const grouped = scenarios.reduce((acc, scen) => {
        const key = scen.majorOutcome;
        if (!acc[key]) {
            acc[key] = { desc: key, pathWeight: 0, weightedPD: 0, count: 0 };
        }
        acc[key].pathWeight += scen.pathWeight;
        acc[key].weightedPD += scen.weightedPD;
        acc[key].count++;
        return acc;
    }, {});

    return Object.values(grouped).map(group => ({
        ...group,
        conditionalPD: group.pathWeight > 0 ? group.weightedPD / group.pathWeight : 0
    }));
}

function renderTable() {
    const tableBody = document.getElementById('scenarios-table');
    let dataToRender = isAggregatedView ? aggregateScenarios(scenariosResult) : scenariosResult;
    const totalPD = scenariosResult.reduce((sum, scen) => sum + scen.weightedPD, 0);
    dataToRender.sort((a, b) => {
        let valA, valB;
        if (sortDirection.column === 2) { valA = a.pathWeight; } else if (sortDirection.column === 3) { valA = a.conditionalPD; } else { valA = a.weightedPD; }
        if (sortDirection.column === 2) { valB = b.pathWeight; } else if (sortDirection.column === 3) { valB = b.conditionalPD; } else { valB = b.weightedPD; }
        return sortDirection.asc ? valA - valB : valB - valA;
    });
    tableBody.innerHTML = dataToRender.slice(0, 10).map((scen, index) => {
        const contribution = totalPD > 0 ? (scen.weightedPD / totalPD) * 100 : 0;
        return `<tr class="hover:bg-gray-100"><td class="p-3 font-medium">${index + 1}</td><td class="p-3">${scen.desc}</td><td class="p-3">${(scen.pathWeight * 100).toFixed(2)}%</td><td class="p-3">${(scen.conditionalPD * 100).toFixed(2)}%</td><td class="p-3 contribution-cell">${contribution.toFixed(2)}%</td></tr>`;
    }).join('');
}

function sortTable(columnIndex) {
    if (sortDirection.column === columnIndex) sortDirection.asc = !sortDirection.asc;
    else { sortDirection.column = columnIndex; sortDirection.asc = false; }
    document.querySelectorAll('th[onclick]').forEach((th, i) => {
        let text = th.innerText.replace(/ [↓↑]/, '');
        if (i + 2 === columnIndex) text += sortDirection.asc ? ' ↑' : ' ↓';
        th.innerText = text;
    });
    renderTable();
}

// --- INITIALIZATION ---
window.onload = () => {
        const sensCtx = document.getElementById('sensitivityChart').getContext('2d');
    sensitivityChart = new Chart(sensCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: '% Change in PD from +10% Input Change', data: [], 
            backgroundColor: (ctx) => ctx.raw >= 0 ? '#ffd700' : '#002e5d', 
            borderColor: (ctx) => ctx.raw >= 0 ? '#ffd700' : '#002e5d', 
            borderWidth: 1 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { title: { display: true, text: '% Change in Overall PD', color: '#333333' }, ticks:{color: '#333333'}}, y:{ticks:{color: '#333333'}} }, plugins: { legend: { display: false } } }
    });

    const attrCtx = document.getElementById('attributionChart').getContext('2d');
    attributionChart = new Chart(attrCtx, {
        type: 'bar',
        data: { labels: [], datasets: [{ label: 'Contribution to Total PD (%)', data: [], 
            backgroundColor: (ctx) => {
                if (!ctx.chart.data.labels || ctx.dataIndex === undefined || !ctx.chart.data.labels[ctx.dataIndex]) { return '#333333'; }
                const label = ctx.chart.data.labels[ctx.dataIndex];
                if (label.includes('Employed')) return '#002e5d';
                if (label.includes('Unemployed')) return '#FFEFE1';
                if (label.includes('Dropout')) return '#333333';
                return '#333333';
            }, 
            borderColor: '#ffffff', borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, title: { display: true, text: 'Attribution to Total PD (%)', color: '#333333' }, ticks:{color: '#333333'} }, x:{ticks:{color: '#333333'}} }, plugins: { legend: { display: false } } }
    });

    const dsrPdCtx = document.getElementById('dsrPdChart').getContext('2d');
    dsrPdChart = new Chart(dsrPdCtx, {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'PD (Ability)', data: [], fill: false, borderColor: '#002e5d', tension: 0.1, pointRadius: 0 },
            { label: 'Overall PD', data: [], fill: false, borderColor: '#ffd700', tension: 0.1, pointRadius: 0 }
        ] },
        options: { 
            responsive: true, maintainAspectRatio: false, 
            scales: { x: { title: { display: true, text: 'Debt-Servicing-Ratio (DSR)', color: '#333333' }, ticks:{color: '#333333'} }, y: { title: { display: true, text: 'Probability of Default (PD)', color: '#333333' }, min: 0, max: 1, ticks:{color: '#333333'} } },
            plugins: {
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yMin: 0.15,
                            yMax: 0.15,
                            borderColor: 'rgb(239, 68, 68, 0.7)',
                            borderWidth: 2,
                            borderDash: [6, 6],
                            label: {
                                content: 'Overall PD',
                                enabled: true,
                                position: 'end'
                            }
                        }
                    }
                }
            }
        }
    });

    document.getElementById('assumptions-form').addEventListener('input', calculateModel);
    document.getElementById('aggregate-toggle').addEventListener('change', (e) => {
        isAggregatedView = e.target.checked;
        calculateModel();
    });
    document.getElementById('psy_grd_slider').addEventListener('input', (e) => {
        const grade = psyGrades[e.target.value];
        document.getElementById('psy_grd_slider_val').textContent = grade;
        document.getElementById('psy_grd').value = grade;
        calculateModel();
    });
    ['L', 'k', 'DSR_0'].forEach(id => {
        document.getElementById(id).addEventListener('input', (e) => {
            document.getElementById(`${id}_val`).textContent = parseFloat(e.target.value).toFixed(2);
            calculateModel();
        });
    });

    calculateModel();
};
