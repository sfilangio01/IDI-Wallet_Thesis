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
                    const credentialData = item.verifiableCredential;
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
    if (!credentialList) return;
    credentialList.innerHTML = '';
    const storeCredentialBtn = getElement('store-credential-btn');
    const revocationStatusDisplay = getElement('revocation-status-display');
    const veramoStatusDiv = getElement('veramo-status');
    updateSelectedCredential(null);
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
                        revocationStatusDisplay.className = `mt-4 text-orange-500`;
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
