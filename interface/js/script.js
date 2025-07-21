// script.js

// --- Imports ---
// Import the IssuanceRequest class from its separate module.
// This class is used to structure the payload sent to the issuer API for creating a credential.
import { IssuanceRequest } from '../classes/issuance-request.js';

// If you ever need to work with the full structure of a received Verifiable Credential,
// you would import the VerifiableCredential class here:
import { VerifiableCredential } from '../classes/verifiable-credential.js';


// --- Configuration Constants ---
// BASE URL for your Privado ID / Polygon ID issuer service.
// IMPORTANT: Update this with your current Tunnelmole URL, ensuring it ends with /v2.
const privadoBaseUrl = 'https://m8ar6h-ip-91-209-212-211.tunnelmole.net/v2';
// BASE URL for your Veramo agent.
const veramoBaseUrl = 'http://localhost:3332/agent';
// Authorization header for your Privado ID / Polygon ID API.
const authorizationHeader = 'Basic dXNlci1pc3N1ZXI6cGFzc3dvcmQtaXNzdWVy';
// Authorization token for your Veramo agent.
const veramoAuthToken = 'Bearer test123';

// --- Global State Variables ---
// Stores the list of identities loaded from the Privado ID service.
let currentIdentities = [];
// Stores the list of credentials loaded for a selected identity.
let currentCredentials = [];
// Holds the currently selected credential object from the list.
let selectedCredential = null;
// Stores the Decentralized Identifier (DID) of the currently selected issuer identity.
let selectedIdentityForCredentials = null;


// --- Utility Functions ---

/**
 * Safely retrieves a DOM element by its ID.
 * Returns null if the element does not exist.
 * @param {string} id - The ID of the element to retrieve.
 * @returns {HTMLElement | null} The found element or null.
 */
function getElement(id) {
    return document.getElementById(id);
}

/**
 * Fetches data from a given URL with specified method, headers, and body.
 * Includes enhanced logging for debugging network calls and error handling for non-JSON responses.
 * @param {string} url - The URL to fetch.
 * @param {string} [method='GET'] - The HTTP method (GET, POST, PUT, DELETE).
 * @param {object} [headers={}] - HTTP headers to include in the request.
 * @param {object | null} [body=null] - The request body object, which will be JSON.stringified.
 * @returns {Promise<any>} A promise that resolves with the parsed JSON response.
 * @throws {Error} Throws an error if the network request fails or the response is not OK/JSON.
 */
async function fetchData(url, method = 'GET', headers = {}, body = null) {
    const options = {
        method: method,
        headers: { ...headers }, // Create a shallow copy to modify safely
    };

    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    // --- IMPORTANT DEBUGGING STEP: Log the actual URL and options before fetch ---
    console.log('----------------------------------------------------');
    console.log('Making API Call:');
    console.log('  URL:', url);
    console.log('  Method:', options.method);
    console.log('  Headers:', options.headers);
    console.log('  Body:', options.body ? JSON.parse(options.body) : 'N/A'); // Parse body for logging if it's JSON
    console.log('----------------------------------------------------');

    try {
        const response = await fetch(url, options);

        // Log the response status for every call
        console.log('API Response Status:', response.status, response.statusText);

        // Check if the response content type is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            // Attempt to parse as JSON
            if (!response.ok) {
                // If response is not OK, but it's JSON, try to get the JSON error details
                let errorJson = {};
                try {
                    errorJson = await response.json(); // Try parsing as JSON even if status is not ok
                } catch (parseError) {
                    // Fallback to text if JSON parsing fails
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }
                let errorMessage = `HTTP error! status: ${response.status}`;
                if (errorJson && errorJson.message) {
                    errorMessage += `, message: ${errorJson.message}`;
                } else if (Object.keys(errorJson).length > 0) {
                    errorMessage += `, details: ${JSON.stringify(errorJson)}`;
                }
                throw new Error(errorMessage);
            }
            return await response.json(); // Return JSON for successful responses
        } else {
            // If response is not JSON, read it as text and throw a specific error
            const responseText = await response.text();
            throw new Error(`API returned non-JSON response (Content-Type: ${contentType || 'None'}): ${responseText.substring(0, 200)}... (truncated)`);
        }
    } catch (error) {
        // Catch network errors (like CORS or connection issues)
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error("Network or CORS error caught:", error);
            throw new Error("Network error (CORS or connection issue). Check browser console for details.");
        } else if (error instanceof DOMException && error.name === 'AbortError') {
             console.warn("Fetch request was aborted.", error);
             throw new Error("Fetch request aborted.");
        }
        throw error; // Re-throw other errors
    }
}

/**
 * Loads existing identities from the Privado ID service and updates the UI.
 * Populates identity lists and dropdowns on relevant pages.
 */
async function loadIdentities() {
    try {
        const identities = await fetchData(`${privadoBaseUrl}/identities`, 'GET', { 'Authorization': authorizationHeader, 'accept': 'application/json' });
       
        currentIdentities = identities;

        // Call render and populate functions only if their respective elements exist on the current page
        const identityList = getElement('identity-list');
        if (identityList) renderIdentities(identities);

        const identitySelectElement = getElement('identity-select');
        if (identitySelectElement) populateIdentitySelect(identities);

        const identitySelectDeleteElement = getElement('identity-select-delete');
        if (identitySelectDeleteElement) populateIdentitySelectDelete(identities);

        const identitySelectRevokeElement = getElement('identity-select-revoke');
        if (identitySelectRevokeElement) populateIdentitySelectRevoke(identities);

    } catch (error) {
        console.error("Error loading identities:", error);
        const identityList = getElement('identity-list');
        if (identityList) {
            identityList.innerHTML = `<li class="text-red-500">Error loading identities: ${error.message}</li>`;
        }
        alert(`Error loading identities: ${error.message}`);
    }
}

/**
 * Renders the list of identities in the UI.
 * @param {Array<object>} identities - An array of identity objects to display.
 */
function renderIdentities(identities) {
    const identityList = getElement('identity-list');
    if (!identityList) return; // Exit if the element is not on the current page

    identityList.innerHTML = '';
    if (identities && identities.length > 0) {
        identities.forEach(identity => {
            const listItem = document.createElement('li');
            listItem.className = "py-2 border-b border-gray-200";
            listItem.textContent = `${identity.displayName} (${identity.identifier})`;
            identityList.appendChild(listItem);
        });
    } else {
        identityList.innerHTML = '<li class="text-gray-500">No identities found.</li>';
    }
}

/**
 * Populates the identity selection dropdown for issuing credentials.
 * @param {Array<object>} identities - An array of identity objects.
 */
function populateIdentitySelect(identities) {
    const identitySelectElement = getElement('identity-select');
    if (!identitySelectElement) return; // Exit if the element is not on the current page

    identitySelectElement.innerHTML = '';
    if (identities && identities.length > 0) {
        identities.forEach(identity => {
            const option = document.createElement('option');
            option.value = identity.identifier;
            option.textContent = `${identity.displayName} (${identity.identifier})`;
            identitySelectElement.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.textContent = 'No identities available';
        identitySelectElement.appendChild(option);
        option.disabled = true; // Disable if no identities are available
    }
}

/**
 * Populates the identity selection dropdown for deleting identities.
 * @param {Array<object>} identities - An array of identity objects.
 */
function populateIdentitySelectDelete(identities) {
    const identitySelectDeleteElement = getElement('identity-select-delete');
    if (!identitySelectDeleteElement) return; // Exit if the element is not on the current page

    identitySelectDeleteElement.innerHTML = '';
    if (identities && identities.length > 0) {
        identities.forEach(identity => {
            const option = document.createElement('option');
            option.value = identity.identifier;
            option.textContent = `${identity.displayName} (${identity.identifier})`;
            identitySelectDeleteElement.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.textContent = 'No identities available';
        identitySelectDeleteElement.appendChild(option);
        option.disabled = true;
    }
}

/**
 * Populates the identity selection dropdown for revoking credentials.
 * @param {Array<object>} identities - An array of identity objects.
 */
function populateIdentitySelectRevoke(identities) {
    const identitySelectRevokeElement = getElement('identity-select-revoke');
    if (!identitySelectRevokeElement) return; // Exit if the element is not on the current page

    identitySelectRevokeElement.innerHTML = '';
    if (identities && identities.length > 0) {
        identities.forEach(identity => {
            const option = document.createElement('option');
            option.value = identity.identifier;
            option.textContent = `${identity.displayName} (${identity.identifier})`;
            identitySelectRevokeElement.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.textContent = 'No identities available';
        identitySelectRevokeElement.appendChild(option);
        option.disabled = true;
    }
}

/**
 * Loads credentials for a specific issuer identity and updates the UI.
 * Now correctly extracts the 'items' array from the API response.
 * @param {string} issuerIdentifier - The DID of the issuer identity.
 */
async function loadCredentials(issuerIdentifier) {
    try {
        const rawResponse = await fetchData(`${privadoBaseUrl}/identities/${encodeURIComponent(issuerIdentifier)}/credentials`, 'GET', { 'Authorization': authorizationHeader, 'accept': 'application/json' });

        let credentialsArrayFromAPI = [];

        // --- MODIFICATION START ---
        // The API returns an object that contains an 'items' array.
        // We need to access that 'items' property directly.
        if (rawResponse && Array.isArray(rawResponse.items)) {
            credentialsArrayFromAPI = rawResponse.items;
            console.log("Successfully extracted items array from API response.");
        } else {
            // Log an unexpected response format if 'rawResponse' is not an object with an 'items' array.
            console.warn("API returned an unexpected response format for credentials (missing or invalid 'items' array):", rawResponse);
            credentialsArrayFromAPI = []; // Default to empty array to prevent further errors
        }
        // --- MODIFICATION END ---

        // Map the raw credential objects to VerifiableCredential instances
        // This will now correctly map over the 'items' array.
        currentCredentials = credentialsArrayFromAPI.map(rawVc => new VerifiableCredential(rawVc));
        selectedIdentityForCredentials = issuerIdentifier; // Store the issuer's DID for later use

        // Call render and populate functions only if their respective elements exist on the current page
        const credentialList = getElement('credential-list');
        if (credentialList) renderCredentials(currentCredentials); // Pass the array of VerifiableCredential instances

        const credentialSelectRevokeElement = getElement('credential-select-revoke');
        if (credentialSelectRevokeElement) populateCredentialSelectRevoke(currentCredentials); // Pass the array

    } catch (error) {
        console.error("Error loading credentials:", error);
        const credentialList = getElement('credential-list');
        if (credentialList) {
            credentialList.innerHTML = `<li class="text-red-500">Error loading credentials: ${error.message}</li>`;
        }
        alert(`Error loading credentials: ${error.message}`);
    }
}


/**
 * Renders the list of credentials in the UI using radio buttons for selection.
 * @param {Array<VerifiableCredential>} credentials - An array of VerifiableCredential instances to display.
 */
function renderCredentials(credentials) {
    const credentialList = getElement('credential-list');
    if (!credentialList) return; // Exit if the element is not on the current page

    credentialList.innerHTML = ''; // Clear previous list items
    const storeCredentialBtn = getElement('store-credential-btn'); // Relevant for this page

    // Reset selected credential and buttons whenever the list is re-rendered
    selectedCredential = null;
    if (storeCredentialBtn) {
        storeCredentialBtn.disabled = true;
        // Reset class to default disabled state, you might want to adjust the exact class name based on your CSS
        storeCredentialBtn.className = "bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
    }
    const revocationStatusDisplay = getElement('revocation-status-display');
    if (revocationStatusDisplay) revocationStatusDisplay.textContent = '';
    const veramoStatusDiv = getElement('veramo-status');
    if (veramoStatusDiv) veramoStatusDiv.textContent = '';


    if (credentials && credentials.length > 0) {
        credentials.forEach(credential => { // 'credential' here is a VerifiableCredential instance
            const listItem = document.createElement('li');
            listItem.className = "flex items-center py-2 border-b border-gray-200 hover:bg-gray-100"; // Tailwind for flex layout

            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = 'selectedCredentialRadio'; // All radio buttons must have the same name for single selection
            radioInput.id = `credential-${credential.claimID || credential.id}`; // Unique ID for each radio button
            radioInput.className = 'form-radio h-4 w-4 text-blue-600 mr-2 cursor-pointer'; // Basic styling for radio button

            const label = document.createElement('label');
            label.htmlFor = radioInput.id; // Link label to radio button
            label.className = 'flex-grow cursor-pointer block'; // Make the label span the rest of the space, clickable
            label.innerHTML = `
                <div class="font-semibold text-gray-800">ID: ${credential.claimID || credential.id}</div>
                <div class="text-sm text-gray-600">Type: ${Array.isArray(credential.type) ? credential.type.join(', ') : credential.type}</div>
                <div class="text-sm text-gray-600">Subject: ${credential.credentialSubject?.id || 'N/A'}</div>
                <div class="text-xs text-gray-500">Issued: ${new Date(credential.issuanceDate).toLocaleDateString()}</div>
                ${credential.expirationDate ? `<div class="text-xs text-red-500">Expires: ${new Date(credential.expirationDate).toLocaleDateString()}</div>` : ''}
                ${credential.revoked ? `<div class="text-xs text-red-700 font-bold">Status: REVOKED</div>` : ''}
            `;
            // Add a data attribute to the label or list item to easily retrieve the full credential object later
            // We can't directly store objects in data attributes, so we'll rely on finding it in currentCredentials.
            label.dataset.credentialId = credential.claimID || credential.id;

            // Event listener for when a radio button is selected
            radioInput.addEventListener('change', (event) => {
                if (event.target.checked) {
                    // Find the full credential object from our currentCredentials array
                    selectedCredential = currentCredentials.find(vc => (vc.claimID || vc.id) === event.target.id.replace('credential-', ''));

                    if (selectedCredential) {
                        console.log("Selected Credential:", selectedCredential);
                        if (storeCredentialBtn) {
                            storeCredentialBtn.disabled = false;
                            storeCredentialBtn.className = "bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
                        }
                    } else {
                        // Fallback if credential not found (shouldn't happen with correct IDs)
                        selectedCredential = null;
                        if (storeCredentialBtn) {
                            storeCredentialBtn.disabled = true;
                            storeCredentialBtn.className = "bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
                        }
                    }
                    // Clear previous status messages when a new credential is selected
                    if (revocationStatusDisplay) revocationStatusDisplay.textContent = '';
                    if (veramoStatusDiv) veramoStatusDiv.textContent = '';
                }
            });

            listItem.appendChild(radioInput);
            listItem.appendChild(label); // Append the label which contains the credential details
            credentialList.appendChild(listItem);
        });
    } else {
        credentialList.innerHTML = '<li class="text-gray-500 py-2">No credentials issued for this identity.</li>';
        // Ensure buttons are disabled if no credentials are found
        if (storeCredentialBtn) {
            storeCredentialBtn.disabled = true;
            storeCredentialBtn.className = "bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
        }
        selectedCredential = null;
    }
}


/**
 * Populates the credential selection dropdown for revoking credentials.
 * @param {Array<object>} credentials - An array of credential objects.
 */
function populateCredentialSelectRevoke(credentials) {
    const credentialSelectRevokeElement = getElement('credential-select-revoke');
    if (!credentialSelectRevokeElement) return;

    credentialSelectRevokeElement.innerHTML = '';
    if (credentials && credentials.length > 0) {
        credentials.forEach(credential => { // 'credential' here is now a VerifiableCredential instance
            const option = document.createElement('option');
            option.value = credential.claimID || credential.id;
            option.textContent = `ID: ${credential.claimID || credential.id}, Type: ${credential.type}, Subject: ${credential.credentialSubject?.id || 'N/A'}`;
            credentialSelectRevokeElement.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.textContent = 'No credentials available';
        credentialSelectRevokeElement.appendChild(option);
        option.disabled = true;
    }
}

/**
 * Resets form fields within specified modals to their default values.
 * Note: Assumes modal divs are not actual <form> tags, so directly targets input IDs.
 * @param {string} formId - The ID of the modal div to reset.
 */
function resetForm(formId) {
    // Resets inputs for the 'Create New Identity' modal
    if (formId === 'new-identity-modal') {
        const didMethod = getElement('didMethod');
        if (didMethod) didMethod.value = 'polygonid';
        const blockchain = getElement('blockchain');
        if (blockchain) blockchain.value = 'polygon';
        const network = getElement('network');
        if (network) network.value = 'amoy';
        const identityType = getElement('identityType');
        if (identityType) identityType.value = 'BJJ';
        const displayName = getElement('displayName');
        if (displayName) displayName.value = 'New Identity';
    }
    // Resets inputs for the 'Issue Credential' modal/form
    else if (formId === 'issue-credential-modal') {
        const credentialSchema = getElement('credentialSchema');
        if (credentialSchema) credentialSchema.value = 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCAgeCredential-v3.json';
        const credentialType = getElement('credentialType');
        if (credentialType) credentialType.value = 'KYCAgeCredential';
        const subjectId = getElement('subjectId');
        if (subjectId) subjectId.value = ''; // Subject DID usually starts empty
        const birthday = getElement('birthday');
        if (birthday) birthday.value = '19900101';
        const documentType = getElement('documentType');
        if (documentType) documentType.value = '1';
        const expiration = getElement('expiration');
        if (expiration) expiration.value = ''; // Expiration usually starts empty
    }

    // Hide all error messages within the modal/form
    const formElement = getElement(formId);
    if (formElement) {
        const errorLabels = formElement.querySelectorAll('.text-red-500');
        errorLabels.forEach(label => label.style.display = 'none');
    }
}

/**
 * Validates the input fields for the identity creation form.
 * @returns {boolean} True if all mandatory fields are valid, false otherwise.
 */
function validateIdentityForm() {
    let isValid = true;
    const didMethod = getElement('didMethod')?.value.trim();
    const blockchain = getElement('blockchain')?.value.trim();
    const network = getElement('network')?.value.trim();
    const identityType = getElement('identityType')?.value.trim();
    const displayName = getElement('displayName')?.value.trim();

    // Check each field and update its error display
    const didMethodError = getElement('didMethod-error');
    if (didMethodError) didMethodError.style.display = !didMethod ? 'block' : 'none';
    const blockchainError = getElement('blockchain-error');
    if (blockchainError) blockchainError.style.display = !blockchain ? 'block' : 'none';
    const networkError = getElement('network-error');
    if (networkError) networkError.style.display = !network ? 'block' : 'none';
    const identityTypeError = getElement('identityType-error');
    if (identityTypeError) identityTypeError.style.display = !identityType ? 'block' : 'none';
    const displayNameError = getElement('displayName-error');
    if (displayNameError) displayNameError.style.display = !displayName ? 'block' : 'none';

    // Overall validation status
    isValid = isValid && !!didMethod && !!blockchain && !!network && !!identityType && !!displayName;
    return isValid;
}

/**
 * Validates the input fields for the credential issuance form.
 * @returns {boolean} True if all mandatory fields are valid, false otherwise.
 */
function validateCredentialForm() {
    let isValid = true;
    const identitySelectElement = getElement('identity-select');
    const identitySelectValue = identitySelectElement ? identitySelectElement.value : null; // Get selected value safely
    const credentialSchema = getElement('credentialSchema')?.value.trim();
    const credentialType = getElement('credentialType')?.value.trim();
    const subjectId = getElement('subjectId')?.value.trim();
    const birthday = getElement('birthday')?.value.trim();
    const documentType = getElement('documentType')?.value.trim();

    // Check each field and update its error display
    const identitySelectError = getElement('identity-select-error');
    if (identitySelectError) identitySelectError.style.display = (!identitySelectValue || identitySelectElement.disabled) ? 'block' : 'none';
    const credentialSchemaError = getElement('credentialSchema-error');
    if (credentialSchemaError) credentialSchemaError.style.display = !credentialSchema ? 'block' : 'none';
    const credentialTypeError = getElement('credentialType-error');
    if (credentialTypeError) credentialTypeError.style.display = !credentialType ? 'block' : 'none';
    const subjectIdError = getElement('subjectId-error');
    if (subjectIdError) subjectIdError.style.display = !subjectId ? 'block' : 'none';
    const birthdayError = getElement('birthday-error');
    if (birthdayError) birthdayError.style.display = !birthday ? 'block' : 'none';
    const documentTypeError = getElement('documentType-error');
    if (documentTypeError) documentTypeError.style.display = !documentType ? 'block' : 'none';

    // Overall validation status
    isValid = isValid && !!identitySelectValue && (identitySelectElement ? !identitySelectElement.disabled : true) && !!credentialSchema && !!credentialType && !!subjectId && !!birthday && !!documentType;
    return isValid;
}


// --- Event Listeners and Initializers (Executed after DOM is fully loaded) ---

document.addEventListener('DOMContentLoaded', () => {

    // --- Common Elements (may appear on multiple pages or linked from others) ---
    const identitySelectElement = getElement('identity-select'); // Used in issue-credential.html and credentials.html
    const identitySelectRevokeElement = getElement('identity-select-revoke'); // Used in credentials.html for revoke modal
    const credentialSelectRevokeElement = getElement('credential-select-revoke'); // Used in credentials.html for revoke modal

    // --- Identities Page Logic (identities.html) ---
    const createIdentityBtn = getElement('create-identity-btn');
    const loadIdentitiesBtn = getElement('load-identities-btn');
    const deleteIdentityBtn = getElement('delete-identity-btn');
    const newIdentityModal = getElement('new-identity-modal');
    const closeIdentityModalBtn = getElement('close-identity-modal');
    const submitIdentityFormBtn = getElement('submit-identity-btn');
    const deleteIdentityModal = getElement('delete-identity-modal');
    const closeDeleteIdentityModalBtn = getElement('close-delete-identity-modal');
    const confirmDeleteIdentityBtn = getElement('confirm-delete-identity-btn');
    const cancelDeleteIdentityBtn = getElement('cancel-delete-identity-btn');
    const identitySelectDeleteElement = getElement('identity-select-delete');

    if (createIdentityBtn) {
        createIdentityBtn.addEventListener('click', () => { if (newIdentityModal) newIdentityModal.style.display = 'block'; });
    }
    if (closeIdentityModalBtn) {
        closeIdentityModalBtn.addEventListener('click', () => { if (newIdentityModal) newIdentityModal.style.display = 'none'; resetForm('new-identity-modal'); });
    }
    if (submitIdentityFormBtn) {
        submitIdentityFormBtn.addEventListener('click', async () => {
            if (!validateIdentityForm()) { return; }
            const didMethod = getElement('didMethod').value;
            const blockchain = getElement('blockchain').value;
            const network = getElement('network').value;
            const identityType = getElement('identityType').value;
            const displayName = getElement('displayName').value;

            const identityData = {
                didMetadata: { method: didMethod, blockchain: blockchain, network: network, type: identityType },
                displayName: displayName
            };
            try {
                const newIdentity = await fetchData(`${privadoBaseUrl}/identities`, 'POST', { 'Authorization': authorizationHeader, 'accept': 'application/json' }, identityData);
                console.log("New Identity Created:", newIdentity);
                if (newIdentityModal) newIdentityModal.style.display = 'none';
                await loadIdentities(); // Reload identities after creation
                alert('Identity created successfully!');
                resetForm('new-identity-modal');
            } catch (error) {
                console.error("Error creating identity:", error);
                alert(`Error creating identity: ${error.message}`);
            }
        });
    }
    if (loadIdentitiesBtn) {
        loadIdentitiesBtn.addEventListener('click', async () => { await loadIdentities(); });
    }
    if (deleteIdentityBtn) {
        deleteIdentityBtn.addEventListener('click', () => {
            if (deleteIdentityModal) deleteIdentityModal.style.display = 'block';
            if (identitySelectDeleteElement) populateIdentitySelectDelete(currentIdentities);
        });
    }
    if (closeDeleteIdentityModalBtn) {
        closeDeleteIdentityModalBtn.addEventListener('click', () => { if (deleteIdentityModal) deleteIdentityModal.style.display = 'none'; });
    }
    if (cancelDeleteIdentityBtn) {
        cancelDeleteIdentityBtn.addEventListener('click', () => { if (deleteIdentityModal) deleteIdentityModal.style.display = 'none'; });
    }
    if (confirmDeleteIdentityBtn) {
        confirmDeleteIdentityBtn.addEventListener('click', async () => {
            const identityToDeleteId = identitySelectDeleteElement ? identitySelectDeleteElement.value : null;
            if (!identityToDeleteId) { alert('Please select an identity to delete.'); return; }
            try {
                await fetchData(`${privadoBaseUrl}/identities/${encodeURIComponent(identityToDeleteId)}`, 'DELETE', { 'Authorization': authorizationHeader, 'accept': 'application/json' });
                console.log("Identity Deleted:", identityToDeleteId);
                if (deleteIdentityModal) deleteIdentityModal.style.display = 'none';
                await loadIdentities(); // Reload identities after deletion
                alert('Identity deleted successfully!');
            } catch (error) {
                console.error("Error deleting identity:", error);
                alert(`Error deleting identity: ${error.message}`);
            }
        });
    }

    // --- Issue Credential Page Logic (issue-credential.html) ---
    const submitCredentialFormBtn = getElement('submit-credential-btn');
    const generateQrBtn = getElement('generate-qr-btn');
    const showQrDetailsBtn = getElement('show-qr-details-btn');
    const qrCodeModal = getElement('qr-code-modal');
    const closeQrModalBtn = getElement('close-qr-modal');
    const qrModalContent = getElement('qr-modal-content');
    const issueCredentialModal = getElement('issue-credential-modal'); // Refers to the modal, although the form is now on the page
    const closeCredentialModalBtn = getElement('close-credential-modal'); // Close button for the (potentially unused) issue modal


    if (submitCredentialFormBtn) {
        submitCredentialFormBtn.addEventListener('click', async () => {
            if (!validateCredentialForm()) { return; }

            const identifier = identitySelectElement.value; // Issuer DID
            const credentialSchema = getElement('credentialSchema').value;
            const credentialType = getElement('credentialType').value;
            const subjectId = getElement('subjectId').value;
            const birthday = parseInt(getElement('birthday').value);
            const documentType = parseInt(getElement('documentType').value);
            const expiration = parseInt(getElement('expiration').value) || undefined; // Will be `undefined` if input is empty/invalid

            // Construct the credentialSubject object from form inputs
            const credentialSubject = {
                id: subjectId,
                birthday: birthday,
                documentType: documentType
            };

            // Create an instance of IssuanceRequest for the payload
            const credentialData = new IssuanceRequest(
                credentialSchema,
                credentialType,
                credentialSubject,
                expiration
            );

            console.log("Credential Data being sent for Issuance:", JSON.stringify(credentialData, null, 2));

            try {
                // 1. Issue the credential (POST request)
                const newCredentialResponse = await fetchData(
                    `${privadoBaseUrl}/identities/${encodeURIComponent(identifier)}/credentials`,
                    'POST',
                    { 'Authorization': authorizationHeader, 'accept': 'application/json' },
                    credentialData
                );
                console.log("Credential Issued:", newCredentialResponse);
                alert('Credential issued successfully! Now retrieving QR code offer...');

                // 2. Extract the Claim ID from the newCredentialResponse
                // Based on API docs, the ID for the *issued claim* is usually named 'id' or 'claimID'
                const claimId = newCredentialResponse.id || newCredentialResponse.claimID;

                if (!claimId) {
                    console.error("Issued credential response missing 'id' (claim identifier):", newCredentialResponse);
                    alert("Issued credential, but could not get claim ID to generate QR offer.");
                    return;
                }

                // 3. Get the Credential Offer link using the **correct GET endpoint**
                const offerUrl = `${privadoBaseUrl}/identities/${encodeURIComponent(identifier)}/credentials/${encodeURIComponent(claimId)}/offer?type=universalLink`;
                
                const offerResponse = await fetchData(
                    offerUrl,
                    'GET',
                    { 'Authorization': authorizationHeader, 'accept': 'application/json' }
                );

                const universalLink = offerResponse.universalLink;

                if (universalLink) {
                    // --- CORRECTED QR Code Generation Logic using QRious ---
                    const qrCodeDisplay = getElement('qr-code-display');
                    const showQrDetailsBtn = getElement('show-qr-details-btn'); // Make sure this is retrieved
                    const qrModalContent = getElement('qr-modal-content');     // Make sure this is retrieved
                    const qrCodeModal = getElement('qr-code-modal');           // Make sure this is retrieved

                    // Always clear previous content from the display div
                    if (qrCodeDisplay) {
                        qrCodeDisplay.innerHTML = '';
                    }

                    const canvas = getElement('qrcodeCanvas');
                    
                    // Check if the canvas element exists
                    if (canvas) {
                       try {
                           // QRious will automatically clear the canvas before drawing.
                           // Initialize QRious and draw the QR code
                           new QRious({
                               element: canvas,      // The canvas element itself
                               value: universalLink, // The string to encode
                               size: 200,            // Size in pixels (width and height)
                               level: 'H',           // Error correction level (L, M, Q, H)
                               background: 'white',  // Background color
                               foreground: 'black'   // Foreground color
                           });
                           console.log('QR code generated on canvas using QRious!');

                       } catch (drawError) {
                           console.error('Error generating QR code with QRious:', drawError);
                           // Fallback to public API if canvas rendering fails (e.g., library not loaded)
                           if (qrCodeDisplay) {
                               qrCodeDisplay.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(universalLink)}" alt="QR Code" class="mx-auto block">`;
                           }
                       }
                    } else {
                        // Fallback to public QR API if canvas element is not available
                        console.warn("Canvas element for QR code not found. Using public QR API as fallback for display.");
                        if (qrCodeDisplay) {
                           qrCodeDisplay.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(universalLink)}" alt="QR Code" class="mx-auto block">`;
                        }
                    }
                    // --- END CORRECTED QR Code Generation Logic using QRious ---

                    // The rest of your code for showing details and modal remains the same
                    if (showQrDetailsBtn) showQrDetailsBtn.style.display = 'block';
                    if (qrModalContent) qrModalContent.textContent = universalLink; // Display the direct link in the modal
                    
                    alert('Credential issued and QR Code offer generated successfully!');
                    resetForm('issue-credential-modal');

                    if (qrCodeModal) qrCodeModal.style.display = 'block'; // Show the QR modal
                    
                    if (showQrDetailsBtn) showQrDetailsBtn.style.display = 'block';
                    if (qrModalContent) qrModalContent.textContent = universalLink; // Display the direct link in the modal
                    
                    alert('Credential issued and QR Code offer generated successfully!');
                    resetForm('issue-credential-modal');

                    if (qrCodeModal) qrCodeModal.style.display = 'block'; // Show the QR modal

                } else {
                    console.error("Did not receive a universalLink from credential offer API:", offerResponse);
                    alert('Failed to generate QR code data: universalLink not found in API response.');
                }
            } catch (error) {
                console.error("Error issuing credential or generating QR:", error);
                alert(`Error: ${error.message}`);
            }
        });
    }

    if (generateQrBtn) {
        generateQrBtn.addEventListener('click', async () => {
            // Ensure an issuer and a credential are selected from the UI
            if (!selectedIdentityForCredentials) {
                alert('Please select an Issuer Identity first to load credentials.');
                return;
            }
            if (!selectedCredential) {
                alert('Please select an existing Credential from the list first.');
                return;
            }

            const issuerIdentifier = selectedIdentityForCredentials;
            const claimId = selectedCredential.claimID || selectedCredential.id; // Get the ID from the currently selected credential

            const qrCodeDisplay = getElement('qr-code-display');
            if (qrCodeDisplay) qrCodeDisplay.innerHTML = 'Generating QR code...'; // Show loading message
            const showQrDetailsBtn = getElement('show-qr-details-btn');
            if (showQrDetailsBtn) showQrDetailsBtn.style.display = 'none';
            const qrModalContent = getElement('qr-modal-content');
            const qrCodeModal = getElement('qr-code-modal');


            try {
                // Call the correct GET endpoint to get the offer for the selected credential
                const offerUrl = `${privadoBaseUrl}/identities/${encodeURIComponent(issuerIdentifier)}/credentials/${encodeURIComponent(claimId)}/offer?type=universalLink`;

                const offerResponse = await fetchData(
                    offerUrl,
                    'GET',
                    { 'Authorization': authorizationHeader, 'accept': 'application/json' }
                );

                const universalLink = offerResponse.universalLink;

                if (universalLink) {
                    // Option A: Using qrcode.js (recommended if you added the <canvas> and script tag)
                    const canvas = getElement('qrcodeCanvas');
                    if (canvas && typeof QRCode !== 'undefined') { // Check if qrcode.js is loaded
                       qrCodeDisplay.innerHTML = ''; // Clear any other content in the display div
                       new QRCode(canvas, {
                            text: universalLink,
                            width: 200,
                            height: 200,
                            colorDark : "#000000",
                            colorLight : "#ffffff",
                            correctLevel : QRCode.CorrectLevel.H // High error correction
                        });
                        console.log('QR code generated on canvas!');
                    } else {
                        // Option B: Fallback to public QR API (if qrcode.js not used/loaded)
                        console.warn("qrcode.js or canvas not found. Using public QR API as fallback.");
                        if (qrCodeDisplay) {
                           qrCodeDisplay.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(universalLink)}" alt="QR Code" class="mx-auto block">`;
                        }
                    }

                    if (showQrDetailsBtn) showQrDetailsBtn.style.display = 'block';
                    if (qrModalContent) qrModalContent.textContent = universalLink; // Display the direct link

                    alert('QR Code offer generated successfully for the selected credential!');
                    if (qrCodeModal) qrCodeModal.style.display = 'block'; // Show the QR modal

                } else {
                    console.error("Did not receive a universalLink from credential offer API:", offerResponse);
                    alert('Failed to generate QR code data: universalLink not found in API response.');
                }
            } catch (error) {
                console.error("Error generating QR code for existing credential:", error);
                if (qrCodeDisplay) qrCodeDisplay.innerHTML = `<p class="text-red-500">Error generating QR code: ${error.message}</p>`;
                alert(`Error generating QR code: ${error.message}`);
            }
        });
    }
    if (showQrDetailsBtn) {
        showQrDetailsBtn.addEventListener('click', () => { if (qrCodeModal) qrCodeModal.style.display = 'block'; });
    }
    if (closeQrModalBtn) {
        closeQrModalBtn.addEventListener('click', () => { if (qrCodeModal) qrCodeModal.style.display = 'none'; });
    }

    // --- Global Window Click Listener to Close Modals ---
    // This listener handles closing any modal if the user clicks outside its content.
    window.addEventListener('click', (event) => {
        const newIdentityModal = getElement('new-identity-modal');
        if (newIdentityModal && event.target === newIdentityModal) {
            newIdentityModal.style.display = 'none';
            resetForm('new-identity-modal');
        }
        const issueCredentialModal = getElement('issue-credential-modal');
        if (issueCredentialModal && event.target === issueCredentialModal) {
            issueCredentialModal.style.display = 'none';
            resetForm('issue-credential-modal');
        }
        const deleteIdentityModal = getElement('delete-identity-modal');
        if (deleteIdentityModal && event.target === deleteIdentityModal) {
            deleteIdentityModal.style.display = 'none';
        }
        const revokeCredentialModal = getElement('revoke-credential-modal');
        if (revokeCredentialModal && event.target === revokeCredentialModal) {
            revokeCredentialModal.style.display = 'none';
        }
        const qrCodeModal = getElement('qr-code-modal');
        if (qrCodeModal && event.target === qrCodeModal) {
            qrCodeModal.style.display = 'none';
        }
        const presentationQrModal = getElement('presentation-qr-modal');
        if (presentationQrModal && event.target === presentationQrModal) {
            presentationQrModal.style.display = 'none';
        }
    });


    // --- Credential Management Page Logic (credentials.html) ---
    const loadCredentialsBtn = getElement('load-credentials-btn');
    const revokeCredentialBtn = getElement('revoke-credential-btn');
    const storeCredentialBtn = getElement('store-credential-btn');
    const checkRevocationStatusBtn = getElement('check-revocation-status-btn');
    const revokeCredentialModal = getElement('revoke-credential-modal');
    const closeRevokeCredentialModalBtn = getElement('close-revoke-credential-modal');
    const confirmRevokeCredentialBtn = getElement('confirm-revoke-credential-btn');
    const cancelRevokeCredentialBtn = getElement('cancel-revoke-credential-btn');
    const revocationStatusDisplay = getElement('revocation-status-display');
    const veramoStatusDiv = getElement('veramo-status');


    if (loadCredentialsBtn) {
        loadCredentialsBtn.addEventListener('click', () => {
            const selectedIdentifier = identitySelectElement ? identitySelectElement.value : null;
            if (selectedIdentifier) { loadCredentials(selectedIdentifier); selectedIdentityForCredentials = selectedIdentifier; }
            else { alert("Please select an Identity first to load credentials."); }
        });
    }
    if (storeCredentialBtn) {
        storeCredentialBtn.addEventListener('click', async () => {
            if (selectedCredential) {
                if (veramoStatusDiv) veramoStatusDiv.textContent = 'Storing credential in Veramo...';
                try {
                    const veramoCredentialData = { verifiableCredential: selectedCredential };


                    const response = await fetchData(`${veramoBaseUrl}/agent/dataStoreSaveVerifiableCredential`, 'POST', { 'Authorization': veramoAuthToken, 'accept': 'application/json; charset=utf-8', 'Content-Type': 'application/json' }, veramoCredentialData);
                    console.log("Credential stored in Veramo:", response);
                    if (veramoStatusDiv) veramoStatusDiv.textContent = 'Credential successfully stored in Veramo.';
                    alert('Credential stored in Veramo successfully!');
                } catch (error) {
                    console.error("Error storing credential in Veramo:", error);
                    if (veramoStatusDiv) veramoStatusDiv.textContent = `Error storing credential in Veramo: ${error.message}`;
                    alert(`Error storing credential in Veramo: ${error.message}`);
                }
            } else {
                if (veramoStatusDiv) veramoStatusDiv.textContent = 'No credential selected to store in Veramo.';
            }
        });
    }
    if (revokeCredentialBtn) {
        revokeCredentialBtn.addEventListener('click', () => {
            if (revokeCredentialModal) revokeCredentialModal.style.display = 'block';
            if (identitySelectRevokeElement) populateIdentitySelectRevoke(currentIdentities);
        });
    }
    if (closeRevokeCredentialModalBtn) {
        closeRevokeCredentialModalBtn.addEventListener('click', () => { if (revokeCredentialModal) revokeCredentialModal.style.display = 'none'; });
    }
    if (cancelRevokeCredentialBtn) {
        cancelRevokeCredentialBtn.addEventListener('click', () => { if (revokeCredentialModal) revokeCredentialModal.style.display = 'none'; });
    }
    if (identitySelectRevokeElement) {
        identitySelectRevokeElement.addEventListener('change', () => {
            const selectedIssuerDid = identitySelectRevokeElement.value;
            if (selectedIssuerDid) { loadCredentials(selectedIssuerDid); }
            else { if (credentialSelectRevokeElement) { credentialSelectRevokeElement.innerHTML = ''; credentialSelectRevokeElement.disabled = true; } }
        });
    }
     if (confirmRevokeCredentialBtn) {
        confirmRevokeCredentialBtn.addEventListener('click', async () => {
            // Get the ID of the credential selected in the modal dropdown.
            // This ID (claimID or standard VC ID) is primarily for finding the full credential object
            // and for user feedback/logging. The API uses the nonce.
            const credentialIdInModal = credentialSelectRevokeElement ? credentialSelectRevokeElement.value : null;

            // Get the issuer's DID from the global state, which was set when credentials were loaded.
            const issuerIdentifier = selectedIdentityForCredentials;

            // Find the full VerifiableCredential object from the `currentCredentials` array
            // using the ID selected in the modal.
            const selectedVcToRevoke = currentCredentials.find(vc =>
                (vc.claimID || vc.id) === credentialIdInModal
            );

            // --- Basic Validation ---
            if (!selectedVcToRevoke) {
                alert('No credential selected or found for revocation in the current list.');
                return;
            }
            if (!issuerIdentifier) {
                alert('Issuer identity not selected. Please load credentials by selecting an identity first.');
                return;
            }

            // The revocation nonce is a crucial part of the API endpoint.
            // It's retrieved from the `revocationNonce` property of the `selectedVcToRevoke` object.
            const revocationNonce = selectedVcToRevoke.revocationNonce;

            // Check if the revocationNonce is valid (0 is a valid nonce, but undefined/null are not)
            if (revocationNonce === undefined || revocationNonce === null) {
                alert('Selected credential does not have a valid revocation nonce. Cannot revoke.');
                console.error('Revocation failed: revocationNonce is undefined or null for credential:', selectedVcToRevoke);
                return;
            }

            try {
                // --- Construct the NEW URL for the POST /revoke/{nonce} endpoint ---
                // Endpoint: /v2/identities/{identifier}/credentials/revoke/{nonce}
                const revokeUrl = `${privadoBaseUrl}/identities/${encodeURIComponent(issuerIdentifier)}/credentials/revoke/${encodeURIComponent(revocationNonce)}`;

                // --- Send the POST request to revoke the credential ---
                // The API documentation implies that the nonce is sufficient in the URL,
                // so no specific request body is passed for this POST call.
                await fetchData(revokeUrl, 'POST', { 'Authorization': authorizationHeader, 'accept': 'application/json' });

                console.log("Credential Revoked Successfully:", selectedVcToRevoke.claimID || selectedVcToRevoke.id, "with nonce:", revocationNonce);
                if (revokeCredentialModal) revokeCredentialModal.style.display = 'none'; // Close the modal
                await loadCredentials(issuerIdentifier); // Reload credentials for the issuer to show updated status
                alert('Credential revoked successfully!');
            } catch (error) {
                console.error("Error revoking credential:", error);
                alert(`Error revoking credential: ${error.message}`);
            }
        });
    }
    if (checkRevocationStatusBtn) {
        checkRevocationStatusBtn.addEventListener('click', async () => {
            if (!selectedCredential) { alert('Please select a credential from the list first to check its revocation status.'); return; }
            if (!selectedIdentityForCredentials) { alert('Could not determine the issuer identity for the selected credential. Please load credentials by selecting an identity first.'); return; }

            if (revocationStatusDisplay) {
                revocationStatusDisplay.textContent = 'Checking revocation status...';
                revocationStatusDisplay.className = 'mt-4 text-gray-700';
            }

            try {
                const credentialIdForRevocation = selectedCredential.claimID || selectedCredential.id;
                const issuerDid = selectedIdentityForCredentials;
                if (!credentialIdForRevocation) {
                     alert('The selected credential does not have a valid ID (claimID or id) for revocation status check.');
                     if (revocationStatusDisplay) { revocationStatusDisplay.textContent = 'Error: Credential ID missing.'; revocationStatusDisplay.className = 'mt-4 text-red-500'; }
                     return;
                }
                const revocationCheckResponse = await fetchData(
                    // VERIFY this endpoint with Privado ID documentation.
                    // This might be: /identities/{issuerDid}/credentials/{claimID}/revocation-status or similar.
                    `${privadoBaseUrl}/identities/${encodeURIComponent(issuerDid)}/credentials/${encodeURIComponent(credentialIdForRevocation)}/revocation-status`,
                    'GET',
                    { 'Authorization': authorizationHeader, 'accept': 'application/json' }
                );
                if (revocationCheckResponse && typeof revocationCheckResponse.revoked === 'boolean') {
                    if (revocationStatusDisplay) {
                        revocationStatusDisplay.textContent = `Credential ID: ${credentialIdForRevocation} is ${revocationCheckResponse.revoked ? 'REVOKED' : 'NOT REVOKED'}.`;
                        revocationStatusDisplay.className = `mt-4 font-bold ${revocationCheckResponse.revoked ? 'text-red-600' : 'text-green-600'}`;
                    }
                } else {
                    if (revocationStatusDisplay) {
                        revocationStatusDisplay.textContent = `Could not determine revocation status for Credential ID: ${credentialIdForRevocation}. Response: ${JSON.stringify(revocationCheckResponse)}`;
                        revocationStatusDisplay.className = `mt-4 text-orange-500`;
                    }
                }
                alert('Revocation status checked!');
            } catch (error) {
                console.error("Error checking revocation status:", error);
                if (revocationStatusDisplay) {
                    revocationStatusDisplay.textContent = `Error checking revocation status: ${error.message}`;
                    revocationStatusDisplay.className = `mt-4 text-red-500`;
                }
                alert(`Error checking revocation status: ${error.message}`);
            }
        });
    }

    // --- Present Credential Page Logic (present-credential.html) ---
    const generatePresentationQrBtn = getElement('generate-presentation-qr-btn');
    const presentationQrDisplay = getElement('presentation-qr-display');
    const presentationQrModal = getElement('presentation-qr-modal');
    const closePresentationQrModalBtn = getElement('close-presentation-qr-modal');
    const presentationQrModalContent = getElement('presentation-qr-modal-content');
    const presentationResultDiv = getElement('presentation-result');

    if (generatePresentationQrBtn) {
        generatePresentationQrBtn.addEventListener('click', async () => {
            if (presentationQrDisplay) presentationQrDisplay.innerHTML = 'Generating presentation request QR...';
            if (presentationResultDiv) presentationResultDiv.textContent = 'Waiting for presentation from wallet...';
            if (presentationQrModalContent) presentationQrModalContent.textContent = '';

            // Define the presentation request payload.
            // This defines what kind of credential you are asking the wallet to present.
            // This structure is HIGHLY dependent on the Privado ID (Polygon ID) Verifier API.
            // You MUST verify the exact payload with the Privado ID documentation.
            const presentationRequestPayload = {
                reason: 'Credential Presentation Demo', // A reason for the presentation
                schema: {
                    url: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCAgeCredential-v3.json', // Example: Requesting a KYC Age Credential
                    type: 'KYCAgeCredential'
                },
                // IMPORTANT: The callback URL is where the wallet sends the Verifiable Presentation.
                // This MUST be an endpoint on your *backend server* that is publicly accessible (e.g., via ngrok).
                // A client-side HTML/JS app cannot directly receive these inbound callbacks.
                callbackUrl: 'YOUR_VERIFIER_BACKEND_CALLBACK_URL', // **REPLACE THIS WITH YOUR ACTUAL BACKEND URL**
                // Other parameters might be required, e.g., circuitId, challenge, etc.
            };

            try {
                // This endpoint is a placeholder. You NEED to verify the correct endpoint
                // from the Privado ID (Polygon ID) Verifier API documentation for generating presentation requests.
                // It could be something like: /v2/presentation/request-qr
                const qrCodeResponse = await fetchData(
                    `${privadoBaseUrl}/presentation/request-qr`, // **VERIFY THIS ENDPOINT**
                    'POST',
                    { 'Authorization': authorizationHeader, 'accept': 'application/json' },
                    presentationRequestPayload
                );

                // Assuming the response contains a `qrCode` field with the JSON data, or a `url` field
                let qrData = qrCodeResponse.qrCode || qrCodeResponse.url || qrCodeResponse;

                if (qrData) {
                    if (presentationQrDisplay) presentationQrDisplay.innerHTML = `<img src="https://via.placeholder.com/200?text=Scan+Me" alt="Presentation QR Code" class="mx-auto block">`;
                    if (presentationQrModalContent) presentationQrModalContent.textContent = JSON.stringify(qrData, null, 2);
                    if (presentationQrModal) presentationQrModal.style.display = 'block'; // Show modal directly
                    alert('Presentation Request QR Code generated successfully! Scan it with your wallet.');
                } else {
                    if (presentationQrDisplay) presentationQrDisplay.innerHTML = `<p class="text-red-500">Failed to generate presentation QR code data.</p>`;
                    alert('Failed to generate presentation QR code data. Check console for details.');
                }
            } catch (error) {
                console.error("Error generating presentation QR code:", error);
                if (presentationQrDisplay) presentationQrDisplay.innerHTML = `<p class="text-red-500">Error generating presentation QR code: ${error.message}</p>`;
                alert(`Error generating presentation QR code: ${error.message}`);
            }
        });
    }
    if (closePresentationQrModalBtn) {
        closePresentationQrModalBtn.addEventListener('click', () => { if (presentationQrModal) presentationQrModal.style.display = 'none'; });
    }

    // --- Initial page load actions ---
    // Calls loadIdentities on DOMContentLoaded for any page that might need identity data (e.g., for dropdowns).
    // This runs on any page that has an identity-related dropdown or list.
    loadIdentities();
});


// --- Logout Functionality ---
// Simple client-side logout. In a real application, this would involve clearing
// authentication tokens/sessions and potentially redirecting to a login page.
const logoutBtn = getElement('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default link behavior (e.g., navigating away)
        alert('Logged out (client-side only). In a real application, this would clear tokens/sessions.');
        // Example: localStorage.removeItem('authToken');
        // Example: window.location.href = 'login.html'; // Redirect to a login page
    });
}

