// js/credential-manager.js

import { VerifiableCredential } from '../classes/verifiable-credential.js'; // Adjust path
import { getElement, fetchData } from './utils.js';
import { privadoBaseUrl, authorizationHeader, veramoBaseUrl, veramoAuthToken,
         currentCredentials, selectedCredential, selectedIdentityForCredentials,
         updateCurrentCredentials, updateSelectedCredential, updateSelectedIdentityForCredentials } from './config.js';

/**
 * Loads credentials for a specific issuer identity and updates the UI.
 * @param {string} issuerIdentifier - The DID of the issuer identity.
 */
export async function loadCredentials(issuerIdentifier) {
    try {
        const rawResponse = await fetchData(`${privadoBaseUrl}/identities/${encodeURIComponent(issuerIdentifier)}/credentials`, 'GET', { 'Authorization': authorizationHeader, 'accept': 'application/json' });

        let credentialsArrayFromAPI = [];
        if (rawResponse && Array.isArray(rawResponse.items)) {
            credentialsArrayFromAPI = rawResponse.items;
            console.log("Successfully extracted items array from API response.");
        } else {
            console.warn("API returned an unexpected response format for credentials (missing or invalid 'items' array):", rawResponse);
            credentialsArrayFromAPI = [];
        }

        updateCurrentCredentials(credentialsArrayFromAPI.map(rawVc => new VerifiableCredential(rawVc)));
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

/**
 * Renders the list of credentials in the UI using radio buttons for selection.
 * @param {Array<VerifiableCredential>} credentials - An array of VerifiableCredential instances to display.
 */
export function renderCredentials(credentials) {
    const credentialList = getElement('credential-list');
    if (!credentialList) return;

    credentialList.innerHTML = '';
    const storeCredentialBtn = getElement('store-credential-btn');
    const revocationStatusDisplay = getElement('revocation-status-display');
    const veramoStatusDiv = getElement('veramo-status');

    updateSelectedCredential(null); // Reset selection
    if (storeCredentialBtn) {
        storeCredentialBtn.disabled = true;
        storeCredentialBtn.className = "bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
    }
    if (revocationStatusDisplay) revocationStatusDisplay.textContent = '';
    if (veramoStatusDiv) veramoStatusDiv.textContent = '';

    if (credentials && credentials.length > 0) {
        credentials.forEach(credential => {
            const listItem = document.createElement('li');
            listItem.className = "flex items-center py-2 border-b border-gray-200 hover:bg-gray-100";

            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = 'selectedCredentialRadio';
            radioInput.id = `credential-${credential.claimID || credential.id}`;
            radioInput.className = 'form-radio h-4 w-4 text-blue-600 mr-2 cursor-pointer';

            const label = document.createElement('label');
            label.htmlFor = radioInput.id;
            label.className = 'flex-grow cursor-pointer block';
            label.innerHTML = `
                <div class="font-semibold text-gray-800">ID: ${credential.claimID || credential.id}</div>
                <div class="text-sm text-gray-600">Type: ${Array.isArray(credential.type) ? credential.type.join(', ') : credential.type}</div>
                <div class="text-sm text-gray-600">Subject: ${credential.credentialSubject?.id || 'N/A'}</div>
                <div class="text-xs text-gray-500">Issued: ${new Date(credential.issuanceDate).toLocaleDateString()}</div>
                ${credential.expirationDate ? `<div class="text-xs text-red-500">Expires: ${new Date(credential.expirationDate).toLocaleDateString()}</div>` : ''}
                ${credential.revoked ? `<div class="text-xs text-red-700 font-bold">Status: REVOKED</div>` : ''}
            `;
            label.dataset.credentialId = credential.claimID || credential.id;

            radioInput.addEventListener('change', (event) => {
                if (event.target.checked) {
                    updateSelectedCredential(currentCredentials.find(vc => (vc.claimID || vc.id) === event.target.id.replace('credential-', '')));
                    if (selectedCredential) {
                        console.log("Selected Credential:", selectedCredential);
                        if (storeCredentialBtn) {
                            storeCredentialBtn.disabled = false;
                            storeCredentialBtn.className = "bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
                        }
                    } else {
                        updateSelectedCredential(null);
                        if (storeCredentialBtn) {
                            storeCredentialBtn.disabled = true;
                            storeCredentialBtn.className = "bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
                        }
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
        if (storeCredentialBtn) {
            storeCredentialBtn.disabled = true;
            storeCredentialBtn.className = "bg-gray-300 text-gray-500 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
        }
        updateSelectedCredential(null);
    }
}

/**
 * Populates the credential selection dropdown for revoking credentials.
 * @param {Array<object>} credentials - An array of credential objects.
 */
export function populateCredentialSelectRevoke(credentials) {
    const credentialSelectRevokeElement = getElement('credential-select-revoke');
    if (!credentialSelectRevokeElement) return;

    credentialSelectRevokeElement.innerHTML = '';
    if (credentials && credentials.length > 0) {
        credentials.forEach(credential => {
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
 * Sets up event listeners for the Credential Management page (credentials.html).
 */
export function setupCredentialManagerEventListeners() {
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
    const identitySelectElement = getElement('identity-select'); // Also on this page for loading VCs

    if (loadCredentialsBtn) {
        loadCredentialsBtn.addEventListener('click', () => {
            const selectedIdentifier = identitySelectElement ? identitySelectElement.value : null;
            if (selectedIdentifier) { loadCredentials(selectedIdentifier); updateSelectedIdentityForCredentials(selectedIdentifier); }
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
            // Assuming identitySelectRevokeElement is populated elsewhere on page load or by IdentityManager.
            // You might need to add a call here to populateIdentitySelectRevoke(currentIdentities) if it's not done already.
        });
    }
    if (closeRevokeCredentialModalBtn) {
        closeRevokeCredentialModalBtn.addEventListener('click', () => { if (revokeCredentialModal) revokeCredentialModal.style.display = 'none'; });
    }
    if (cancelRevokeCredentialBtn) {
        cancelRevokeCredentialBtn.addEventListener('click', () => { if (revokeCredentialModal) revokeCredentialModal.style.display = 'none'; });
    }

    const identitySelectRevokeElement = getElement('identity-select-revoke'); // Get here for local use
    const credentialSelectRevokeElement = getElement('credential-select-revoke'); // Get here for local use

    if (identitySelectRevokeElement) {
        identitySelectRevokeElement.addEventListener('change', () => {
            const selectedIssuerDid = identitySelectRevokeElement.value;
            if (selectedIssuerDid) { loadCredentials(selectedIssuerDid); }
            else { if (credentialSelectRevokeElement) { credentialSelectRevokeElement.innerHTML = ''; credentialSelectRevokeElement.disabled = true; } }
        });
    }
     if (confirmRevokeCredentialBtn) {
         confirmRevokeCredentialBtn.addEventListener('click', async () => {
             const credentialIdInModal = credentialSelectRevokeElement ? credentialSelectRevokeElement.value : null;
             const issuerIdentifier = selectedIdentityForCredentials;

             const selectedVcToRevoke = currentCredentials.find(vc =>
                 (vc.claimID || vc.id) === credentialIdInModal
             );

             if (!selectedVcToRevoke) {
                 alert('No credential selected or found for revocation in the current list.');
                 return;
             }
             if (!issuerIdentifier) {
                 alert('Issuer identity not selected. Please load credentials by selecting an identity first.');
                 return;
             }

             const revocationNonce = selectedVcToRevoke.revocationNonce;

             if (revocationNonce === undefined || revocationNonce === null) {
                 alert('Selected credential does not have a valid revocation nonce. Cannot revoke.');
                 console.error('Revocation failed: revocationNonce is undefined or null for credential:', selectedVcToRevoke);
                 return;
             }

             try {
                 const revokeUrl = `${privadoBaseUrl}/identities/${encodeURIComponent(issuerIdentifier)}/credentials/revoke/${encodeURIComponent(revocationNonce)}`;
                 await fetchData(revokeUrl, 'POST', { 'Authorization': authorizationHeader, 'accept': 'application/json' });

                 console.log("Credential Revoked Successfully:", selectedVcToRevoke.claimID || selectedVcToRevoke.id, "with nonce:", revocationNonce);
                 if (revokeCredentialModal) revokeCredentialModal.style.display = 'none';
                 await loadCredentials(issuerIdentifier);
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