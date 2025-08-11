document.addEventListener('DOMContentLoaded', function() {
    // Get references to the WPForms dropdowns and other elements
    // IMPORTANT: Replace these IDs with the actual IDs from your WPForms setup.
    // Use your browser's inspect tool to find them (e.g., 'wpforms-60-field_1', 'wpforms-60-field_2', etc.)
    const nationalitySelect = document.getElementById('wpforms-60-field_3'); // <--- VERIFY THIS ID
    const studyDestinationSelect = document.getElementById('wpforms-60-field_1'); // <--- VERIFY THIS ID
    const hkidAddressProofSelect = document.getElementById('wpforms-60-field_4'); // <--- VERIFY THIS ID (Still needed for eligibility calculation)
    const degreeTypeSelect = document.getElementById('wpforms-60-field_5'); // <--- VERIFY THIS ID
    // ---------------------------------------------------------------------------------

    const checkEligibilityBtn = document.querySelector('.check-eligibility-btn');
    const eligibleMessage = document.querySelector('.eligible-message');
    const ineligibleMessage = document.querySelector('.ineligible-message');

    // Function to check if all *required* fields are filled to enable/disable the button
    // The HKID field is NOT considered for button enablement in this version.
    function updateCheckButtonState() {
        const nationalitySelected = nationalitySelect && nationalitySelect.value !== '';
        const studyDestinationSelected = studyDestinationSelect && studyDestinationSelect.value !== '';
        const degreeTypeSelected = degreeTypeSelect && degreeTypeSelect.value !== '';

        // The button is enabled only if Nationality, Study Destination, and Degree Type are selected.
        const allRequiredFieldsSelected = nationalitySelected && studyDestinationSelected && degreeTypeSelected;

        if (checkEligibilityBtn) {
            if (allRequiredFieldsSelected) {
                checkEligibilityBtn.classList.remove('disabled');
                checkEligibilityBtn.removeAttribute('disabled');
            } else {
                checkEligibilityBtn.classList.add('disabled');
                checkEligibilityBtn.setAttribute('disabled', 'disabled');
            }
        }
    }

    // Function to hide all eligibility messages
    function hideEligibilityMessages() {
        if (eligibleMessage) eligibleMessage.style.display = 'none';
        if (ineligibleMessage) ineligibleMessage.style.display = 'none';
    }

    // Initial state: hide messages and disable button
    hideEligibilityMessages();
    updateCheckButtonState(); // Set initial button state based on initial form values

    // Event listeners for all dropdowns to hide messages and update button state
    [nationalitySelect, studyDestinationSelect, hkidAddressProofSelect, degreeTypeSelect].forEach(selectElement => {
        // Ensure the element actually exists before adding an event listener
        if (selectElement) {
            selectElement.addEventListener('change', function() {
                hideEligibilityMessages();
                updateCheckButtonState(); // Re-evaluate button state
            });
        }
    });

    // Handle the eligibility check when the button is clicked
    if (checkEligibilityBtn) {
        checkEligibilityBtn.addEventListener('click', function(event) {
            event.preventDefault();

            // Prevent action if button is disabled
            if (this.classList.contains('disabled')) {
                return;
            }

            hideEligibilityMessages(); // Hide previous messages before showing new one

            // Get current values from all dropdowns
            const nationality = nationalitySelect ? nationalitySelect.value : '';
            const studyDestination = studyDestinationSelect ? studyDestinationSelect.value : '';
            const hkidAddressProof = hkidAddressProofSelect ? hkidAddressProofSelect.value : ''; // Value still read for eligibility logic
            const degreeType = degreeTypeSelect ? degreeTypeSelect.value : '';

            let isEligible = false;

            // Define ineligible degree types
            const ineligibleDegrees = new Set(['Master Degree (Research)', 'P.h.D']);

            // Define eligible study destinations for HKSAR (and now for certain non-HKSAR cases)
            const eligibleStudyDestinations = new Set(['United Kingdom', 'United States', 'Canada', 'Australia', 'Singapore', 'Hong Kong', 'Mainland China']);

            // Your provided eligibility logic with the new refinement:
            if (nationality === 'Hong Kong SAR') { // Use 'Hong Kong SAR' as per your screenshot
                if (eligibleStudyDestinations.has(studyDestination) && !ineligibleDegrees.has(degreeType)) {
                    isEligible = true;
                }
            } else { // Nationality is not "Hong Kong SAR"
                if (studyDestination === 'Hong Kong') {
                    if (!ineligibleDegrees.has(degreeType)) {
                        isEligible = true;
                    }
                } else { // Nationality not Hong Kong SAR, AND not studying in HK
                    // NEW LOGIC: Must have HKID, NOT be an ineligible degree, AND study destination must be in the eligible list.
                    if (hkidAddressProof === 'Yes' && !ineligibleDegrees.has(degreeType) && eligibleStudyDestinations.has(studyDestination)) {
                        isEligible = true;
                    }
                }
            }

            // Display result based on eligibility
            if (isEligible) {
                if (eligibleMessage) eligibleMessage.style.display = 'block';
            } else {
                if (ineligibleMessage) ineligibleMessage.style.display = 'block';
            }
        });
    } else {
        console.error('ERROR: Check Eligibility button not found.');
    }
});