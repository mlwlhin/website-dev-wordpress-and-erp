document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENTS ---
    const ineligibleMessagePanel = document.getElementById('ineligibleMessagePanel');
    const resultsPanel = document.getElementById('resultsPanel');
    // New elements for robust display
    const resultsContent = document.getElementById('resultsContent');
    const resultsError = document.getElementById('resultsError');
    
    const universityInput = document.getElementById('university');
    const universityList = document.getElementById('university-list');
    const studyDestinationSelect = document.getElementById('studyDestination');
    const tuitionInput = document.getElementById('tuition');
    const livingInput = document.getElementById('living');
    const expectedSalarySlider = document.getElementById('expectedSalary');
    const expectedSalaryValue = document.getElementById('expectedSalaryValue');
    const calculateBtn = document.getElementById('calculateBtn');
    const showRefiBtn = document.getElementById('showRefiBtn');
    const refiSection = document.getElementById('refi-section');
    const bankRateSlider = document.getElementById('bankRate');
    const bankRateValue = document.getElementById('bankRateValue');
    const studyPeriodInput = document.getElementById('studyPeriod');
    const studyPeriodValue = document.getElementById('studyPeriodValue');
    const partTimeHoursInput = document.getElementById('partTimeHours');
    const partTimeHoursValue = document.getElementById('partTimeHoursValue');

    // --- DATA & STATE ---
    let repaymentChart, refiChart;
    let calculatedData = {};
    let groupedUniData = {};
    let uniDetailsData = {};
    let minimumWageData = {};

    // --- JSON file paths ---
    // Make sure these paths are correct for your server setup.
    const JSON_URLS = {
        grouped_uni: '/sb2/wp-content/themes/astra/data/grouped_uni.json',
        uni_details: '/sb2/wp-content/themes/astra/data/uni_list_with_living_exp.json',
        minimum_wage: '/sb2/wp-content/themes/astra/data/minimum_wage_by_city.json'
    };

    // --- JSON FETCHING & PROCESSING ---
    async function fetchJSONData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Network response was not ok for ${url}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch or parse JSON from ${url}:`, error);
            return {}; // Return empty object on failure to prevent total crash
        }
    }

    function processUniDetails(uniArray) {
        const data = {};
        if (!Array.isArray(uniArray)) return data; // Safety check
        uniArray.forEach(uni => {
            if (uni && uni.Name) {
                const avg_liv_exp = parseFloat(uni.liv_exp_low_hkd) * 1.15 ;
                data[uni.Name.trim()] = {
                    ...uni,
                    avg_liv_exp_hkd: isNaN(avg_liv_exp) ? 0 : Math.round(avg_liv_exp)
                };
            }
        });
        return data;
    }

    async function loadAllJSONData() {
        try {
            const [groupedData, detailsList, wageData] = await Promise.all([
                fetchJSONData(JSON_URLS.grouped_uni),
                fetchJSONData(JSON_URLS.uni_details),
                fetchJSONData(JSON_URLS.minimum_wage)
            ]);

            groupedUniData = groupedData;
            uniDetailsData = processUniDetails(detailsList);
            minimumWageData = wageData;

            populateStudyDestinations();
            studyDestinationSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            console.error('Error during initial data load:', error);
        }
    }

    function populateStudyDestinations() {
        if (!studyDestinationSelect || typeof groupedUniData !== 'object') return;
        studyDestinationSelect.innerHTML = '';
        for (const destination in groupedUniData) {
            const option = document.createElement('option');
            option.value = destination;
            option.textContent = destination;
            studyDestinationSelect.appendChild(option);
        }
    }

    // --- UTILITY FUNCTIONS ---
    const formatHKD = (num) => `HK$${!isNaN(num) ? Math.round(num).toLocaleString() : '0'}`;
    const pmt = (rate, nper, pv) => {
        if (rate === 0) return -(pv / nper);
        const factor = Math.pow(1 + rate, nper);
        return -(pv * rate * factor) / (factor - 1);
    };

    // --- UI LOGIC ---
    const updateDSRGauge = (elementId, value) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const percentage = Math.min(100, Math.max(0, value * 100));
        el.style.width = `${percentage}%`;
        if (percentage > 50) el.style.backgroundColor = '#ef4444'; // Red
        else if (percentage > 30) el.style.backgroundColor = '#f59e0b'; // Amber
        else el.style.backgroundColor = '#10b981'; // Green
    };

    // --- EVENT LISTENERS ---
    studyPeriodInput.addEventListener('input', (e) => {
        studyPeriodValue.textContent = `${Number(e.target.value)} Years`;
    });

    partTimeHoursInput.addEventListener('input', (e) => {
        partTimeHoursValue.textContent = `${Number(e.target.value)} Hours`;
    });

    expectedSalarySlider.addEventListener('input', (e) => {
        expectedSalaryValue.textContent = formatHKD(Number(e.target.value));
    });

    bankRateSlider.addEventListener('input', (e) => {
        bankRateValue.textContent = `${Number(e.target.value).toFixed(1)}%`;
        if (Object.keys(calculatedData).length > 0 && refiSection.style.maxHeight !== '0px') {
            calculateAndDisplayRefi();
        }
    });

    // --- MAIN CALCULATION LOGIC ---
    calculateBtn.addEventListener('click', () => {
        // 1. GATHER INPUTS (with defaults to prevent NaN errors)
        const tui = Number(tuitionInput.value) || 0;
        const liv = Number(livingInput.value) || 0;
        const sp = Number(studyPeriodInput.value) || 0;
        const sal_stud = Number(expectedSalarySlider.value) || 0;
        const pt = Number(partTimeHoursInput.value) || 0;
        const saving_hh = Number(document.getElementById('householdSavings').value) || 0;
        const sal_hh_avail = Number(document.getElementById('householdSupport').value) || 0;
        const dad_sal = Number(document.getElementById('dadSalary').value) || 0;
        const mum_sal = Number(document.getElementById('mumSalary').value) || 0;
        const selectedUniversityName = universityInput.value.trim();

        // DYNAMIC WAGE CALCULATION
        let wage = 110;
        const uniInfo = uniDetailsData[selectedUniversityName];
        if (uniInfo && uniInfo.city && minimumWageData[uniInfo.city.trim()]) {
            wage = parseFloat(minimumWageData[uniInfo.city.trim()].hourly_minimum_salary_hk) || 110;
        }

        // 2. CALCULATE COSTS & RESOURCES
        const edu_tot = (tui + (liv * 12)) * sp;
        const fin_tot = (pt * wage * 52 * sp) + saving_hh + (sal_hh_avail * 12 * sp);
        const sf = edu_tot - fin_tot;
        const int_rate_sb = 0.1498;
        const amt = sf > 0 ? sf / (1 - (int_rate_sb * sp)) : 0;

        // 3. HIDE ALL PANELS BEFORE SHOWING NEW RESULTS
        resultsPanel.classList.add('hidden');
        ineligibleMessagePanel.classList.add('hidden');
        showRefiBtn.classList.add('hidden');
        refiSection.style.maxHeight = '0px';
        refiSection.style.padding = '0';
        refiSection.style.margin = '0';

        // 4. CHECK IF INELIGIBLE
        if (amt > edu_tot) {
            ineligibleMessagePanel.classList.remove('hidden');
            return; // Stop execution and show the ineligible message
        }

        // 5. IF ELIGIBLE, PROCEED TO DISPLAY THE LOAN PLAN
        resultsPanel.classList.remove('hidden'); // Show the main container
        if (amt > 0) {
            showRefiBtn.classList.remove('hidden');
        }

        try {
            // Show content, hide error message
            resultsContent.classList.remove('hidden');
            resultsError.classList.add('hidden');

            const mth_SP = (amt * int_rate_sb) / 12;
            const mth_RP = amt > 0 ? -pmt(int_rate_sb / 12, 120, amt) : 0;

            const sal_hh = dad_sal + mum_sal;
            const student_dsr_repay = sal_stud > 0 ? mth_RP / sal_stud : 0;
            const household_dsr_repay = (sal_hh + sal_stud) > 0 ? mth_RP / (sal_hh + sal_stud) : 0;

            calculatedData = { amt, mth_RP, sal_stud, sp, mth_SP };

            updateRefiDescription(sal_stud); 

            document.getElementById('loanAmount').textContent = formatHKD(amt);
            document.getElementById('studyPayment').textContent = `${formatHKD(mth_SP)}/mo`;
            document.getElementById('gradPayment').textContent = `${formatHKD(mth_RP)}/mo`;
            document.getElementById('studentDSRValue').textContent = `${(student_dsr_repay * 100).toFixed(1)}%`;
            document.getElementById('householdDSRValue').textContent = `${(household_dsr_repay * 100).toFixed(1)}%`;

            updateDSRGauge('studentDSRFill', student_dsr_repay);
            updateDSRGauge('householdDSRFill', household_dsr_repay);

            drawRepaymentChart(sp, mth_SP, mth_RP);

        } catch (error) {
            console.error('An error occurred while displaying the loan plan:', error);
            // Hide content, show error message
            resultsContent.classList.add('hidden');
            resultsError.classList.remove('hidden');
        }
    });

    showRefiBtn.addEventListener('click', () => {
        if (refiSection.style.maxHeight === '0px' || !refiSection.style.maxHeight) {
            refiSection.style.paddingTop = '1.5rem';
            refiSection.style.paddingBottom = '1.5rem';
            refiSection.style.marginTop = '2rem';
            refiSection.style.maxHeight = refiSection.scrollHeight + "px";
            setTimeout(() => { refiSection.style.maxHeight = '1000px'; }, 700);
            calculateAndDisplayRefi();
        } else {
            refiSection.style.maxHeight = '0px';
            refiSection.style.padding = '0';
            refiSection.style.margin = '0';
        }
    });

    const calculateAndDisplayRefi = () => {
        const { amt, mth_RP, sal_stud } = calculatedData;
        const bank_i = Number(bankRateSlider.value) / 100;
        const bank_t = 60;
        const bank_amt = sal_stud * 12;

        const bank_pmt = bank_amt > 0 ? -pmt(bank_i / 12, bank_t, bank_amt) : 0;
        const amt_sb_rem = Math.max(0, amt - bank_amt);
        const sb_pmt_rem = amt_sb_rem > 0 ? -pmt(0.1498 / 12, 120, amt_sb_rem) : 0;
        const mth_tot_refi_first60 = bank_pmt + sb_pmt_rem;
        const mth_tot_refi_last60 = sb_pmt_rem;

        const int_exp_tot = (mth_RP * 120) - amt;
        const int_exp_tot_refin = (bank_pmt * bank_t) + (sb_pmt_rem * 120) - amt;

        const int_saving = int_exp_tot - int_exp_tot_refin;
        const int_saving_pct = int_exp_tot > 0 ? (int_saving / int_exp_tot) * 100 : 0;

        document.getElementById('interestSaved').textContent = `${Math.round(int_saving_pct)}%`;
        drawRefiChart(mth_RP, mth_tot_refi_first60, mth_tot_refi_last60);
    };

    const drawRepaymentChart = (sp, mth_SP, mth_RP) => {
        const ctx = document.getElementById('repaymentChart').getContext('2d');
        const studyYears = Math.floor(sp);
        const labels = [...Array(studyYears).fill('Study'), 'Grace Period', ...Array(10).fill(0).map((_, i) => `Repay Year ${i+1}`)];
        const data = [...Array(studyYears).fill(mth_SP), mth_SP, ...Array(10).fill(mth_RP)];

        if (repaymentChart) repaymentChart.destroy();
        repaymentChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Monthly Payment (HKD)',
                    data,
                    backgroundColor: (context) => (context.dataIndex > studyYears) ? '#002e5d' : '#FFEFE1',
                    borderColor: (context) => (context.dataIndex > studyYears) ? '#002e5d' : '#FFEFE1',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.dataset.label || ''}: ${formatHKD(c.parsed.y)}` } } },
                scales: { y: { beginAtZero: true, ticks: { callback: (v) => formatHKD(v) } } }
            }
        });
    };

    const drawRefiChart = (mth_RP, mth_tot_refi_first60, mth_tot_refi_last60) => {
        const ctx = document.getElementById('refiChart').getContext('2d');
        if (refiChart) refiChart.destroy();
        refiChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Without Refi (10 Yrs)', 'With Refi (Yrs 1-5)', 'With Refi (Yrs 6-10)'],
                datasets: [{ label: 'Monthly Payment', data: [mth_RP, mth_tot_refi_first60, mth_tot_refi_last60], backgroundColor: ['#333333', '#002e5d', '#002e5d'] }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.dataset.label || ''}: ${formatHKD(c.parsed.x)}` } } },
                scales: { x: { beginAtZero: true, ticks: { callback: (v) => formatHKD(v) } } }
            }
        });
    };

    /**
     * NEW: Updates the description in the refinancing section with dynamic values.
     * @param {number} salary - The expected monthly salary after graduation.
     */
    const updateRefiDescription = (salary) => {
        const descriptionEl = document.getElementById('refiDescription');
        if (!descriptionEl) return; // Exit if the element isn't found

        const bank_amt = salary * 12;
        
        const staticText = "After you graduate, you become a prime client for banks. By refinancing a portion of your SocioBridge loan, you can save significantly. Adjust the potential bank interest rate to see how. ";
        
        // This creates your new dynamic sentence
        const dynamicText = `This assumes you apply for a bank loan of ${formatHKD(bank_amt)} (12x your expected monthly salary of ${formatHKD(salary)}) for a 5-year term.`;
        
        descriptionEl.textContent = staticText + dynamicText;
    };

    function updateUniversityDetails(selectedUniversityName) {
        const uniInfo = uniDetailsData[selectedUniversityName.trim()];
        if (uniInfo && uniInfo.avg_liv_exp_hkd) {
            livingInput.value = uniInfo.avg_liv_exp_hkd;
        } else {
            livingInput.value = ''; // Clear if no data
        }
    }

    const setupSearchableDropdown = (inputEl, listEl) => {
        inputEl.addEventListener('input', () => {
            const filter = inputEl.value.toLowerCase();
            const currentDestination = studyDestinationSelect.value;
            const universitiesForDestination = groupedUniData[currentDestination] || [];

            const matchedUniversities = universitiesForDestination.filter(uniName =>
                uniName.toLowerCase().includes(filter)
            );

            listEl.innerHTML = '';
            if (matchedUniversities.length > 0 && filter.length > 0) {
                listEl.classList.remove('hidden');
                matchedUniversities.slice(0, 10).forEach(item => {
                    const div = document.createElement('div');
                    div.textContent = item;
                    div.className = 'custom-dropdown-item';
                    div.onclick = () => {
                        inputEl.value = item;
                        listEl.classList.add('hidden');
                        updateUniversityDetails(item);
                    };
                    listEl.appendChild(div);
                });
            } else {
                listEl.classList.add('hidden');
            }
        });
    };

    studyDestinationSelect.addEventListener('change', (e) => {
        universityInput.value = '';
        livingInput.value = '';
        universityList.innerHTML = '';
        universityList.classList.add('hidden');
        setupSearchableDropdown(universityInput, universityList);
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.custom-dropdown')) {
            universityList.classList.add('hidden');
        }
    });

    // --- Initial Setup ---
    loadAllJSONData().then(() => {
        expectedSalaryValue.textContent = formatHKD(Number(expectedSalarySlider.value));
        bankRateValue.textContent = `${Number(bankRateSlider.value).toFixed(1)}%`;
        studyPeriodValue.textContent = `${Number(studyPeriodInput.value)} Years`;
        partTimeHoursValue.textContent = `${Number(partTimeHoursInput.value)} Hours`;
    });
});
