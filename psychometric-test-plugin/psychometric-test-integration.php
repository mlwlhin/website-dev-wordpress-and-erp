<?php
/**
 * Plugin Name: Psychometric Test Integration
 * Description: Integrates psychometric tests with WPForms and provides custom result processing with optimized memory.
 * Version: 1.1.7
 * Author: Your Name
 */

// Exit if accessed directly
if (!defined('ABSPATH')) {
    exit;
}

/**
 * Class Psychometric_Assessment_Processor
 * Handles the processing of psychometric test results from WPForms submissions.
 */
class Psychometric_Assessment_Processor {

    private $psychometric_form_id; // Your WPForms ID
    private $db_table_name;

    // Cache properties to store loaded data once per request if accessed multiple times
    private $wpforms_field_to_item_id_map = null;
    private $question_details = null;
    private $assessment_scoring_rules = null;

    // Define the conversion factor as a class constant
    const CONVERSION_FACTOR = 84.65 / 64;

    // Define the TU Lookup Table data as a class constant
    // Format: [Cum. Pop (Upper Bound), TU Grade, High PD]
    // Sorted by Cum. Pop ascending for efficient lookup
    private const TU_LOOKUP_TABLE = [
        [37.1, 'A', 0.13],
        [65.0, 'B', 0.28],
        [70.5, 'C', 0.98],
        [76.0, 'D', 1.17],
        [80.3, 'E', 1.91],
        [84.7, 'F', 2.77],
        [89.0, 'G', 5.31],
        [93.7, 'H', 11.54],
        [99.0, 'I', 99.46],
        [100.0, 'J', 100.00], // For scores up to 100 (after cap, effectively 99)
        // Adding a slightly higher value for 'Bankruptc' to catch any score that might
        // theoretically be exactly 100 or slightly above if cap logic changes,
        // ensuring 'Bankruptc' is the very last bucket.
        [100.00001, 'Bankruptc', 100.00] 
    ];


    public function __construct() {
        global $wpdb;
        $this->db_table_name = $wpdb->prefix . 'psychometric_results';
        
        // IMPORTANT: Replace this with the actual ID of your WPForms form for the psychometric test.
        $this->psychometric_form_id = 738; // <--- REPLACE THIS VALUE!

        add_action('plugins_loaded', [$this, 'create_db_table']);
        add_action('wpforms_process_complete', [$this, 'process_psychometric_submission'], 10, 4);
        add_action('admin_menu', [$this, 'add_admin_menu']);

        // Uncomment the line below if you want to enable the custom 'only once answer' logic.
        // Remember that WPForms Form Locker Addon offers a more robust solution for this.
        // add_action('wpforms_process_before_save', [$this, 'check_single_submission'], 10, 2);
    }

    /**
     * Loads the WPForms field to item_id mapping from field_to_item.json.
     * Caches the result to avoid re-reading the file during the same request.
     * @return array
     */
    private function load_wpforms_field_to_item_id_map() {
        if ($this->wpforms_field_to_item_id_map === null) {
            $map = [];
            // Assuming field_to_item.json is in the same plugin directory
            $file_path = plugin_dir_path(__FILE__) . 'field_to_item.json'; 

            if (file_exists($file_path)) {
                $json_data = file_get_contents($file_path);
                $raw_map_list = json_decode($json_data, true);

                if (json_last_error() === JSON_ERROR_NONE && is_array($raw_map_list)) {
                    foreach ($raw_map_list as $entry) {
                        $field_id = $entry['form_id'] ?? 0; // 'form_id' is the WPForms field ID
                        $item_id = $entry['item_id'] ?? '';
                        if ($field_id > 0 && !empty($item_id)) {
                            $map[$field_id] = $item_id;
                        }
                    }
                } else {
                    error_log("Psychometric Assessment: Error decoding field_to_item.json: " . json_last_error_msg());
                }
            } else {
                error_log("Psychometric Assessment: field_to_item.json not found at {$file_path}");
            }
            $this->wpforms_field_to_item_id_map = $map;
        }
        return $this->wpforms_field_to_item_id_map;
    }

    /**
     * Loads question details from question_list_data.json.
     * Caches the result to avoid re-reading the file during the same request.
     * @return array
     */
    private function load_question_details() {
        if ($this->question_details === null) {
            $details = [];
            // Assuming JSON is in the same plugin directory
            $file_path = plugin_dir_path(__FILE__) . 'question_list_data.json'; 

            if (file_exists($file_path)) {
                $json_data = file_get_contents($file_path);
                $raw_details = json_decode($json_data, true);

                if (json_last_error() === JSON_ERROR_NONE && is_array($raw_details)) {
                    foreach ($raw_details as $item_id => $data) {
                        $sub_category = $data['sub_category'] ?? '';
                        if ($sub_category === 'NaN') {
                            $sub_category = 'N/A'; // Consistent with DB storage
                        }
                        $details[$item_id] = [
                            'scale' => $data['scale'] ?? 'N/A',
                            'sub_category' => $sub_category,
                            'reversal' => $data['reversal'] ?? false,
                            'min_score' => $data['min_val'] ?? 1,
                            'max_score' => $data['max_val'] ?? 5,
                            'is_catch' => $data['is_catch'] ?? false,
                        ];
                    }
                } else {
                    error_log("Psychometric Assessment: Error decoding question_list_data.json: " . json_last_error_msg());
                }
            } else {
                error_log("Psychometric Assessment: question_list_data.json not found at {$file_path}");
            }
            $this->question_details = $details;
        }
        return $this->question_details;
    }

    /**
     * Loads assessment scoring rules from assessment_data.json.
     * Caches the result to avoid re-reading the file during the same request.
     * @return array
     */
    private function load_assessment_scoring_rules() {
        if ($this->assessment_scoring_rules === null) {
            $rules = [];
            // Assuming JSON is in the same plugin directory
            $file_path = plugin_dir_path(__FILE__) . 'assessment_data.json'; 

            if (file_exists($file_path)) {
                $json_data = file_get_contents($file_path);
                $raw_rules_list = json_decode($json_data, true);

                if (json_last_error() === JSON_ERROR_NONE && is_array($raw_rules_list)) {
                    foreach ($raw_rules_list as $rule_entry) {
                        $assessment_name = $rule_entry['Assessment'] ?? 'Unknown';
                        $sub_category = $rule_entry['sub-category'] ?? '';
                        if ($sub_category === 'NaN') {
                            $sub_category = 'N/A'; // Consistent with DB storage
                        }
                        $rule_key = $assessment_name . '_' . $sub_category;

                        $rules[$rule_key] = [
                            'method' => $rule_entry['Score Cal Method'] ?? 'SUM',
                            'threshold' => floatval($rule_entry['Adopted Score'] ?? 0),
                            'condition' => $rule_entry['Unnamed: 12'] ?? '',
                            'mean' => floatval($rule_entry['mean'] ?? 0), // Load mean
                            'sd' => floatval($rule_entry['sd'] ?? 0),     // Load sd
                            'ratio' => floatval($rule_entry['ratio'] ?? 0), // Load ratio
                        ];
                    }
                } else {
                    error_log("Psychometric Assessment: Error decoding assessment_data.json: " . json_last_error_msg());
                }
            } else {
                error_log("Psychometric Assessment: assessment_data.json not found at {$file_path}");
            }
            $this->assessment_scoring_rules = $rules;
        }
        return $this->assessment_scoring_rules;
    }

    /**
     * Creates the custom database table to store psychometric results.
     * This function will create/update the table with the new consolidated structure.
     */
    public function create_db_table() {
        global $wpdb;
        $charset_collate = $wpdb->get_charset_collate();

        // SQL to create the table with the new consolidated structure
        // Added 'overall_score', 'tu_grade', and 'probability_of_default' columns
        $sql = "CREATE TABLE IF NOT EXISTS {$this->db_table_name} (
            id BIGINT(20) NOT NULL AUTO_INCREMENT,
            user_id BIGINT(20) DEFAULT 0 NOT NULL,
            form_entry_id BIGINT(20) NOT NULL,
            assessment_date DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
            raw_answers_json TEXT NOT NULL, -- JSON encoded array of item_id => raw_score
            all_scores_data_json TEXT NOT NULL, -- JSON encoded object of Scale_SubCategory => calculated_score
            overall_score DECIMAL(10,2) DEFAULT 0.00 NOT NULL, -- Overall score
            tu_grade VARCHAR(10) DEFAULT 'N/A' NOT NULL, -- New column for TU Grade
            probability_of_default DECIMAL(10,2) DEFAULT 0.00 NOT NULL, -- New column for Probability of Default
            validation_flag VARCHAR(255) DEFAULT 'None' NOT NULL, -- e.g., 'Passed Catch', 'Failed Catch', 'Suspicious Pattern'
            PRIMARY KEY (id),
            KEY user_id (user_id),
            KEY form_entry_id (form_entry_id)
        ) $charset_collate;";

        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }

    /**
     * Calculates the Z-score for a given raw score, mean, and standard deviation.
     * Z = (X - μ) / σ
     * @param float $score
     * @param float $mean
     * @param float $sd
     * @return float
     */
    private function calculate_z_score($score, $mean, $sd) {
        if ($sd == 0) {
            return 0.0; // Avoid division by zero, handle cases with no variance
        }
        return ($score - $mean) / $sd;
    }

    /**
     * Calculates the cumulative distribution function (CDF) for a standard normal distribution.
     * This uses a common approximation for the error function (erf) in pure PHP.
     * This gives the probability P(Z <= z_score), which is equivalent to Accu< (percentile less than).
     * @param float $z_score
     * @return float
     */
    private function standard_normal_cdf($z_score) {
        // Constants for the approximation
        $a1 = 0.254829592;
        $a2 = -0.284496736;
        $a3 = 1.421413741;
        $a4 = -1.453152027;
        $a5 = 1.061405429;
        $p = 0.3275911;

        $sign = ($z_score < 0) ? -1 : 1;
        $x = abs($z_score) / sqrt(2); // Using sqrt() which is a standard PHP function
        $t = 1.0 / (1.0 + $p * $x);
        
        // Horner's method for polynomial evaluation
        $y = 1.0 - (((((($a5 * $t + $a4) * $t) + $a3) * $t) + $a2) * $t + $a1) * $t * exp(-$x * $x);
        
        return 0.5 * (1.0 + $sign * $y);
    }

    /**
     * Calculates the appropriate percentile (Accu< or Accu>) based on the assessment's condition.
     * @param float $calculated_score
     * @param float $mean
     * @param float $sd
     * @param string $condition '<=' or '>='
     * @return float The percentile value (between 0 and 1)
     */
    private function get_percentile($calculated_score, $mean, $sd, $condition) {
        $z_score = $this->calculate_z_score($calculated_score, $mean, $sd);
        
        // Accu< is directly given by the CDF
        $percentile_accu_less = $this->standard_normal_cdf($z_score);
        
        // Accu> is 1 - Accu<
        $percentile_accu_greater = 1 - $percentile_accu_less;

        if ($condition === "<=") {
            // For conditions like '<=', we are interested in the percentile *below* the score.
            // So, we use Accu<
            return $percentile_accu_less;
        } elseif ($condition === ">=") {
            // For conditions like '>=', we are interested in the percentile *above* the score.
            // So, we use Accu>
            return $percentile_accu_greater;
        } else {
            error_log("Psychometric Assessment: Unknown condition '{$condition}'. Defaulting to Accu< percentile.");
            return $percentile_accu_less;
        }
    }

    /**
     * Looks up TU Grade and Probability of Default based on overall score.
     * @param float $overall_score
     * @return array Associative array with 'tu_grade' and 'probability_of_default'.
     */
    private function get_tu_grade_and_pd($overall_score) {
        $tu_grade = 'N/A';
        $probability_of_default = 0.00;

        // Iterate through the lookup table
        foreach (self::TU_LOOKUP_TABLE as $row) {
            $cum_pop = $row[0];
            $grade = $row[1];
            $high_pd = $row[2];

            // Find the first entry where overall_score is less than or equal to Cum. Pop
            if ($overall_score <= $cum_pop) {
                $tu_grade = $grade;
                $probability_of_default = $high_pd;
                break; // Found the grade, exit loop
            }
        }

        // Fallback if no matching grade is found (should ideally not happen with comprehensive table and cap)
        if ($tu_grade === 'N/A' && !empty(self::TU_LOOKUP_TABLE)) {
            $last_row = end(self::TU_LOOKUP_TABLE);
            $tu_grade = $last_row[1];
            $probability_of_default = $last_row[2];
        }

        return [
            'tu_grade' => $tu_grade,
            'probability_of_default' => round($probability_of_default, 2) // Round PD to 2 decimal places
        ];
    }

    /**
     * Processes the WPForms submission data.
     *
     * @param array $fields    List of form fields.
     * @param array $entry     Original form entry data.
     * @param array $form_data Form data and settings.
     * @param int   $entry_id  Entry ID.
     */
    public function process_psychometric_submission($fields, $entry, $form_data, $entry_id) {
        // Only process the specific psychometric test form.
        if ( (int) $form_data['id'] !== (int) $this->psychometric_form_id ) {
            return;
        }

        // Load data just-in-time when needed for calculation
        $wpforms_field_to_item_id_map = $this->load_wpforms_field_to_item_id_map();
        $question_details = $this->load_question_details();
        $assessment_scoring_rules = $this->load_assessment_scoring_rules();

        $user_id = get_current_user_id(); // Get the ID of the logged-in user. 0 if not logged in.
        $submitted_answers_raw = []; // Stores raw user input mapped by item_id
        $scores_by_category = []; // Stores aggregated scores by scale and sub-category for final calculation
        $catch_item_answers = []; // To check for suspicious patterns

        // 1. Map WPForms field IDs to item_ids and store raw and processed answers.
        foreach ( $fields as $field_id => $field_data ) {
            if ( isset( $wpforms_field_to_item_id_map[ $field_id ] ) ) {
                $item_id = $wpforms_field_to_item_id_map[ $field_id ];
                $raw_value = (int) $field_data['value'];

                $submitted_answers_raw[ $item_id ] = $raw_value; // Store raw value for validation/audit

                if ( ! isset( $question_details[ $item_id ] ) ) {
                    error_log( "Psychometric Assessment: Missing details for item_id: {$item_id} (Field ID: {$field_id})" );
                    continue;
                }

                $details = $question_details[ $item_id ];
                $scale = $details['scale'];
                // Use 'N/A' if sub_category is empty in question_details, for consistency in database.
                $sub_category = empty($details['sub_category']) ? 'N/A' : $details['sub_category'];
                $min_score = $details['min_score'];
                $max_score = $details['max_score'];
                $is_reversal = $details['reversal'];
                $is_catch_item = $details['is_catch'];

                // Apply reversal logic.
                $actual_score = $raw_value;
                if ( $is_reversal ) {
                    $actual_score = ( $min_score + $max_score ) - $raw_value;
                }

                // Aggregate scores for calculation per category.
                if ( ! isset( $scores_by_category[ $scale ] ) ) {
                    $scores_by_category[ $scale ] = [];
                }
                if ( ! isset( $scores_by_category[ $scale ][ $sub_category ] ) ) {
                    $scores_by_category[ $scale ][ $sub_category ] = [];
                }
                $scores_by_category[ $scale ][ $sub_category ][] = $actual_score;

                // Store catch item answers for validation.
                if ( $is_catch_item ) {
                    $catch_item_answers[] = $raw_value;
                }
            }
        }

        // 2. Perform Catch Item validation.
        $catch_validation_flag = 'None';
        if ( ! empty( $catch_item_answers ) ) {
            // A simple check: if all catch answers are the same (e.g., all 5s or all 1s)
            $unique_catch_answers = array_unique($catch_item_answers);
            if (count($unique_catch_answers) === 1) {
                $catch_validation_flag = 'Suspicious Pattern: Consistent Catch Answers';
            } else {
                $catch_validation_flag = 'Passed Catch';
            }
        }

        // 3. Calculate final scores for each scale/sub-category based on rules.
        //    Store these in an associative array for the all_scores_data_json field.
        $all_scores_data = []; 
        $overall_score_contributions = []; // To store percentile * ratio for overall score calculation

        foreach ( $scores_by_category as $scale => $sub_categories ) {
            foreach ( $sub_categories as $sub_category => $scores_array ) {
                // Determine the rule key: Scale_SubCategory (or Scale_N/A if sub_category is 'N/A')
                $rule_key_for_lookup = $scale . '_' . ( empty( $sub_category ) || $sub_category === 'N/A' ? 'N/A' : $sub_category );
                $rule = $assessment_scoring_rules[ $rule_key_for_lookup ] ?? null;

                $calculated_value = 0;
                $pass_status = 'N/A'; // Default pass_status for internal logic

                if ( $rule ) {
                    switch ( $rule['method'] ) {
                        case 'SUM':
                            $calculated_value = array_sum( $scores_array );
                            break;
                        case 'AVG':
                            $calculated_value = count( $scores_array ) > 0 ? array_sum( $scores_array ) / count( $scores_array ) : 0;
                            break;
                        case 'SUM x 2': // Specific for DASS-21, as per assessment_data.json
                            $calculated_value = array_sum( $scores_array ) * 2;
                            break;
                        default:
                            error_log( "Psychometric Assessment: Unknown calculation method for {$rule_key_for_lookup}: {$rule['method']}" );
                            $calculated_value = array_sum( $scores_array ); // Fallback to sum
                            break;
                    }

                    // Determine pass/fail status (though not stored, still part of original logic)
                    if ( $rule['condition'] === '<=' ) {
                        $pass_status = ( $calculated_value <= $rule['threshold'] ) ? 'PASS' : 'FAIL';
                    } elseif ( $rule['condition'] === '>=' ) {
                        $pass_status = ( $calculated_value >= $rule['threshold'] ) ? 'PASS' : 'FAIL';
                    } else {
                        error_log( "Psychometric Assessment: Unknown condition for {$rule_key_for_lookup}: {$rule['condition']}" );
                    }
                    
                    // Only include in all_scores_data if a rule was found
                    $display_key = empty( $sub_category ) || $sub_category === 'N/A' ? $scale : "{$scale}_{$sub_category}";
                    $all_scores_data[$display_key] = round( $calculated_value, 2 );

                    // Calculate percentile for overall score if mean, sd, and ratio are available
                    if (isset($rule['mean']) && isset($rule['sd']) && isset($rule['ratio'])) {
                        $percentile = $this->get_percentile($calculated_value, $rule['mean'], $rule['sd'], $rule['condition']);
                        $overall_score_contributions[] = $percentile * $rule['ratio'];
                    } else {
                        error_log("Psychometric Assessment: Missing mean, sd, or ratio for percentile calculation for {$rule_key_for_lookup}.");
                    }

                } else {
                    // This sub-category will NOT be added to all_scores_data, thus removed/hidden.
                    error_log("Psychometric Assessment: Skipping sub-category '{$rule_key_for_lookup}' from storage due to no defined rule.");
                }
            }
        }

        // 4. Calculate the overall score using percentiles
        $overall_score = array_sum($overall_score_contributions);

        // Multiply by 100 to convert to percentage
        $overall_score = $overall_score * 100; 

        // Apply the conversion factor
        $overall_score = $overall_score * self::CONVERSION_FACTOR;

        // Apply the cap: if it exceeds 100, make it 99
        if ($overall_score > 100) {
            $overall_score = 99;
        }
        // Round to the nearest whole number (nearest digit)
        $overall_score = round($overall_score, 0);

        // 5. Look up TU Grade and Probability of Default
        $tu_data = $this->get_tu_grade_and_pd($overall_score);
        $tu_grade = $tu_data['tu_grade'];
        $probability_of_default = $tu_data['probability_of_default'];


        // 6. Store the single consolidated result row in the custom database table.
        global $wpdb;
        
        // Check if an entry for this form_entry_id already exists to prevent duplicates
        $existing_entry_id = $wpdb->get_var( $wpdb->prepare(
            "SELECT id FROM {$this->db_table_name} WHERE form_entry_id = %d",
            $entry_id
        ));

        // Use json_encode for the all_scores_data
        $all_scores_data_json = json_encode($all_scores_data);

        if ($existing_entry_id) {
            // Update existing row
            $wpdb->update(
                $this->db_table_name,
                [
                    'user_id'              => $user_id,
                    'assessment_date'      => current_time( 'mysql' ),
                    'raw_answers_json'     => json_encode( $submitted_answers_raw ), 
                    'all_scores_data_json' => $all_scores_data_json, 
                    'overall_score'        => $overall_score,
                    'tu_grade'             => $tu_grade, // New column data
                    'probability_of_default' => $probability_of_default, // New column data
                    'validation_flag'      => $catch_validation_flag,
                ],
                [ 'form_entry_id' => $entry_id ],
                [ '%d', '%s', '%s', '%s', '%f', '%s', '%f', '%s' ], // Updated format string
                [ '%d' ]
            );
            error_log("Psychometric Assessment: Updated existing entry for form_entry_id: {$entry_id}");
        } else {
            // Insert new row
            $wpdb->insert(
                $this->db_table_name,
                [
                    'user_id'              => $user_id,
                    'form_entry_id'        => $entry_id,
                    'assessment_date'      => current_time( 'mysql' ),
                    'raw_answers_json'     => json_encode( $submitted_answers_raw ), 
                    'all_scores_data_json' => $all_scores_data_json, 
                    'overall_score'        => $overall_score,
                    'tu_grade'             => $tu_grade, // New column data
                    'probability_of_default' => $probability_of_default, // New column data
                    'validation_flag'      => $catch_validation_flag,
                ],
                [ '%d', '%d', '%s', '%s', '%s', '%f', '%s', '%f', '%s' ] // Updated format string
            );
            error_log("Psychometric Assessment: Inserted new entry for form_entry_id: {$entry_id}");
        }


        if ($wpdb->last_error) {
            error_log("Psychometric Assessment: Database Operation Error: " . $wpdb->last_error);
            error_log("Psychometric Assessment: Last Query: " . $wpdb->last_query);
        }
    }

    /**
     * Optional: Implement "only once answer" feature.
     * This function would be hooked to 'wpforms_process_before_save'.
     * It checks if the current user (if logged in) has already submitted this form.
     * If they have, it adds an error to WPForms, preventing the submission.
     *
     * @param array $fields    List of form fields.
     * @param array $form_data Form data and settings.
     */
    public function check_single_submission($fields, $form_data) {
        // Only apply to the specific psychometric test form.
        if ( (int) $form_data['id'] !== (int) $this->psychometric_form_id ) {
            return;
        }

        $user_id = get_current_user_id();

        // Only apply this logic for logged-in users.
        if ( $user_id === 0 ) {
            // Optionally, you can add a WPForms error here if you want to force login for the test.
            wpforms()->process->add_error( $form_data['id'], 'Please log in to take this test.' );
            return;
        }

        global $wpdb;
        $existing_submission = $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$this->db_table_name} WHERE user_id = %d",
            $user_id
        ) );

        if ( $existing_submission > 0 ) {
            // User has already submitted, add an error to prevent this submission.
            // The error message will be displayed to the user on the form.
            wpforms()->process->add_error( $form_data['id'], 'You have already completed this psychometric test. Submissions are limited to once per user.' );
        }
    }


    /**
     * Adds an admin menu page for viewing results.
     */
    public function add_admin_menu() {
        add_menu_page(
            'Psychometric Results',
            'Psychometric Results',
            'manage_options',
            'psychometric-results',
            [$this, 'display_results_page'],
            'dashicons-clipboard',
            30
        );
    }

    /**
     * Displays the psychometric results in the admin area.
     */
    public function display_results_page() {
        global $wpdb;
        // Select the new all_scores_data_json and overall_score columns
        $results = $wpdb->get_results( "SELECT id, user_id, form_entry_id, assessment_date, raw_answers_json, all_scores_data_json, overall_score, tu_grade, probability_of_default, validation_flag FROM {$this->db_table_name} ORDER BY assessment_date DESC" );
        ?>
        <div class="wrap">
            <h1>Psychometric Test Results</h1>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>User ID</th>
                        <th>Form Entry ID</th>
                        <th>Date</th>
                        <th>Validation Flag</th>
                        <th>Overall Score</th>
                        <th>TU Grade</th> <!-- New header -->
                        <th>Prob. of Default</th> <!-- New header -->
                        <th>Scores</th>
                        <th>Raw Answers (JSON)</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if ( $results ) : ?>
                        <?php foreach ( $results as $row ) :
                            $user_info = get_userdata( $row->user_id );
                            $user_display_name = $user_info ? $user_info->display_name . ' (' . $row->user_id . ')' : 'Guest (' . $row->user_id . ')';
                            
                            $scores_data = json_decode($row->all_scores_data_json, true);
                            $scores_display = '';
                            if (is_array($scores_data) && !empty($scores_data)) {
                                foreach ($scores_data as $key => $score) {
                                    $scores_display .= esc_html($key) . ': ' . esc_html($score) . '<br>';
                                }
                            } else {
                                $scores_display = 'No scores processed.';
                            }
                        ?>
                            <tr>
                                <td><?php echo esc_html( $row->id ); ?></td>
                                <td><?php echo esc_html( $user_display_name ); ?></td>
                                <td><?php echo esc_html( $row->form_entry_id ); ?></td>
                                <td><?php echo esc_html( $row->assessment_date ); ?></td>
                                <td><?php esc_html_e( $row->validation_flag ); ?></td>
                                <td><?php echo esc_html( $row->overall_score ); ?></td>
                                <td><?php echo esc_html( $row->tu_grade ); ?></td> <!-- Display TU Grade -->
                                <td><?php echo esc_html( $row->probability_of_default ) . '%'; ?></td> <!-- Display Prob. of Default -->
                                <td><?php echo $scores_display; ?></td>
                                <td style="font-size: 0.8em; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="<?php echo esc_attr( $row->raw_answers_json ); ?>"><?php echo esc_html( $row->raw_answers_json ); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    <?php else : ?>
                        <tr>
                            <td colspan="10">No psychometric results found yet.</td>
                        </tr>
                    <?php endif; ?>
                </tbody>
            </table>
        </div>
        <?php
    }

    /**
     * Activation hook to ensure table is created on plugin activation.
     */
    public static function activate() {
        $processor = new self(); // Create an instance to call create_db_table
        $processor->create_db_table();
    }
}

// Register activation hook.
register_activation_hook( __FILE__, ['Psychometric_Assessment_Processor', 'activate'] );

// Instantiate the processor. This will register all its hooks.
new Psychometric_Assessment_Processor();