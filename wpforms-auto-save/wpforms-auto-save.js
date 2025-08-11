// This script assumes jQuery is available (which it is in WordPress)
// and that 'myWpformsAutoSave' object is localized from PHP.

jQuery(document).ready(function($) {
    // Main wrapper for script execution, reduced to ensure general form loads quickly
    setTimeout(function() {

        if (typeof myWpformsAutoSave === 'undefined' || !myWpformsAutoSave.formId) {
            console.warn('WPForms Auto Save: Missing localized data or form ID. Script not running.');
            return;
        }

        const formId = myWpformsAutoSave.formId;
        const $form = $('#wpforms-form-' + formId);
        const savedDraft = myWpformsAutoSave.savedDraft;
        let saveTimeout;
        // Removed: const $saveButton = $('#save-draft-button'); // Selector for your save button
        const $saveMessage = $('#save-draft-message'); // Selector for a message area

        if ($form.length === 0) {
            console.warn('WPForms Auto Save: Form with ID ' + formId + ' not found. Exiting script.');
            return;
        }
        console.log('WPForms form found:', $form);


        /**
         * Collects all relevant field values from the WPForms form.
         * Handles various input types including text, select, radio, and checkboxes.
         * @returns {Object} An object where keys are field names/IDs and values are their current input.
         */
        function collectFormData() {
            const formData = {};
            $form.find(':input:not(:button):not(:submit):not(:reset)').each(function() {
                const $this = $(this);
                const name = $this.attr('name');
                const id = $this.attr('id');
                let value;

                if (!name && !id) {
                    return;
                }

                if ($this.is(':checkbox')) {
                    if ($this.is(':checked')) {
                        if (name) {
                            if (!formData[name]) {
                                formData[name] = [];
                            }
                            formData[name].push($this.val());
                        } else {
                            formData[id] = $this.val();
                        }
                    }
                } else if ($this.is(':radio')) {
                    if ($this.is(':checked')) {
                        value = $this.val();
                        if (name) formData[name] = value;
                        else formData[id] = value;
                    }
                } else if ($this.is('select')) {
                    if ($this.prop('multiple')) {
                        value = $this.val() || [];
                    } else {
                        value = $this.val();
                    }
                    if (name) formData[name] = value;
                    else formData[id] = value;
                } else if ($this.is('input[type="tel"]') && $this.hasClass('wpforms-field-phone')) {
                    formData[name] = $this.val();

                    if ($this.data('intlTelInput')) {
                        const intlTelInputInstance = $this.data('intlTelInput');
                        try {
                            formData[name + '_full_number'] = intlTelInputInstance.getNumber();
                            formData[name + '_country_iso2'] = intlTelInputInstance.getSelectedCountryData().iso2;
                            formData[name + '_dial_code'] = intlTelInputInstance.getSelectedCountryData().dialCode;
                        } catch (e) {
                            console.warn('WPForms Auto Save: intlTelInput API error during collectFormData:', e);
                        }
                    }

                    const $selectedFlagDiv = $this.closest('.wpforms-field-phone').find('.iti__selected-flag');
                    if ($selectedFlagDiv.length) {
                        const countryIso2Match = $selectedFlagDiv.find('.iti__flag').attr('class').match(/iti__([a-zA-Z]{2})/);
                        if (countryIso2Match && countryIso2Match[1]) {
                            formData[name + '_country_iso2_fallback'] = countryIso2Match[1];
                        }
                        const dialCode = $selectedFlagDiv.find('.iti__selected-dial-code').text().replace('+', '');
                        if (dialCode) {
                            formData[name + '_dial_code_fallback'] = dialCode;
                        }
                    }

                    const $hiddenFullNumber = $this.parent().find(`input[type="hidden"][name="${name}-full"]`);
                    if ($hiddenFullNumber.length) {
                         formData[name + '_wpforms_full'] = $hiddenFullNumber.val();
                    }

                } else if ($this.is('input[type="file"]')) {
                    console.log('File input detected, but cannot be saved in draft with this method:', $this.attr('name'));
                    return;
                } else {
                    value = $this.val();
                    if (name) formData[name] = value;
                    else formData[id] = value;
                }
            });
            return formData;
        }

        /**
         * Sends the current form data to the server for saving via AJAX.
         */
        function saveFormDraft() {
            const formData = collectFormData();

            if (Object.keys(formData).length === 0) {
                if ($saveMessage.length) {
                    $saveMessage.text('No changes to save.').css('color', 'grey').show();
                    setTimeout(() => $saveMessage.fadeOut(), 3000);
                }
                return;
            }

            if ($saveMessage.length) {
                $saveMessage.text('Saving draft...').css('color', 'orange').show();
            }

            $.ajax({
                url: myWpformsAutoSave.ajaxurl,
                type: 'POST',
                data: {
                    action: 'save_wpforms_draft',
                    nonce: myWpformsAutoSave.nonce,
                    form_data: JSON.stringify(formData),
                    form_id: formId
                },
                success: function(response) {
                    if (response.success) {
                        if ($saveMessage.length) {
                            $saveMessage.text('Draft saved!').css('color', 'green').show();
                            setTimeout(() => $saveMessage.fadeOut(), 3000);
                        }
                    } else {
                         if ($saveMessage.length) {
                            $saveMessage.text('Error saving draft.').css('color', 'red').show();
                            setTimeout(() => $saveMessage.fadeOut(), 3000);
                        }
                    }
                },
                error: function(xhr, status, error) {
                    if ($saveMessage.length) {
                        $saveMessage.text('Error saving draft.').css('color', 'red').show();
                        setTimeout(() => $saveMessage.fadeOut(), 3000);
                    }
                }
            });
        }

        /**
         * Attempts to load saved data for a specific phone field.
         * Returns true if successful (field found and data applied), false otherwise.
         */
        function attemptLoadPhoneField($field, key, savedDraft) {
            const value = savedDraft[key];
            const savedCountryIso2 = savedDraft[key + '_country_iso2'] || savedDraft[key + '_country_iso2_fallback'];
            const savedDialCode = savedDraft[key + '_dial_code'] || savedDraft[key + '_dial_code_fallback'];
            const savedFullNumber = savedDraft[key + '_full_number'] || savedDraft[key + '_wpforms_full'];

            const intlTelInputInstance = $field.data('intlTelInput');
            const $selectedFlagContainer = $field.closest('.wpforms-field-phone').find('.iti__selected-flag');
            const $selectedFlag = $selectedFlagContainer.find('.iti__flag');
            const $selectedDialCodeSpan = $selectedFlagContainer.find('.iti__selected-dial-code');

            if (!$selectedFlag.length || !$selectedDialCodeSpan.length) {
                return false;
            }

            $field.val(value);

            if (intlTelInputInstance) {
                try {
                    if (savedFullNumber) {
                        intlTelInputInstance.setNumber(savedFullNumber);
                    } else if (savedCountryIso2) {
                        intlTelInputInstance.setCountry(savedCountryIso2);
                    }
                } catch (e) {
                    console.warn('WPForms Auto Save: intlTelInput API error during attemptLoadPhoneField:', e);
                }
            }

            if (savedCountryIso2) {
                $selectedFlag.removeClass(function(index, className) {
                    return (className.match(/(^|\s)iti__\S+/g) || []).join(' ');
                }).addClass('iti__' + savedCountryIso2);
            }
            if (savedDialCode) {
                $selectedDialCodeSpan.text('+' + savedDialCode);
            }

            if (savedCountryIso2 && intlTelInputInstance && intlTelInputInstance.getSelectedCountryData().iso2 !== savedCountryIso2) {
                $selectedFlagContainer.trigger('click');
                const $countryListItem = $field.closest('.wpforms-field-phone')
                                            .find(`.iti__country-list .iti__country[data-country-code="${savedCountryIso2}"]`);
                if ($countryListItem.length) {
                    setTimeout(() => {
                        $countryListItem.trigger('click');
                        $field.trigger('input').trigger('change').trigger('blur');
                        $selectedFlagContainer.trigger('click');
                    }, 50);
                }
            }

            $field.trigger('input').trigger('change').trigger('blur');

            return true;
        }


        /**
         * Populates the form fields with previously saved data.
         */
        function loadFormDraft() {
            if (savedDraft) {
                for (const key in savedDraft) {
                    if (savedDraft.hasOwnProperty(key)) {
                        const value = savedDraft[key];
                        let $field = $form.find(`[name="${key}"], #${key}`);

                        if ($field.is(':checkbox')) {
                            $field.each(function() {
                                if (Array.isArray(value) && value.includes($(this).val())) {
                                    $(this).prop('checked', true);
                                } else if (value === $(this).val()) {
                                    $(this).prop('checked', true);
                                }
                            });
                        } else if ($field.is(':radio')) {
                            $form.find(`[name="${key}"][value="${value}"]`).prop('checked', true);
                        } else if ($field.is('select')) {
                            $field.val(value);
                            $field.trigger('change');
                        } else if ($field.is('input[type="tel"]') && $field.hasClass('wpforms-field-phone')) {
                            let attempts = 0;
                            const maxAttempts = 40;
                            const retryInterval = 100;

                            const phoneLoadInterval = setInterval(() => {
                                if (attemptLoadPhoneField($field, key, savedDraft)) {
                                    clearInterval(phoneLoadInterval);
                                } else if (attempts >= maxAttempts) {
                                    clearInterval(phoneLoadInterval);
                                    console.warn('WPForms Auto Save: Failed to load phone field after max attempts:', key);
                                }
                                attempts++;
                            }, retryInterval);
                        }
                        else {
                            $field.val(value);
                        }
                    }
                }
            }
        }

        // --- Event Listeners and Auto-Save Logic ---

        // 1. Load draft when the form is ready on page load (auto-resume)
        loadFormDraft();

        // Removed: 2. Add event listener for the new "Save Draft" button (manual save)
        // Removed: if ($saveButton.length) {
        // Removed:    $saveButton.on('click', function(event) {
        // Removed:        event.preventDefault();
        // Removed:        clearTimeout(saveTimeout);
        // Removed:        saveFormDraft();
        // Removed:    });
        // Removed: }

        // 2. Auto-save on input change, blur, or keyup (debounced) - This will now be the primary save trigger
        $form.on('input change blur keyup', ':input:not(:button):not(:submit):not(:reset)', function() {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(saveFormDraft, 2000);
        });

        // 3. Keep auto-save on window unload (optional, good for ensuring recent changes are saved)
        $(window).on('beforeunload', function() {
            clearTimeout(saveTimeout);
            saveFormDraft();
        });

    }, 500);
});