// js/credential-manager.js

import { VerifiableCredential } from '../classes/verifiable-credential.js';
import { getElement, fetchData } from './utils.js';
import { privadoBaseUrl, authorizationHeader, veramoBaseUrl, veramoAuthToken,
         currentCredentials, selectedCredential, selectedIdentityForCredentials,
         updateCurrentCredentials, updateSelectedCredential, updateSelectedIdentityForCredentials } from './config.js';

const KEY = "Key123";

async function encryptWithKey(data, keyString) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const passwordBuffer = encoder.encode(keyString);
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        await window.crypto.subtle.importKey("raw", passwordBuffer, { name: "PBKDF2" }, false, ["deriveKey"]),
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedData = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        dataBuffer
    );
    const encryptedBuffer = new Uint8Array(encryptedData);
    const combinedBuffer = new Uint8Array(salt.length + iv.length + encryptedBuffer.length);
    combinedBuffer.set(salt);
    combinedBuffer.set(iv, salt.length);
    combinedBuffer.set(encryptedBuffer, salt.length + iv.length);
    return btoa(String.fromCharCode(...combinedBuffer));
}

async function decryptWithKey(encryptedText, keyString) {
    const combinedBuffer = new Uint8Array(atob(encryptedText).split("").map(c => c.charCodeAt(0)));
    const salt = combinedBuffer.slice(0, 16);
    const iv = combinedBuffer.slice(16, 28);
    const encryptedBuffer = combinedBuffer.slice(28);
    const passwordBuffer = new TextEncoder().encode(keyString);
    const key = await window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000,
            hash: "SHA-256",
        },
        await window.crypto.subtle.importKey("raw", passwordBuffer, { name: "PBKDF2" }, false, ["deriveKey"]),
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
    const decryptedData = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        key,
        encryptedBuffer
    );
    return new TextDecoder().decode(decryptedData);
}

export async function loadCredentials(issuerIdentifier) {
    const isVeramoDid = issuerIdentifier.startsWith('did:key') || issuerIdentifier.startsWith('did:ethr') || issuerIdentifier.startsWith('did:web');
    try {
        let credentialsArray = [];
        if (isVeramoDid) {
            const rawResponse = await fetchData(
                `${veramoBaseUrl}/dataStoreORMGetVerifiableCredentials`,
                'POST',
                { 'Authorization': veramoAuthToken },
                { where: [{ column: 'issuer', value: [issuerIdentifier], op: 'Equals' }] }
            );
            if (rawResponse && Array.isArray(rawResponse)) {
                credentialsArray = await Promise.all(rawResponse.map(async item => {
                    // Correctly handle credentials whether they are nested or not
                    const credentialData = item.verifiableCredential || item;
                    if (credentialData.encryptedData) {
                        try {
                            const decryptedString = await decryptWithKey(credentialData.encryptedData, KEY);
                            const decryptedVc = JSON.parse(decryptedString);
                            return new VerifiableCredential({ vc: decryptedVc });
                        } catch (e) {
                            console.error("Decryption failed for a Veramo credential:", e);
                            return new VerifiableCredential({ vc: { ...credentialData, error: "Decryption Failed" } });
                        }
                    }
                    return new VerifiableCredential({ vc: credentialData });
                }));
                console.log("Credentials fetched from Veramo agent:", credentialsArray);
            }
        } else {
            const rawResponse = await fetchData(
                `${privadoBaseUrl}/identities/${encodeURIComponent(issuerIdentifier)}/credentials`,
                'GET',
                { 'Authorization': authorizationHeader, 'accept': 'application/json' }
            );
            if (rawResponse && Array.isArray(rawResponse.items)) {
                credentialsArray = rawResponse.items.map(rawVc => new VerifiableCredential(rawVc));
                console.log("Credentials fetched from Privado ID:", credentialsArray);
            }
        }
        updateCurrentCredentials(credentialsArray);
        updateSelectedIdentityForCredentials(issuerIdentifier);
        const credentialList = getElement('credential-list');
        if (credentialList) renderCredentials(currentCredentials);
        const credentialSelectRevokeElement = getElement('credential-select-revoke');
        if (credentialSelectRevokeElement) populateCredentialSelectRevoke(currentCredentials);
    } catch (error) {
        console.error("Error loading credentials:", error);
        const credentialList = getElement('credential-list');
        if (credentialList) {
            credentialList.innerHTML = `<li class="text-red-500">Error loading credentials: ${error.message}</li>`;
        }
        alert(`Error loading credentials: ${error.message}`);
    }
}

export function renderCredentials(credentials) {
    const credentialList = getElement('credential-list');
    const presentCredentialBtn = getElement('present-credential-btn');
    const revokeCredentialBtn = getElement('revoke-credential-btn');
    const storeCredentialBtn = getElement('store-credential-btn');
    const presentationDetailsSection = getElement('presentation-details-section');

    if (!credentialList) return;
    credentialList.innerHTML = '';
    
    // Disable all action buttons and hide presentation details section by default
    if (presentCredentialBtn) presentCredentialBtn.disabled = true;
    if (revokeCredentialBtn) revokeCredentialBtn.disabled = true;
    if (storeCredentialBtn) storeCredentialBtn.disabled = true;
    if (presentationDetailsSection) presentationDetailsSection.style.display = 'none';
    updateSelectedCredential(null);

    if (credentials && credentials.length > 0) {
        credentials.forEach(credential => {
            // Use JSON.stringify for a reliable debugging view
            console.log("Rendering credential:", JSON.stringify(credential, null, 2));

            // Updated logic to find a valid ID from the credential object
            const credentialId = credential.id || credential.claimID || (typeof credential.credentialSubject?.id === 'string' ? credential.credentialSubject.id : null);
            if (!credentialId) {
                console.warn('Skipping credential due to missing or invalid ID:', credential);
            }

            const listItem = document.createElement('li');
            listItem.className = "flex items-center py-2 border-b border-gray-200 hover:bg-gray-100";
            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = 'selectedCredentialRadio';
            radioInput.id = `credential-${credentialId}`;
            radioInput.className = 'form-radio h-4 w-4 text-blue-600 mr-2 cursor-pointer';
            const label = document.createElement('label');
            label.htmlFor = radioInput.id;
            label.className = 'flex-grow cursor-pointer block';
            label.innerHTML = `
                <div class="font-semibold text-gray-800">ID: ${credentialId}</div>
                <div class="text-sm text-gray-600">Type: ${Array.isArray(credential.type) ? credential.type.join(', ') : credential.type}</div>
                <div class="text-sm text-gray-600">Subject: ${typeof credential.credentialSubject?.id === 'string' ? credential.credentialSubject.id : 'N/A'}</div>
                <div class="text-xs text-gray-500">Issued: ${new Date(credential.issuanceDate).toLocaleDateString()}</div>
                ${credential.expirationDate ? `<div class="text-xs text-red-500">Expires: ${new Date(credential.expirationDate).toLocaleDateString()}</div>` : ''}
                ${credential.revoked ? `<div class="text-xs text-red-700 font-bold">Status: REVOKED</div>` : ''}
            `;
            label.dataset.credentialId = credentialId;
            radioInput.addEventListener('change', (event) => {
                if (event.target.checked) {
                    const selectedId = event.target.id.replace('credential-', '');
                    const selected = currentCredentials.find(vc => (vc.id || vc.claimID || vc.credentialSubject?.id) === selectedId);
                    updateSelectedCredential(selected);
                    alert('Credential selected: ' + (selected ? (selected.id || selected.claimID || selected.credentialSubject?.id) : 'None'));
                    
                    if (selected) {
                        console.log("Selected Credential:", selected);
                        if (presentCredentialBtn) presentCredentialBtn.disabled = false;
                        if (revokeCredentialBtn) revokeCredentialBtn.disabled = false;
                        if (storeCredentialBtn) {
                            storeCredentialBtn.disabled = false;
                            storeCredentialBtn.className = "bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
                        }
                        if (presentationDetailsSection) presentationDetailsSection.style.display = 'block';
                        
                        renderCredentialClaims(selected);
                    } else {
                        updateSelectedCredential(null);
                        if (presentCredentialBtn) presentCredentialBtn.disabled = true;
                        if (revokeCredentialBtn) revokeCredentialBtn.disabled = true;
                        if (storeCredentialBtn) {
                            storeCredentialBtn.disabled = true;
                            storeCredentialBtn.className = "bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
                        }
                        if (presentationDetailsSection) presentationDetailsSection.style.display = 'none';
                    }
                    if (revocationStatusDisplay) revocationStatusDisplay.textContent = '';
                    if (veramoStatusDiv) veramoStatusDiv.textContent = '';
                }
            });
            listItem.appendChild(radioInput);
            listItem.appendChild(label);
            credentialList.appendChild(listItem);
        });
    } else {
        credentialList.innerHTML = '<li class="text-gray-500 py-2">No credentials issued for this identity.</li>';
        if (presentCredentialBtn) presentCredentialBtn.disabled = true;
        if (revokeCredentialBtn) revokeCredentialBtn.disabled = true;
        if (storeCredentialBtn) {
            storeCredentialBtn.disabled = true;
            storeCredentialBtn.className = "bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
        }
        updateSelectedCredential(null);
    }
}


/**
 * Renders the claims of a selected credential with checkboxes for selective disclosure.
 * @param {object} credential - The selected credential object.
 */
function renderCredentialClaims(credential) {
    const claimsContainer = getElement('credential-claims-container');
    if (!claimsContainer) return;

    claimsContainer.innerHTML = '';
    let subject = credential.credentialSubject || credential.vc.credentialSubject;
    let useFakeData = false;
    // --- Start of the FAKE DATA section ---
    //
    // To enable the fake data for demonstration purposes, uncomment the line below.
    // This will override the real credential data.
    //
    useFakeData = true;
    //
    if (useFakeData) {
         subject = { firstName: 'John', lastName: 'Doe', dateOfBirth: '1995-12-01', documentNumber: 'A123-4567-890', issueDate: '2023-01-15', expirationDate: '2028-01-15', email: 'john.doe@example.com', city: 'Anytown', street: '123 Main St' };
         console.warn("Using fake credential claims for demonstration.");
    }
    //
    // --- End of the FAKE DATA section ---


    if (subject) {
        for (const key in subject) {
            if (key !== 'id') {
                const claimId = `claim-${key}`;
                const claimDiv = document.createElement('div');
                claimDiv.className = 'flex items-center';
                claimDiv.innerHTML = `
                    <input type="checkbox" id="${claimId}" name="${key}" class="claim-checkbox mr-2 h-4 w-4 text-green-600" checked>
                    <label for="${claimId}" class="flex-grow">
                        <span class="font-medium">${key}:</span> ${subject[key]}
                    </label>
                `;
                claimsContainer.appendChild(claimDiv);
            }
        }
    } else {
        claimsContainer.innerHTML = '<p class="text-red-500">Could not find credential claims.</p>';
    }
}

// ... (your existing code below) ...

/**
 * Generates an OID4VP request and displays it as a QR code.
 * @param {object} presentationDefinition - The presentation definition payload.
 * @param {string} source - The source of the credentials ('veramo', 'walt-id', or 'privado').
 */
async function generatePresentation(presentationDefinition, source) {
    try {
        let offerResponse;
        let deeplink;
        
        // Retrieve the issuer's DID from the selected credential
        const issuerDid = selectedCredential.issuer?.id;
        if (!issuerDid) {
            alert('Could not find the issuer DID for the selected credential.');
            return;
        }

        if (source === 'veramo') {
            const payload = {
                data: {
                    // Veramo's SDR endpoint requires a top-level 'issuer' property
                    issuer: issuerDid,
                    // And the claims are based on the input descriptors
                    claims: presentationDefinition.input_descriptors.map(descriptor => ({
                        credentialType: descriptor.id.replace('credential-descriptor-1-', ''), // A bit of a hack, but should work for your setup
                        claimType: descriptor.constraints.fields[0].path[0].replace('$.vc.credentialSubject.', ''),
                    }))
                }
            };
            
            offerResponse = await fetchData(
                `${veramoBaseUrl}/createSelectiveDisclosureRequest`,
                'POST',
                { 'Authorization': veramoAuthToken },
                payload
            );
            deeplink = offerResponse;
        } else if (source === 'walt-id') {
            const payload = {
                presentationDefinition: presentationDefinition
            };
            offerResponse = await fetchData(
                `${waltIdBaseUrl}/v1/didkit/presentations/definitions`,
                'POST',
                { 'Authorization': waltIdAuthToken },
                payload
            );
            deeplink = offerResponse.url;
        } else if (source === 'privado') {
            const payload = {
                presentationDefinition: presentationDefinition
            };
            offerResponse = await fetchData(
                `${privadoBaseUrl}/presentations/definitions`,
                'POST',
                { 'Authorization': authorizationHeader },
                payload
            );
            const requestData = await fetchData(offerResponse.url, 'GET', { 'Authorization': authorizationHeader });
            deeplink = requestData.body;
        } else {
            console.error('Unsupported credential source:', source);
            alert('Presentation is not supported for the selected credential source.');
            return;
        }

        if (deeplink) {
            displayQrCode(deeplink);
        } else {
            alert('Failed to generate a presentation offer. Check the console for details.');
        }

    } catch (error) {
        console.error('Error generating presentation offer:', error);
        alert('An error occurred while generating the presentation offer. Check the console for more details.');
    }
}

/**
 * Displays a QR code using QRious.
 * @param {string} data - The data string to encode in the QR code.
 */
function displayQrCode(data) {
    const qrCodeModal = getElement('presentation-modal');
    const canvas = getElement('qrcodeCanvas');
    const deeplinkDisplay = getElement('deeplink-display');

    if (!qrCodeModal || !canvas || !deeplinkDisplay) {
        console.error("Missing QR code display elements.");
        return;
    }

    const qrCodeDisplay = getElement('qr-code-display');
    qrCodeDisplay.innerHTML = '';
    const newCanvas = document.createElement('canvas');
    newCanvas.id = 'qrcodeCanvas';
    qrCodeDisplay.appendChild(newCanvas);

    try {
        new QRious({
            element: newCanvas,
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

    deeplinkDisplay.textContent = data;
    qrCodeModal.style.display = 'block';
}

export function populateCredentialSelectRevoke(credentials) {
    const credentialSelectRevokeElement = getElement('credential-select-revoke');
    if (!credentialSelectRevokeElement) return;
    credentialSelectRevokeElement.innerHTML = '';
    if (credentials && credentials.length > 0) {
        credentials.forEach(credential => {
            const option = document.createElement('option');
            option.value = credential.claimID || credential.id;
            option.textContent = `ID: ${credential.claimID || credential.id}, Type: ${credential.type}, Subject: ${credential.credentialSubject?.id || 'N/A'}`;
            option.dataset.issuerDid = credential.issuer.id;
            option.dataset.source = credential.source;
            credentialSelectRevokeElement.appendChild(option);
        });
    } else {
        const option = document.createElement('option');
        option.textContent = 'No credentials available';
        credentialSelectRevokeElement.appendChild(option);
        option.disabled = true;
    }
}

async function deleteVeramoCredential(credentialHash) {
    console.log(`Attempting to delete Veramo credential with hash: ${credentialHash}`);
    const payload = { hash: credentialHash };
    try {
        const response = await fetchData(
            `${veramoBaseUrl}/dataStoreDeleteVerifiableCredential`,
            'POST',
            { 'Authorization': veramoAuthToken },
            payload
        );
        console.log(`Veramo credential with hash ${credentialHash} deleted successfully.`, response);
        return true;
    } catch (error) {
        console.error(`Error deleting Veramo credential with hash ${credentialHash}:`, error);
        throw new Error(`Failed to delete Veramo credential: ${error.message}`);
    }
}

export function setupCredentialManagerEventListeners() {
    const loadCredentialsBtn = getElement('load-credentials-btn');
    const presentCredentialBtn = getElement('present-credential-btn');
    const revokeCredentialBtn = getElement('revoke-credential-btn');
    const storeCredentialBtn = getElement('store-credential-btn');
    const checkRevocationStatusBtn = getElement('check-revocation-status-btn');
    const revokeCredentialModal = getElement('revoke-credential-modal');
    const closeRevokeCredentialModalBtn = getElement('close-revoke-credential-modal');
    const confirmRevokeCredentialBtn = getElement('confirm-revoke-credential-btn');
    const cancelRevokeCredentialBtn = getElement('cancel-revoke-credential-btn');
    const revocationStatusDisplay = getElement('revocation-status-display');
    const veramoStatusDiv = getElement('veramo-status');
    const identitySelectElement = getElement('identity-select');
    const presentationModal = getElement('presentation-modal');
    const closePresentationModalBtn = getElement('close-presentation-modal');
    const generatePresentationBtn = getElement('generate-presentation-btn');
    const closeQrModalBtn = getElement('close-qr-modal');

    if (loadCredentialsBtn) {
        loadCredentialsBtn.addEventListener('click', () => {
            const selectedIdentifier = identitySelectElement ? identitySelectElement.value : null;
            if (selectedIdentifier) {
                loadCredentials(selectedIdentifier);
                updateSelectedIdentityForCredentials(selectedIdentifier);
            } else {
                alert("Please select an Identity first to load credentials.");
            }
        });
    }

    // New event listener for the "Present" button
    if (presentCredentialBtn) {
        presentCredentialBtn.addEventListener('click', () => {
            if (!selectedCredential) {
                alert('Please select a credential from the list first.');
                return;
            }
            // The claims section is automatically shown and populated when a credential is selected via the radio button
            // Now, we just wait for the user to click the "Generate Presentation Offer" button.
            // This button is within the new "presentation-details-section".
            // We just need to ensure that the section is visible.
        });
    }

    // New event listener for the "Generate Presentation Offer" button
    if (generatePresentationBtn) {
        generatePresentationBtn.addEventListener('click', async () => {
            if (!selectedCredential) {
                alert('No credential selected.');
                return;
            }

            const subject = selectedCredential.credentialSubject || selectedCredential.vc.credentialSubject;
            const credentialType = selectedCredential.type[1] || 'VerifiableCredential';

            // Gather selected claims for selective disclosure
            const selectedClaims = [];
            const checkboxes = document.querySelectorAll('#credential-claims-container .claim-checkbox:checked');
            checkboxes.forEach(checkbox => {
                selectedClaims.push(checkbox.name);
            });

            const presentationDefinition = {
                id: "vp_request",
                input_descriptors: [{
                    id: "credential-descriptor-1",
                    name: `Request for a ${credentialType} Credential`,
                    purpose: `To prove that you have a ${credentialType} credential.`,
                    format: {
                        jwt_vc: { alg: ["ES256K"] }
                    },
                    constraints: {
                        fields: selectedClaims.map(claim => ({
                            path: [`$.vc.credentialSubject.${claim}`]
                        }))
                    }
                }]
            };
             // CORRECTED DEBUGGING LINE: Use JSON.stringify to see the full content
            console.log("Rendering credential:", JSON.stringify(selectedCredential, null, 2));
            
            let source;
            if (selectedCredential.source && selectedCredential.source.includes('veramo')) {
                source = 'veramo';
            } else if (selectedCredential.source && selectedCredential.source.includes('walt-id')) {
                source = 'veramo';
            } else {
                source = 'veramo';
            }
            await generatePresentation(presentationDefinition, source);
        });
    }

    // New event listener for closing the presentation modal
    if (closePresentationModalBtn) {
        closePresentationModalBtn.addEventListener('click', () => {
            if (presentationModal) presentationModal.style.display = 'none';
        });
    }
    if (closeQrModalBtn) {
        closeQrModalBtn.addEventListener('click', () => {
            if (presentationModal) presentationModal.style.display = 'none';
        });
    }

    if (storeCredentialBtn) {
        storeCredentialBtn.addEventListener('click', async () => {
            if (selectedCredential) {
                if (veramoStatusDiv) veramoStatusDiv.textContent = 'Storing credential in Veramo...';
                try {
                    const encryptionKey = "Key123";
                    const encryptedData = await encryptWithKey(JSON.stringify(selectedCredential), encryptionKey);
                    const veramoCredentialData = {
                        verifiableCredential: {
                            ...selectedCredential,
                            encrypted: true,
                            encryptedData: encryptedData
                        }
                    };
                    const response = await fetchData(`${veramoBaseUrl}/dataStoreSaveVerifiableCredential`, 'POST', { 'Authorization': veramoAuthToken, 'accept': 'application/json; charset=utf-8', 'Content-Type': 'application/json' }, veramoCredentialData);
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
        });
    }
    if (closeRevokeCredentialModalBtn) {
        closeRevokeCredentialModalBtn.addEventListener('click', () => { if (revokeCredentialModal) revokeCredentialModal.style.display = 'none'; });
    }
    if (cancelRevokeCredentialBtn) {
        cancelRevokeCredentialBtn.addEventListener('click', () => { if (revokeCredentialModal) revokeCredentialModal.style.display = 'none'; });
    }
    const identitySelectRevokeElement = getElement('identity-select-revoke');
    const credentialSelectRevokeElement = getElement('credential-select-revoke');
    if (identitySelectRevokeElement) {
        identitySelectRevokeElement.addEventListener('change', () => {
            const selectedIssuerDid = identitySelectRevokeElement.value;
            if (selectedIssuerDid) {
                loadCredentials(selectedIssuerDid);
            } else {
                if (credentialSelectRevokeElement) {
                    credentialSelectRevokeElement.innerHTML = '';
                    credentialSelectRevokeElement.disabled = true;
                }
            }
        });
    }
    if (confirmRevokeCredentialBtn) {
        confirmRevokeCredentialBtn.addEventListener('click', async () => {
            const selectedOption = credentialSelectRevokeElement.selectedOptions[0];
            const credentialId = selectedOption ? selectedOption.value : null;
            const issuerDid = selectedOption ? selectedOption.dataset.issuerDid : null;
            const credentialSource = selectedOption ? selectedOption.dataset.source : null;
            if (!credentialId || !issuerDid || !credentialSource) {
                alert('Please select a valid credential to delete or revoke.');
                return;
            }
            try {
                if (credentialSource === 'veramo') {
                    const credentialToDelete = currentCredentials.find(c => c.id === credentialId);
                    if (credentialToDelete && credentialToDelete.hash) {
                         await deleteVeramoCredential(credentialToDelete.hash);
                         alert('Veramo Credential deleted successfully!');
                    } else {
                        throw new Error('Veramo credential object not found or missing hash.');
                    }
                } else {
                    const selectedVcToRevoke = currentCredentials.find(vc => (vc.claimID || vc.id) === credentialId);
                    const revocationNonce = selectedVcToRevoke?.revocationNonce;
                    if (revocationNonce === undefined || revocationNonce === null) {
                        throw new Error('Selected credential does not have a valid revocation nonce. Cannot revoke.');
                    }
                    const revokeUrl = `${privadoBaseUrl}/identities/${encodeURIComponent(issuerDid)}/credentials/revoke/${encodeURIComponent(revocationNonce)}`;
                    await fetchData(revokeUrl, 'POST', { 'Authorization': authorizationHeader, 'accept': 'application/json' });
                    alert('Privado ID Credential revoked successfully!');
                }
                if (revokeCredentialModal) revokeCredentialModal.style.display = 'none';
                await loadCredentials(issuerDid);
            } catch (error) {
                console.error("Error during credential operation:", error);
                alert(`Error during credential operation: ${error.message}`);
            }
        });
    }
    if (checkRevocationStatusBtn) {
        checkRevocationStatusBtn.addEventListener('click', async () => {
            if (!selectedCredential) { alert('Please select a credential from the list first to check its revocation status.'); return; }
            if (!selectedIdentityForCredentials) { alert('Could not determine the issuer identity for the selected credential. Please load credentials by selecting an identity first.'); return; }
            const isVeramoCredential = selectedCredential.id.startsWith('did:key') || selectedCredential.id.startsWith('did:ethr');
            if (revocationStatusDisplay) {
                revocationStatusDisplay.textContent = 'Checking revocation status...';
                revocationStatusDisplay.className = 'mt-4 text-gray-700';
            }
            try {
                const credentialIdForRevocation = selectedCredential.claimID || selectedCredential.id;
                const issuerDid = selectedIdentityForCredentials;
                if (isVeramoCredential) {
                    if (revocationStatusDisplay) {
                        revocationStatusDisplay.textContent = `Veramo credentials' revocation status cannot be checked via a public API. This credential is a self-signed JWT.`;
                    }
                    return;
                }
                if (!credentialIdForRevocation) {
                    alert('The selected credential does not have a valid ID (claimID or id) for revocation status check.');
                    if (revocationStatusDisplay) { revocationStatusDisplay.textContent = 'Error: Credential ID missing.'; revocationStatusDisplay.className = 'mt-4 text-red-500'; }
                    return;
                }
                const revocationCheckResponse = await fetchData(
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
}