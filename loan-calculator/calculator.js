// Load the Chart.js library
(function() {
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = function() {
        // Your calculator code here
        document.addEventListener('DOMContentLoaded', () => {
            const appState = {
                calculator: {
                    amount: 500000, // Initial loan amount set to 500,000
                    studyPeriod: 3,
                    rate: 0.1498, // Fixed 14.98% APR
                    currency: 'HKD'
                }
            };

            const loanAmountSlider = document.getElementById('loan-amount');
            const studyPeriodSlider = document.getElementById('study-period');
            const loanAmountValue = document.getElementById('loan-amount-value');
            const studyPeriodValue = document.getElementById('study-period-value');
            const monthlyPaymentSPDisplay = document.getElementById('monthly-payment-sp');
            const monthlyPaymentRPDisplay = document.getElementById('monthly-payment-rp');
            const ctx = document.getElementById('repaymentChart').getContext('2d');
            let repaymentChart;

            // Excel PMT function equivalent
            function pmt(rate_per_period, num_of_payments, present_value) {
                if (rate_per_period === 0) {
                    return -present_value / num_of_payments;
                }
                const pvif = Math.pow(1 + rate_per_period, num_of_payments);
                const pmt_val = rate_per_period * present_value * pvif / (pvif - 1);
                return pmt_val;
            }

            // Function to calculate monthly payments
            function calculatePayments() {
                const P = appState.calculator.amount;
                const annualRate = appState.calculator.rate;
                const monthlyRate = annualRate / 12;
                const repaymentMonths = 120; // 10 years * 12 months

                // SP: monthly repayment during study period
                const SP = P * monthlyRate;

                // RP: monthly repayment 1-year after graduation (using PMT for 10-year repayment)
                const RP = pmt(monthlyRate, repaymentMonths, P);

                return { SP, RP };
            }

            // Function to update all calculator displays and chart
            function updateCalculator() {
                const { SP, RP } = calculatePayments();

                loanAmountValue.textContent = `HK$${appState.calculator.amount.toLocaleString()}`;
                studyPeriodValue.textContent = `${appState.calculator.studyPeriod} years`;
                monthlyPaymentSPDisplay.textContent = `HK$${Math.round(SP).toLocaleString()}`; // Rounded
                monthlyPaymentRPDisplay.textContent = `HK$${Math.round(RP).toLocaleString()}`; // Rounded

                updateChartData(SP, RP);
            }

            // Function to update the chart data
            function updateChartData(SP, RP) {
                const studyYears = appState.calculator.studyPeriod;
                const gracePeriodYears = 1; // 1 year grace period
                const repaymentYears = 10; // 10 years after graduation
                const totalRepaymentMonths = repaymentYears * 12;

                const labels = [];
                const principalData = [];
                const interestData = [];

                let balance = appState.calculator.amount;
                const monthlyRate = appState.calculator.rate / 12;

                // Study Period
                for (let i = 0; i < studyYears; i++) {
                    labels.push(`Study ${i + 1}`);
                    // Monthly values for chart:
                    interestData.push(Math.round(SP)); // Interest-only during study period
                    principalData.push(0); // No principal repayment during study
                }

                // Grace Period (1 year after graduation, assuming still only interest)
                labels.push('Grace');
                // Monthly values for chart:
                interestData.push(Math.round(SP)); // Assuming interest-only during grace
                principalData.push(0);

                // Repayment Period (10 years after grace period)
                // Calculate the fixed monthly principal and interest components as per new logic
                const fixedMonthlyPrincipal = appState.calculator.amount / totalRepaymentMonths;
                const fixedMonthlyInterestPortion = RP - fixedMonthlyPrincipal; // RP is the total monthly payment

                for (let y = 0; y < repaymentYears; y++) {
                    labels.push(`Year ${y + 1}`);
                    principalData.push(Math.round(fixedMonthlyPrincipal));
                    interestData.push(Math.round(fixedMonthlyInterestPortion));
                }

                repaymentChart.data.labels = labels;
                repaymentChart.data.datasets[0].data = principalData;
                repaymentChart.data.datasets[1].data = interestData;
                repaymentChart.update();
            }

            // Initialize the chart
            function setupChart() {
                repaymentChart = new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: [],
                        datasets: [
                            {
                                label: 'Principal',
                                data: [],
                                backgroundColor: '#002e5d',
                            },
                            {
                                label: 'Interest',
                                data: [],
                                backgroundColor: '#FFEFE1',
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            title: {
                                display: true,
                                text: 'Monthly Repayment Breakdown',
                                font: {
                                    size: 15
                                }
                            },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'HKD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(context.parsed.y);
                                        }
                                        return label;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                                title: {
                                    display: true,
                                    text: 'Period'
                                },
                                ticks: {
                                    font: { size: 10 },
                                    maxRotation: 0,
                                    minRotation: 0
                                }
                            },
                            y: {
                                stacked: true,
                                beginAtZero: true,
                                ticks: {
                                    callback: function(value) {
                                        return 'HK$' + Math.round(value).toLocaleString();
                                    }
                                },
                                title: {
                                    display: true,
                                    text: 'Amount (HKD)'
                                }
                            }
                        }
                    }
                });
            }

            // Event listeners for sliders
            loanAmountSlider.addEventListener('input', (e) => {
                appState.calculator.amount = parseInt(e.target.value, 10);
                updateCalculator();
            });

            studyPeriodSlider.addEventListener('input', (e) => {
                appState.calculator.studyPeriod = parseInt(e.target.value, 10);
                updateCalculator();
            });

            // Set initial slider values and trigger first calculation/chart update
            loanAmountSlider.value = appState.calculator.amount;
            studyPeriodSlider.value = appState.calculator.studyPeriod;

            // Initialize the chart and calculator on page load
            setupChart();
            updateCalculator();
        });
    };
    document.head.appendChild(script);
})();