// js/credential-issuer.js

import { IssuanceRequest } from '../classes/issuance-request.js';
import { getElement, fetchData } from './utils.js';
import { privadoBaseUrl, authorizationHeader, credentialTemplates } from './config.js';
import { getSelectedCredentialTemplates, clearSelectedCredentialTemplates } from './credential-selector.js';
import { populateIdentitySelect } from './identity-manager.js'; // Needed to populate issuer dropdown

/**
 * Renders dynamic input fields for a specific credential template within the issuance modal.
 * @param {object} template - The credential template definition.
 * @param {HTMLElement} parentDiv - The div where to append the form fields.
 */
function renderDynamicCredentialForm(template, parentDiv) {
    const templateContainer = document.createElement('div');
    templateContainer.id = `form-for-${template.type}`;
    templateContainer.className = 'bg-gray-100 p-4 rounded-md mb-6';
    templateContainer.innerHTML = `<h4 class="text-lg font-semibold text-gray-800 mb-3">${template.name} Claims:</h4>`;

    template.fields.forEach(field => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'mb-4';

        const label = document.createElement('label');
        label.htmlFor = `${template.type}-${field.id}`; // Unique ID for input
        label.className = 'block text-gray-700 text-sm font-bold mb-2';
        label.textContent = field.label + (field.required ? ':' : ' (Optional):');

        let inputElement;
        if (field.type === 'checkbox') {
            inputElement = document.createElement('input');
            inputElement.type = 'checkbox';
            inputElement.id = `${template.type}-${field.id}`;
            inputElement.className = 'form-checkbox h-5 w-5 text-blue-600';
            if (field.defaultValue !== undefined) {
                inputElement.checked = field.defaultValue;
            }
        } else {
            inputElement = document.createElement('input');
            inputElement.type = field.type;
            inputElement.id = `${template.type}-${field.id}`;
            inputElement.className = 'shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline';
            if (field.defaultValue !== undefined) {
                inputElement.value = field.defaultValue;
            }
            if (field.placeholder) {
                inputElement.placeholder = field.placeholder;
            }
        }
        
        const errorParagraph = document.createElement('p');
        errorParagraph.id = `${template.type}-${field.id}-error`; // Unique ID for error
        errorParagraph.className = 'text-red-500 text-xs italic';
        errorParagraph.style.display = 'none';
        errorParagraph.textContent = `${field.label} for ${template.name} is required.`;

        fieldDiv.appendChild(label);
        fieldDiv.appendChild(inputElement);
        fieldDiv.appendChild(errorParagraph);
        templateContainer.appendChild(fieldDiv);
    });
    parentDiv.appendChild(templateContainer);
}

/**
 * Validates the input fields for the credential issuance form, including dynamic fields.
 * @returns {boolean} True if all mandatory fields are valid, false otherwise.
 */
function validateIssuanceDetailsForm() {
    let isValid = true;
    const identitySelectElement = getElement('identity-select');
    const identitySelectValue = identitySelectElement ? identitySelectElement.value : null;

    const identitySelectError = getElement('identity-select-error');
    if (identitySelectError) identitySelectError.style.display = (!identitySelectValue || identitySelectElement.disabled) ? 'block' : 'none';
    isValid = isValid && !!identitySelectValue && (identitySelectElement ? !identitySelectElement.disabled : true);

    const subjectId = getElement('subjectId')?.value.trim();
    const subjectIdError = getElement('subjectId-error');
    if (subjectIdError) subjectIdError.style.display = !subjectId ? 'block' : 'none';
    isValid = isValid && !!subjectId;

    const selectedTemplates = getSelectedCredentialTemplates();
    selectedTemplates.forEach(template => {
        template.fields.forEach(field => {
            const inputElement = getElement(`${template.type}-${field.id}`);
            const errorElement = getElement(`${template.type}-${field.id}-error`);
            if (inputElement && errorElement) {
                if (field.required) {
                    let fieldValue;
                    if (inputElement.type === 'checkbox') {
                        fieldValue = inputElement.checked;
                    } else {
                        fieldValue = inputElement.value.trim();
                    }
                    if (!fieldValue) {
                        errorElement.style.display = 'block';
                        isValid = false;
                    } else {
                        errorElement.style.display = 'none';
                    }
                } else {
                    errorElement.style.display = 'none';
                }
            }
        });
    });

    return isValid;
}

/**
 * Resets the entire issuance form including dynamic fields.
 */
export function resetIssuanceForm() {
    const identitySelectElement = getElement('identity-select');
    if (identitySelectElement) {
        identitySelectElement.value = identitySelectElement.options[0]?.value || '';
        populateIdentitySelect([]); // Re-populate to ensure fresh state or empty
    }
    const subjectId = getElement('subjectId');
    if (subjectId) subjectId.value = '';
    const expiration = getElement('expiration');
    if (expiration) expiration.value = '';

    const dynamicFormsDiv = getElement('dynamic-credential-forms');
    if (dynamicFormsDiv) {
        dynamicFormsDiv.innerHTML = '<p class="text-gray-600">Select credential types from the main page to see their specific input fields here.</p>';
    }

    // Clear all error messages
    const errorLabels = document.querySelectorAll('#issuance-details-modal .text-red-500');
    errorLabels.forEach(label => label.style.display = 'none');

    // Also clear credential selector state
    clearSelectedCredentialTemplates();
}

/**
 * Displays a QR code using QRious.
 * @param {string} data - The data string to encode in the QR code.
 */
async function displayQrCode(data) {
    const qrCodeDisplay = getElement('qr-code-display');
    const canvas = getElement('qrcodeCanvas');
    const qrModalContent = getElement('qr-modal-content');
    const qrCodeModal = getElement('qr-code-modal');

    if (!qrCodeDisplay || !canvas || !qrModalContent || !qrCodeModal) {
        console.error("Missing QR code display elements.");
        return;
    }

    qrCodeDisplay.innerHTML = ''; // Clear previous content

    try {
        new QRious({
            element: canvas,
            value: data,
            size: 200,
            level: 'H',
            background: 'white',
            foreground: 'black'
        });
        console.log('QR code generated on canvas using QRious!');
    } catch (drawError) {
        console.error('Error generating QR code with QRious:', drawError);
        qrCodeDisplay.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data)}" alt="QR Code" class="mx-auto block">`;
    }

    qrModalContent.textContent = data; // Display the raw link in the modal
    qrCodeModal.style.display = 'block'; // Show the QR modal
}


/**
 * Sets up event listeners for the Credential Issuance page (issue-credential.html).
 */
export function setupCredentialIssuerEventListeners() {
    const startIssuanceProcessBtn = getElement('start-issuance-process-btn');
    const issuanceDetailsModal = getElement('issuance-details-modal');
    const closeIssuanceDetailsModalBtn = getElement('close-issuance-details-modal');
    const processIssuanceBtn = getElement('process-issuance-btn');
    const dynamicFormsDiv = getElement('dynamic-credential-forms');
    const closeQrModalAndResetFormBtn = getElement('close-qr-modal-and-reset-form-btn');
    const qrCodeModal = getElement('qr-code-modal');


    if (startIssuanceProcessBtn) {
        startIssuanceProcessBtn.addEventListener('click', () => {
            const selectedTemplates = getSelectedCredentialTemplates();
            if (selectedTemplates.length === 0) {
                alert('Please select at least one credential type first.');
                return;
            }

            // Populate issuer dropdown (might be needed again if identities change)
            populateIdentitySelect([]); // Clear first, then load fresh
            // Assuming loadIdentities() is called globally on page load,
            // the 'identity-select' will already be populated. If not, call it here.

            // Render dynamic forms for selected templates
            dynamicFormsDiv.innerHTML = ''; // Clear previous forms
            selectedTemplates.forEach(template => {
                renderDynamicCredentialForm(template, dynamicFormsDiv);
            });

            if (issuanceDetailsModal) {
                issuanceDetailsModal.style.display = 'block';
            }
        });
    }

    if (closeIssuanceDetailsModalBtn) {
        closeIssuanceDetailsModalBtn.addEventListener('click', () => {
            if (issuanceDetailsModal) issuanceDetailsModal.style.display = 'none';
            resetIssuanceForm();
        });
    }

    if (processIssuanceBtn) {
        processIssuanceBtn.addEventListener('click', async () => {
            if (!validateIssuanceDetailsForm()) { return; }

            const issuerDid = getElement('identity-select').value;
            const subjectId = getElement('subjectId').value;
            const expiration = parseInt(getElement('expiration').value) || undefined;

            const selectedTemplates = getSelectedCredentialTemplates();
            let allIssuanceSuccessful = true;
            let firstQrLink = null;

            for (const template of selectedTemplates) {
                const credentialSubject = { id: subjectId };

                template.fields.forEach(field => {
                    const inputElement = getElement(`${template.type}-${field.id}`);
                    if (inputElement) {
                        if (inputElement.type === 'checkbox') {
                            credentialSubject[field.id] = inputElement.checked;
                        } else if (field.type === 'number') {
                            credentialSubject[field.id] = parseFloat(inputElement.value) || undefined; // Use parseFloat for salary/GPA, etc.
                        } else if (field.type === 'date') {
                            const dateValue = inputElement.value;
                            if (dateValue) {
                                credentialSubject[field.id] = parseInt(dateValue.replace(/-/g, ''));
                            } else {
                                credentialSubject[field.id] = undefined;
                            }
                        } else {
                            credentialSubject[field.id] = inputElement.value.trim();
                        }
                    }
                });

                const credentialData = new IssuanceRequest(
                    template.schema,
                    template.type,
                    credentialSubject,
                    expiration
                );

                console.log(`Attempting to issue ${template.name}:`, JSON.stringify(credentialData, null, 2));

                try {
                    const newCredentialResponse = await fetchData(
                        `${privadoBaseUrl}/identities/${encodeURIComponent(issuerDid)}/credentials`,
                        'POST',
                        { 'Authorization': authorizationHeader, 'accept': 'application/json' },
                        credentialData
                    );
                    console.log(`${template.name} Issued:`, newCredentialResponse);

                    const claimId = newCredentialResponse.id || newCredentialResponse.claimID;
                    if (!claimId) {
                        console.error(`Issued ${template.name} but missing 'id' (claim identifier):`, newCredentialResponse);
                        alert(`Issued ${template.name}, but could not get claim ID to generate QR offer.`);
                        allIssuanceSuccessful = false;
                        continue;
                    }

                    const offerUrl = `${privadoBaseUrl}/identities/${encodeURIComponent(issuerDid)}/credentials/${encodeURIComponent(claimId)}/offer?type=universalLink`;
                    const offerResponse = await fetchData(
                        offerUrl,
                        'GET',
                        { 'Authorization': authorizationHeader, 'accept': 'application/json' }
                    );

                    if (offerResponse.universalLink) {
                        console.log(`${template.name} Universal Link:`, offerResponse.universalLink);
                        if (!firstQrLink) { // Store the first one to display
                            firstQrLink = offerResponse.universalLink;
                        }
                        alert(`${template.name} issued and QR Link obtained. Click OK to continue.`);
                    } else {
                        console.error(`Did not receive a universalLink for ${template.name}:`, offerResponse);
                        alert(`Failed to get QR link for ${template.name}.`);
                        allIssuanceSuccessful = false;
                    }

                } catch (error) {
                    console.error(`Error issuing ${template.name}:`, error);
                    alert(`Error issuing ${template.name}: ${error.message}`);
                    allIssuanceSuccessful = false;
                }
            }

            if (issuanceDetailsModal) issuanceDetailsModal.style.display = 'none';

            if (firstQrLink) {
                displayQrCode(firstQrLink);
                alert('All selected credentials processed (check console for individual status). Scan the QR code to receive the first one.');
            } else if (allIssuanceSuccessful) {
                alert('All selected credentials processed successfully, but no QR link was generated (this might happen if only non-QR offers are supported by the API).');
            } else {
                alert('Some credentials failed to issue or generate QR links. Check console for details.');
            }
        });
    }

    // New button to close QR modal and reset the form
    if (closeQrModalAndResetFormBtn) {
        closeQrModalAndResetFormBtn.addEventListener('click', () => {
            if (qrCodeModal) qrCodeModal.style.display = 'none';
            resetIssuanceForm(); // Reset entire issuance flow
        });
    }
}