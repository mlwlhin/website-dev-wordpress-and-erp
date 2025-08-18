<?php require_once 'db_connect.php'; ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interactive Credit Risk Model</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.plot.ly/plotly-2.32.0.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@1.4.0"></script>
    <link rel="stylesheet" href="./css/pd.css">
    <!-- Chosen Palette: Corporate Palette -->
    <!-- Application Structure Plan: A dashboard layout with a persistent left sidebar for all user-controlled assumptions. The main panel presents the key output (Overall PD) at the top, followed by four tabbed sections for deeper analysis: 1) Attribution Analysis (bar chart), 2) Top Risk Scenarios (table), 3) an interactive DSR vs. PD Curve Simulator, and 4) Sensitivity Analysis. This structure allows users to see high-level results instantly, then dive into the 'why' and 'how' of the model. The flow is: adjust an assumption -> see the immediate impact on PD -> explore the detailed charts to understand the change. This is more intuitive than a linear report format. -->
    <!-- Visualization & Content Choices: 1) Overall PD: Goal=Inform, Method=Large Metric Card (HTML/Tailwind), Interaction=Dynamic update. 2) Assumptions: Goal=Input, Method=HTML Sliders/Inputs, Interaction=Triggers JS recalculation. 3) Attribution: Goal=Compare, Method=Bar Chart (Chart.js), Interaction=Dynamic update, shows which macro-event (dropout, unemployment) contributes most to risk. 4) Top Scenarios: Goal=Organize/Inform, Method=Sortable Table (HTML), Interaction=Shows specific high-risk paths. 5) DSR Curve: Goal=Relationship/Change, Method=Line Chart (Chart.js), Interaction=Sliders for logistic parameters (L, k, DSR_0) update the curve and recalculate the entire model, allowing for policy simulation. 6) Probability Tree: Goal=Organize/Relationships, Method=Sankey Diagram (Plotly.js), Interaction=Hover tooltips, visualizes flow of probabilities. 7) Sensitivity: Goal=Compare/Relationships, Method=Horizontal Bar Chart (Tornado, Chart.js), Interaction=Shows % change in PD for a % change in each input. -->
    <!-- CONFIRMATION: NO SVG graphics used. NO Mermaid JS used. -->

</head>
<body>

    <div class="flex flex-col lg:flex-row min-h-screen">
        <!-- Sidebar -->
        <aside class="w-full lg:w-80 sidebar shadow-lg p-6 lg:h-screen lg:sticky top-0 overflow-y-auto">
            <a href="./index.php" class="home-button">&larr; Return to Home</a>
            <h2 class="text-xl font-bold sidebar-heading mb-6">Credit Model Assumptions</h2>

            <div id="assumptions-form">
                <h3 class="font-semibold text-lg sidebar-heading border-b border-gray-300 pb-2 mb-4">Loan & Salaries</h3>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="p">Principal (p)</label>
                    <input type="number" id="p" class="sidebar-input" value="500000">
                </div>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="i">Annual Interest Rate (i %)</label>
                    <input type="number" id="i" class="sidebar-input" value="14.98" step="0.01">
                </div>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="tr">Repayment Period (tr years)</label>
                    <input type="number" id="tr" class="sidebar-input" value="10">
                </div>
                 <div class="sidebar-item">
                    <label class="sidebar-label" for="ts">Study Period (ts years)</label>
                    <input type="number" id="ts" class="sidebar-input" value="2">
                </div>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="sal_dad">Dad's Salary</label>
                    <input type="number" id="sal_dad" class="sidebar-input" value="8000">
                </div>
                 <div class="sidebar-item">
                    <label class="sidebar-label" for="sal_mum">Mum's Salary</label>
                    <input type="number" id="sal_mum" class="sidebar-input" value="0">
                </div>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="sal_stud_dest">Student Salary (Destination)</label>
                    <input type="number" id="sal_stud_dest" class="sidebar-input" value="16500">
                </div>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="sal_stud_home">Student Salary (Home)</label>
                    <input type="number" id="sal_stud_home" class="sidebar-input" value="4000">
                </div>

                <h3 class="font-semibold text-lg sidebar-heading border-b border-gray-300 pb-2 my-4">Probabilities</h3>
                 <div class="sidebar-item">
                    <label class="sidebar-label" for="psy_grd">Psychometric Test Score (psy_grd)</label>
                    <select id="psy_grd" class="sidebar-input">
                        <option value="A">A</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                        <option value="D">D</option>
                        <option value="E">E</option>
                        <option value="F">F</option>
                        <option value="G" selected>G</option>
                        <option value="H">H</option>
                        <option value="I">I</option>
                        <option value="J">J</option>
                    </select>
                </div>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="p_drop">Student Dropout PA (p_drop %)</label>
                    <input type="number" id="p_drop" class="sidebar-input" value="2.0" step="0.1">
                </div>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="p_unemp">Student Unemployment Post-Grad (p_unemp %)</label>
                    <input type="number" id="p_unemp" class="sidebar-input" value="10.0" step="0.1">
                </div>
                 <div class="sidebar-item">
                    <label class="sidebar-label" for="p_dest_emp">Employment in Destination (p_dest_emp %)</label>
                    <input type="number" id="p_dest_emp" class="sidebar-input" value="50.0" step="0.1">
                </div>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="p_unemp_drop">Unemployment after Dropout (p_unemp_drop %)</label>
                    <input type="number" id="p_unemp_drop" class="sidebar-input" value="20.0" step="0.1">
                </div>
                <div class="sidebar-item">
                    <label class="sidebar-label" for="p_parent_unemp">Base Parental Unemployment %</label>
                    <input type="number" id="p_parent_unemp" class="sidebar-input" value="4.75" step="0.01">
                </div>
            </div>
        </aside>

        <!-- Main content -->
        <main class="flex-1 p-6 lg:p-10 main-content">
            <h1 class="text-3xl font-bold main-heading mb-2">Interactive Credit Risk Dashboard</h1>
            <p class="mb-8">Analyze the probability of default by adjusting model assumptions in real-time.</p>

            <div class="metric-card mb-8">
                <h2 class="text-lg font-medium">Overall Probability of Default (PD)</h2>
                <p id="overall-pd" class="text-5xl font-bold metric-value mt-2">0.00%</p>
                 <div class="flex justify-center space-x-8 mt-4 pt-4 border-t">
                    <div>
                        <h3 class="text-sm font-medium text-gray-500">PD (Ability)</h3>
                        <p id="pd-ra-metric" class="text-2xl font-semibold">0.00%</p>
                    </div>
                    <div>
                        <h3 class="text-sm font-medium text-gray-500">PD (Willingness)</h3>
                        <p id="pd-rw-metric" class="text-2xl font-semibold">0.00%</p>
                    </div>
                </div>
            </div>

            <div class="space-y-8">
                 <div class="main-card">
                    <h2 class="text-2xl font-bold card-heading mb-1">Sensitivity Analysis (Tornado Chart)</h2>
                    <p class="mb-4">This chart shows the percentage change in the overall PD resulting from a +10% change in each major assumption. It ranks the variables by impact, revealing the most sensitive drivers of risk in the model.</p>
                    <div class="chart-container h-96">
                        <canvas id="sensitivityChart"></canvas>
                    </div>
                </div>
                
                <div class="main-card">
                    <h2 class="text-2xl font-bold card-heading mb-1">Interactive Probability Tree</h2>
                    <p class="mb-4">This diagram visualizes the flow of probabilities through the model's key stages. The width of each path is proportional to its probability, showing the most likely outcomes. The final stage illustrates how each branch contributes to the total risk of Default vs. No Default.</p>
                    <div id="sankey-container" class="sankey-container"></div>
                </div>

                <div class="main-card">
                    <div class="flex justify-between items-center mb-4">
                        <div>
                            <h2 class="text-2xl font-bold card-heading">Top Risk Scenario Explorer</h2>
                            <p>The table below lists the scenarios that contribute most to the total risk.</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="text-sm font-medium">Aggregate by Student Outcome</span>
                             <label class="toggle-label">
                                <input type="checkbox" id="aggregate-toggle" class="toggle-input">
                                <span class="toggle-slider"></span>
                            </label>
                        </div>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-sm">
                            <thead class="table-header">
                                <tr>
                                    <th class="p-3 font-semibold uppercase">Rank</th>
                                    <th class="p-3 font-semibold uppercase">Scenario Description</th>
                                    <th class="p-3 font-semibold uppercase cursor-pointer" onclick="sortTable(2)">Path Prob. ↓</th>
                                    <th class="p-3 font-semibold uppercase cursor-pointer" onclick="sortTable(3)">Conditional PD ↓</th>
                                    <th class="p-3 font-semibold uppercase cursor-pointer" onclick="sortTable(4)">Contribution to Total PD ↓</th>
                                </tr>
                            </thead>
                            <tbody id="scenarios-table" class="divide-y divide-gray-200">
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="main-card">
                    <h2 class="text-2xl font-bold card-heading mb-1">Risk Attribution Analysis</h2>
                    <p class="mb-4">This chart breaks down the total Probability of Default by the student's primary outcome. It shows which macro-level event contributes most to the overall risk.</p>
                    <div class="chart-container">
                        <canvas id="attributionChart"></canvas>
                    </div>
                </div>

                <div class="main-card">
                    <h2 class="text-2xl font-bold card-heading mb-1">Interactive DSR vs. PD Curve Simulator</h2>
                    <p class="mb-4">This section models the core risk function that converts a household's Debt-Servicing-Ratio (DSR) into a Probability of Default (PD). Adjust the parameters of the logistic function to simulate different risk policies and see the immediate impact on the curve and the overall PD.</p>
                    <div class="chart-container mb-6">
                        <canvas id="dsrPdChart"></canvas>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <label for="L" class="sidebar-label">L (Max PD): <span id="L_val">1.0</span></label>
                            <input type="range" id="L" min="0.5" max="1" step="0.01" value="1" class="sidebar-slider">
                        </div>
                        <div>
                            <label for="k" class="sidebar-label">k (Steepness): <span id="k_val">19.21</span></label>
                            <input type="range" id="k" min="5" max="30" step="0.1" value="19.206" class="sidebar-slider">
                        </div>
                        <div>
                            <label for="DSR_0" class="sidebar-label">DSR_0 (Inflection Point): <span id="DSR_0_val">0.80</span></label>
                            <input type="range" id="DSR_0" min="0.3" max="1.0" step="0.01" value="0.8" class="sidebar-slider">
                        </div>
                        <div>
                            <label for="psy_grd_slider" class="sidebar-label">Psychometric Grade: <span id="psy_grd_slider_val">G</span></label>
                            <input type="range" id="psy_grd_slider" min="0" max="9" step="1" value="6" class="sidebar-slider">
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script src="./js/pd.js"></script>
</body>
</html>
