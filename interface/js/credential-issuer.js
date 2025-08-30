import { IssuanceRequest } from '../classes/issuance-request.js';
import { getElement, fetchData, encryptWithKey, decryptWithKey } from './utils.js';
import { privadoBaseUrl, authorizationHeader, veramoBaseUrl, veramoAuthToken } from './config.js';
import { getSelectedCredentialTemplates, clearSelectedCredentialTemplates } from './credential-selector.js';

// No longer needed: `populateIdentitySelect` is replaced by `populateAllIssuers`
// import { populateIdentitySelect } from './identity-manager.js';

const KEY = "Key123";

/* VERAMO SUPPORT FUNCTIONS */

/**
 * Issues a Verifiable Credential using the Veramo agent and stores it encrypted.
 * @param {string} issuerDid - The DID of the credential issuer.
 * @param {string} subjectDid - The DID of the credential subject.
 * @param {object} template - The credential template from config.js.
 * @param {object} credentialSubjectData - The claim data for the credential subject.
 * @returns {Promise<object>} The hash of the newly saved Verifiable Credential.
 */
async function issueVeramoCredential(issuerDid, subjectDid, template, credentialSubjectData) {
    const payload = {
        credential: {
            issuer: { id: issuerDid },
            credentialSubject: { id: subjectId, ...credentialSubjectData },
            type: ["VerifiableCredential", template.type],
            issuanceDate: new Date().toISOString()
        },
        proofFormat: 'jwt' // Or 'lds' for Linked Data Signatures
    };

    console.log('Attempting to issue Veramo Credential:', payload);
    
    try {
        // Step 1: Create the credential
        const createdCredential = await fetchData(
            `${veramoBaseUrl}/createVerifiableCredential`,
            'POST',
            { 'Authorization': veramoAuthToken },
            payload
        );
        console.log('Veramo Credential created:', createdCredential);
        
        // Step 2: Encrypt the credential data
        const encryptedData = await encryptWithKey(JSON.stringify(createdCredential), KEY);

        // Step 3: Create a new payload with the encrypted data
        const encryptedCredentialPayload = {
            verifiableCredential: {
                ...createdCredential,
                // Add an encrypted flag and the encrypted data string
                encrypted: true,
                encryptedData: encryptedData
            }
        };

        // Step 4: Save the encrypted credential to the Veramo data store
        const credentialHash = await fetchData(
            `${veramoBaseUrl}/dataStoreSaveVerifiableCredential`,
            'POST',
            { 'Authorization': veramoAuthToken },
            encryptedCredentialPayload
        );
        console.log('Veramo Credential saved with hash:', credentialHash);
        
        return { createdCredential, hash: credentialHash };
    } catch (error) {
        console.error('Error during Veramo credential issuance or storage:', error);
        throw error;
    }
}


/**
 * Loads Veramo-managed DIDs and updates a shared state.
 * This function will fetch DIDs from your Veramo agent instance.
 * @returns {Promise<Array<object>>} An array of Veramo-managed DID objects.
 */
async function loadVeramoDids() {
    try {
        // The endpoint is `didManagerFind`, and an empty body returns all DIDs
        const veramoDids = await fetchData(`${veramoBaseUrl}/didManagerFind`, 'POST', { 'Authorization': veramoAuthToken }, {});
        
        // Add a source label to each DID object for clear differentiation in the UI
        return veramoDids.map(did => ({ ...did, source: 'veramo', displayName: did.alias || did.did }));
    } catch (error) {
        console.error("Error loading DIDs from Veramo agent:", error);
        return []; // Return an empty array on error
    }
}

/**
 * Loads existing identities from the Privado ID service.
 * This is your original function, now a helper for the combined DID list.
 * @returns {Promise<Array<object>>} An array of Privado ID identities.
 */
async function loadPrivadoIdentities() {
    try {
        const identities = await fetchData(`${privadoBaseUrl}/identities`, 'GET', { 'Authorization': authorizationHeader, 'accept': 'application/json' });
        // Add a source label to each identity
        return identities.map(identity => ({ ...identity, source: 'privado' }));
    } catch (error) {
        console.error("Error loading identities from Privado ID:", error);
        return [];
    }
}

/**
 * Fetches DIDs from both Privado ID and Veramo and populates the UI dropdown.
 * This replaces the original `loadIdentities` function.
 */
async function populateAllIssuers() {
    // We will have a combined list of all DIDs available for issuance
    let allIssuers = [];
    
    // Fetch DIDs from Veramo and label them
    const veramoDids = await loadVeramoDids();
    allIssuers = allIssuers.concat(veramoDids);
    
    // Fetch identities from Privado ID and label them
    const privadoIdentities = await loadPrivadoIdentities();
    allIssuers = allIssuers.concat(privadoIdentities);
    
    // Populate the dropdown with the combined list
    const identitySelectElement = getElement('identity-select');
    if (!identitySelectElement) return;

    identitySelectElement.innerHTML = '';
    if (allIssuers.length > 0) {
        allIssuers.forEach(issuer => {
            const option = document.createElement('option');
            // The value is the DID itself
            const did = issuer.did || issuer.identifier;
            option.value = did;
            // The display text includes the source for clarity
            const displayName = issuer.displayName || issuer.alias || 'Unnamed';
            option.textContent = `${displayName} (${did}) - [${issuer.source}]`;
            option.dataset.source = issuer.source; // Use data attributes for easy access
            identitySelectElement.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.textContent = 'No issuers available';
        identitySelectElement.appendChild(option);
        option.disabled = true;
    }
}

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
        // Now using populateAllIssuers instead of populateIdentitySelect
        populateAllIssuers();
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

    const issueVeramoVcBtn = getElement('issue-veramo-vc-btn');

    if (startIssuanceProcessBtn) {
        startIssuanceProcessBtn.addEventListener('click', async () => {
            const selectedTemplates = getSelectedCredentialTemplates();
            if (selectedTemplates.length === 0) {
                alert('Please select at least one credential type first.');
                return;
            }

            await populateAllIssuers();

            dynamicFormsDiv.innerHTML = '';
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
            const selectedOption = getElement('identity-select').selectedOptions[0];
            const issuerSource = selectedOption.dataset.source;
            if (issuerSource === 'veramo') {
                alert('You have selected a Veramo DID. Please use the "Issue with Veramo" button.');
                return;
            }
            
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
                            credentialSubject[field.id] = parseFloat(inputElement.value) || undefined;
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
                        if (!firstQrLink) {
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

    if (closeQrModalAndResetFormBtn) {
        closeQrModalAndResetFormBtn.addEventListener('click', () => {
            if (qrCodeModal) qrCodeModal.style.display = 'none';
            resetIssuanceForm();
        });
    }

    // New event listener for the Veramo issuance button
    if (issueVeramoVcBtn) {
        issueVeramoVcBtn.addEventListener('click', async () => {
            if (!validateIssuanceDetailsForm()) {
                alert("Please fill in all required fields.");
                return;
            }
            
            const issuerDid = getElement('identity-select').value;
            const selectedOption = getElement('identity-select').selectedOptions[0];
            const issuerSource = selectedOption.dataset.source;
            if (issuerSource !== 'veramo') {
                 alert('You have selected a Privado ID DID. Please use the "Issue with Privado ID" button.');
                 return;
            }
            
            const subjectId = getElement('subjectId').value;
            
            const selectedTemplates = getSelectedCredentialTemplates();
            if (selectedTemplates.length === 0) {
                alert('Please select a credential template first.');
                return;
            }
            const template = selectedTemplates[0];

            const credentialSubjectData = {};
            template.fields.forEach(field => {
                const inputElement = getElement(`${template.type}-${field.id}`);
                if (inputElement) {
                    if (inputElement.type === 'checkbox') {
                        credentialSubjectData[field.id] = inputElement.checked;
                    } else if (field.type === 'number') {
                        credentialSubjectData[field.id] = parseFloat(inputElement.value) || undefined;
                    } else if (field.type === 'date') {
                        const dateValue = inputElement.value;
                        if (dateValue) {
                            credentialSubjectData[field.id] = parseInt(dateValue.replace(/-/g, ''));
                        } else {
                            credentialSubjectData[field.id] = undefined;
                        }
                    } else {
                        credentialSubjectData[field.id] = inputElement.value.trim();
                    }
                }
            });

            try {
                const result = await issueVeramoCredential(issuerDid, subjectId, template, credentialSubjectData);
                
                alert(`Veramo Credential issued and saved successfully! The credential hash is: ${result.hash}`);
                console.log('Successfully issued and saved Veramo Credential:', result);
                
                if (issuanceDetailsModal) {
                    issuanceDetailsModal.style.display = 'none';
                }
                resetIssuanceForm();

            } catch (error) {
                console.error('Error issuing Veramo credential:', error);
                alert(`Error issuing Veramo credential: ${error.message}`);
            }
        });
    }
}
