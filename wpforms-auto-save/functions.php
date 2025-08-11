<?php

// If there's no closing PHP tag, simply paste it at the end.

/**
 * Enqueue JavaScript for auto-saving and loading WPForms drafts.
 */
function my_wpforms_auto_save_script() {
    // IMPORTANT: Replace 'application' with the actual slug of your page
    // where the application form is embedded. Example: if your URL is yourdomain.com/application/, use 'application'.
    // If you want it on ALL pages with a WPForm, remove the `is_page('application') &&` condition.
    if ( is_page('applications') && is_user_logged_in() ) { // Corrected 'applications)' to 'application')
        wp_enqueue_script(
            'wpforms-auto-save',
            get_stylesheet_directory_uri() . '/js/wpforms-auto-save.js', // Path to your JS file
            array('jquery'), // Depends on jQuery (WPForms uses it)
            '1.0.0', // Version number (can be anything, helps with caching to ensure fresh load)
            true // Load in footer
        );

        // Get the current user's saved draft data
        $user_id = get_current_user_id();
        // IMPORTANT: Replace '644' with your actual WPForms Application Form ID.
        // You can find this ID in the WPForms builder URL (e.g., ...&form_id=644).
        $form_id_for_meta = 644; 
        $meta_key = 'wpforms_application_draft_' . $form_id_for_meta;
        $saved_draft = get_user_meta( $user_id, $meta_key, true );

        // Localize the script to pass PHP data to JavaScript
        wp_localize_script(
            'wpforms-auto-save',
            'myWpformsAutoSave', // This will be the global JS object name in JavaScript
            array(
                'ajaxurl' => admin_url( 'admin-ajax.php' ),
                'nonce'   => wp_create_nonce( 'wpforms_auto_save_nonce' ),
                'savedDraft' => $saved_draft ? json_decode( $saved_draft, true ) : null,
                'formId' => $form_id_for_meta // Pass the form ID to JavaScript
            )
        );
    }
}
add_action( 'wp_enqueue_scripts', 'my_wpforms_auto_save_script' );

/**
 * Handles the AJAX request to save WPForms draft data.
 */
function my_save_wpforms_draft_ajax() {
    // Check for nonce for security
    if ( ! isset( $_POST['nonce'] ) || ! wp_verify_nonce( $_POST['nonce'], 'wpforms_auto_save_nonce' ) ) {
        wp_send_json_error( 'Nonce verification failed.' );
    }

    // Ensure user is logged in
    if ( ! is_user_logged_in() ) {
        wp_send_json_error( 'User not logged in.' );
    }

    $user_id = get_current_user_id();
    $form_data = isset( $_POST['form_data'] ) ? sanitize_text_field( wp_unslash( $_POST['form_data'] ) ) : '';
    $form_id = isset( $_POST['form_id'] ) ? absint( $_POST['form_id'] ) : 0;

    if ( empty( $form_data ) || empty( $form_id ) ) {
        wp_send_json_error( 'Invalid data provided.' );
    }

    // Store the form data as a JSON string in user meta
    // The meta key includes the form ID to support multiple forms if needed
    $meta_key = 'wpforms_application_draft_' . $form_id;
    update_user_meta( $user_id, $meta_key, $form_data );

    wp_send_json_success( 'Draft saved successfully!' );
}
// Hook for logged-in users
add_action( 'wp_ajax_save_wpforms_draft', 'my_save_wpforms_draft_ajax' ); 

/**
 * Hook into WPForms successful submission to clear the saved draft.
 * This is crucial to ensure the draft is removed after an application is completed.
 * IMPORTANT: Replace '644' in the hook name with your actual WPForms Application Form ID.
 * You can find this ID in the WPForms builder URL (e.g., ...&form_id=644).
 */
add_action( 'wpforms_process_complete_644', 'my_clear_draft_on_wpforms_submit', 10, 3 );

function my_clear_draft_on_wpforms_submit( $fields, $entry, $form_data ) {
    // Only clear if a user is logged in (anonymous submissions won't have a user meta to clear)
    if ( is_user_logged_in() ) {
        $user_id = get_current_user_id();
        $form_id = absint( $form_data['id'] ); // Get the form ID from the submitted data
        $meta_key = 'wpforms_application_draft_' . $form_id;
        
        // Delete the saved draft for the current user and form
        delete_user_meta( $user_id, $meta_key );
    }
}