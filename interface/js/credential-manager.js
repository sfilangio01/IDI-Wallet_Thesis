import { VerifiableCredential } from '../classes/verifiable-credential.js';
import { getElement, fetchData } from './utils.js';
import {
    privadoBaseUrl, authorizationHeader, veramoBaseUrl, veramoAuthToken,
    // Configuration variables for walt.id (must be defined in './config.js')
    waltidBaseUrlVerifier, waltidVerifierAuthToken,
    currentCredentials, selectedCredential, selectedIdentityForCredentials,
    updateCurrentCredentials, updateSelectedCredential, updateSelectedIdentityForCredentials
} from './config.js';

// Import the function that loads DIDs from all sources and populates the dropdown
import { populateAllIssuers } from './credential-issuer.js'; // Assuming this path is correct

// Global state for the active presentation session
let currentPresentationSession = null; 

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
    // Note: This logic assumes that only Privado and Veramo credentials are being stored/managed locally 
    // and fetched via their respective API endpoints. walt.id is typically an issuer only,
    // and credentials it issues are generally stored in the holder's wallet, not the issuer's store.

    // Check if it's a Veramo DID (assuming Veramo manages did:key, did:ethr, or did:web locally)
    const isVeramoDid = issuerIdentifier.startsWith('did:key') || issuerIdentifier.startsWith('did:ethr') || issuerIdentifier.startsWith('did:web');
    // Check if it's a Privado ID DID (assuming Privado IDs often start with did:polygonid or similar non-Veramo prefixes)
    const isPrivadoDid = !isVeramoDid; // Simplistic check for demo purposes

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
                    const credentialData = item.verifiableCredential || item;
                    if (credentialData.encryptedData) {
                        try {
                            const decryptedString = await decryptWithKey(credentialData.encryptedData, KEY);
                            const decryptedVc = JSON.parse(decryptedString);
                            return new VerifiableCredential({ vc: decryptedVc, source: 'veramo' });
                        } catch (e) {
                            console.error("Decryption failed for a Veramo credential:", e);
                            return new VerifiableCredential({ vc: { ...credentialData, error: "Decryption Failed" }, source: 'veramo' });
                        }
                    }
                    return new VerifiableCredential({ vc: credentialData, source: 'veramo' });
                }));
                console.log("Credentials fetched from Veramo agent:", credentialsArray);
            }
        } else if (isPrivadoDid && issuerIdentifier.startsWith('did:')) { // Assuming Privado if not Veramo
            const rawResponse = await fetchData(
                `${privadoBaseUrl}/identities/${encodeURIComponent(issuerIdentifier)}/credentials`,
                'GET',
                { 'Authorization': authorizationHeader, 'accept': 'application/json' }
            );
            if (rawResponse && Array.isArray(rawResponse.items)) {
                credentialsArray = rawResponse.items.map(rawVc => new VerifiableCredential({ ...rawVc, source: 'privado' }));
                console.log("Credentials fetched from Privado ID:", credentialsArray);
            }
        }

        // **DEMO HACK: Injected a mock 'waltid' credential for presentation flow testing.**
        // This VC MUST contain the full, unflattened data structure to test the selective disclosure parser.
        if (credentialsArray.length === 0 || !credentialsArray.some(c => c.type.includes("VaccinationCertificate"))) {
            const tempVc = {
                id: "http://example.com/credentials/walt-123",
                "@context": ["https://www.w3.org/2018/credentials/v1"],
                type: ["VerifiableCredential", "VaccinationCertificate"],
                issuer: { id: "did:web:walt.id" },
                issuanceDate: new Date().toISOString(),
                credentialSubject: {
                    id: issuerIdentifier,
                    givenNames: "Jane",
                    familyName: "DOE",
                    dateOfBirth: 19930408,
                    uniqueCertificateIdentifier: "UVCI0904008084H",
                    // The problematic claims, now in the flat format shown in the log
                    "vaccinationProphylaxisInformation.0.dateOfVaccination": 20210212,
                    "vaccinationProphylaxisInformation.0.doseNumber": 1,
                    "vaccinationProphylaxisInformation.0.countryOfVaccination": "DE"
                },
                source: 'waltid' // Set source to waltid
            };
            credentialsArray.push(new VerifiableCredential(tempVc));
            console.warn("Injected a mock 'waltid' VaccinationCertificate credential for presentation demo purposes.");
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
        //alert(`Error loading credentials: ${error.message}`);
    }
}

// Helper function to safely extract the main VC type for display
function getVCTypeForDisplay(credential) {
    if (Array.isArray(credential.type) && credential.type.length > 1) {
        // Return the last element, which is typically the specific type (e.g., 'KYCAgeCredential')
        return credential.type[credential.type.length - 1];
    }
    // Return the single type or the full array if the logic above fails
    return Array.isArray(credential.type) ? credential.type.join(', ') : credential.type;
}

// Function to render the detailed claims of the selected credential with checkboxes for selective disclosure
export function renderCredentialClaims(credential) {
    const claimsContainer = getElement('credential-claims-container');
    if (!claimsContainer) return;

    claimsContainer.innerHTML = ''; // Clear previous claims

    if (credential && credential.credentialSubject) {
        const subject = credential.credentialSubject;
        
        // Use a <fieldset> for better accessibility and structure
        const fieldset = document.createElement('fieldset');
        fieldset.className = 'border p-4 rounded-md space-y-2';
        fieldset.innerHTML = '<legend class="text-lg font-bold text-gray-800">Select Claims to Disclose</legend>';

        // Add Credential Subject ID first (read-only, not for selection)
        if (subject.id) {
            const idDiv = document.createElement('div');
            idDiv.className = 'py-1 border-b text-sm font-semibold text-blue-700';
            idDiv.textContent = `Subject DID (Always Disclosed): ${subject.id}`;
            fieldset.appendChild(idDiv);
        }

        // Display the claims as checkable inputs
        for (const [key, value] of Object.entries(subject)) {
            // Skip the subject ID (already displayed)
            if (key === 'id') continue;
            
            // Skip the 'vc' key if present (a typical Veramo artifact)
            if (key === 'vc') continue; 

            // Handle nested objects/arrays: display only a preview
            let displayValue = (typeof value === 'object' && value !== null) 
                ? JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '')
                : String(value);

            const claimDiv = document.createElement('div');
            claimDiv.className = 'flex items-center';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.name = key; // Use the key (including dot-notation) as the claim identifier
            checkbox.id = `claim-checkbox-${key.replace(/[.:\[\]]/g, '_')}`; // Sanitize ID for HTML
            checkbox.className = 'claim-checkbox form-checkbox h-4 w-4 text-green-600 mr-2';
            
            const label = document.createElement('label');
            label.htmlFor = checkbox.id;
            label.className = 'text-sm text-gray-700 cursor-pointer flex-grow';
            label.innerHTML = `<span class="font-medium">${key}:</span> <span class="text-gray-600">${displayValue}</span>`;

            claimDiv.appendChild(checkbox);
            claimDiv.appendChild(label);
            fieldset.appendChild(claimDiv);
        }
        claimsContainer.appendChild(fieldset);

    } else {
        claimsContainer.innerHTML = '<p class="text-gray-500 text-sm">No detailed claims to display.</p>';
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
            console.log("Rendering credential:", JSON.stringify(credential, null, 2));

            // Determine the Credential ID using the existing, comprehensive logic
            const credentialId = credential.id || credential.claimID || (typeof credential.credentialSubject?.id === 'string' ? credential.credentialSubject.id : null);
            if (!credentialId) {
                console.warn('Skipping credential due to missing or invalid ID:', credential);
                return;
            }

            // Determine the VC Type for cleaner display
            const vcTypeDisplay = getVCTypeForDisplay(credential);

            const listItem = document.createElement('li');
            listItem.className = "flex items-center py-2 border-b border-gray-200 hover:bg-gray-100";
            
            const radioInput = document.createElement('input');
            radioInput.type = 'radio';
            radioInput.name = 'selectedCredentialRadio';
            // Use the determined credentialId for a unique ID
            radioInput.id = `credential-${credentialId.slice(-10)}`; 
            radioInput.className = 'form-radio h-4 w-4 text-blue-600 mr-2 cursor-pointer';
            
            const label = document.createElement('label');
            label.htmlFor = radioInput.id;
            label.className = 'flex-grow cursor-pointer block';
            
            // Truncate the ID for better UI readability
            const displayId = credentialId.length > 30 ? credentialId.substring(0, 15) + '...' + credentialId.slice(-15) : credentialId;
            const subjectId = typeof credential.credentialSubject?.id === 'string' ? (credential.credentialSubject.id.length > 30 ? credential.credentialSubject.id.substring(0, 15) + '...' + credential.credentialSubject.id.slice(-15) : credential.credentialSubject.id) : 'N/A';

            label.innerHTML = `
                <div class="font-semibold text-gray-800">ID: ${displayId}</div>
                <div class="text-sm text-gray-600">Type: <span class="font-medium text-indigo-600">${vcTypeDisplay}</span></div>
                <div class="text-sm text-gray-600">Source: <span class="font-bold text-blue-700">${credential.source || 'N/A'}</span></div>
                <div class="text-sm text-gray-600">Subject DID: ${subjectId}</div>
                <div class="text-xs text-gray-500">Issued: ${new Date(credential.issuanceDate).toLocaleDateString()}</div>
                ${credential.expirationDate ? `<div class="text-xs text-red-500">Expires: ${new Date(credential.expirationDate).toLocaleDateString()}</div>` : ''}
                ${credential.revoked ? `<div class="text-xs text-red-700 font-bold">Status: REVOKED</div>` : ''}
            `;
            
            // Attach the full credential object to the radio button for easy retrieval on selection
            radioInput.dataset.fullCredential = JSON.stringify(credential);

            radioInput.addEventListener('change', (event) => {
                if (event.target.checked) {
                    // Use the stringified object from the dataset to get the full selected VC
                    const selected = JSON.parse(event.target.dataset.fullCredential);
                    
                    updateSelectedCredential(selected);
                    alert('Credential selected: ' + (selected.id || selected.claimID || selected.credentialSubject?.id));

                    if (selected) {
                        console.log("Selected Credential:", selected);
                        if (presentCredentialBtn) presentCredentialBtn.disabled = false;
                        if (revokeCredentialBtn) revokeCredentialBtn.disabled = false;
                        if (storeCredentialBtn) {
                            storeCredentialBtn.disabled = false;
                            storeCredentialBtn.className = "bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline";
                        }
                        if (presentationDetailsSection) presentationDetailsSection.style.display = 'block';

                        // Render claims using the new function
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
                    
                    // Clear status displays
                    const revocationStatusDisplay = getElement('revocation-status-display');
                    const veramoStatusDiv = getElement('veramo-status');
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
 * SIMULATES THE WALLET: Creates a mock VP and POSTs it back to the Verifier.
 */
async function acceptAndPresentWaltidCredential() {
    const simulatePresentBtn = getElement('simulate-present-btn');
    if (simulatePresentBtn) simulatePresentBtn.disabled = true; // Disable while processing
    
    if (!currentPresentationSession || !selectedCredential) {
        alert('Presentation session not initialized or no credential selected.');
        if (simulatePresentBtn) simulatePresentBtn.disabled = false;
        return;
    }

    const { state, responseUri } = currentPresentationSession;
    const credentialType = Array.isArray(selectedCredential.type) ? selectedCredential.type[selectedCredential.type.length - 1] : selectedCredential.type;
    
    // 1. Mock the Verifiable Presentation (VP)
    // NOTE: This skips cryptographic signing and JWS/JWE construction, which a real wallet must do.
    const mockVpToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJub25lIn0.eyJ2cCI6eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvMjAxOC9jcmVkZW50aWFscy92MSJdLCJ0eXBlIjpbIlZlcmlmaWFibGVQcmVzZW50YXRpb24iXSwidmVyaWZpYWJsZUNyZWRlbnRpYWwiOlt" +
                        btoa(JSON.stringify(selectedCredential)) + 
                        "XX0sImlzcyI6ImRpZDprZXk6bW9jay1ob2xkZXItZGlkIiwiaWF0IjoxNjQ0NTY2NDAwLCJhdWQiOiJzaW9wOlwvcF9tXzQifQ."; 
                        // Simplified base64 payload construction

    // 2. Build the Presentation Submission payload
    // NOTE: This assumes the presentation request only had one descriptor, which is common for simple flows.
    const submissionId = `sub_${Date.now()}`;
    const presentationSubmission = {
        id: submissionId,
        definition_id: "vp_request", // Must match the ID used when initiating the presentation
        descriptor_map: [{
            id: `credential-descriptor-1-${credentialType}`, // Use the full input descriptor ID
            format: 'jwt_vc_json', // Must match the requested format
            path: '$.vp.verifiableCredential[0]' // Standard path for the first VC in a VP array
        }]
    };

    // 3. POST the VP back to the Verifier's response_uri (x-www-form-urlencoded)
    const body = new URLSearchParams();
    body.append('vp_token', mockVpToken);
    body.append('presentation_submission', JSON.stringify(presentationSubmission));

    //alert(`Simulating presentation of ${credentialType} to the Verifier...`);
    
    try {
        const finalUrl = `${responseUri}`; 
        
        const response = await fetch(finalUrl, {
            method: 'POST',
            // OID4VP direct_post response mode REQUIRES this content type
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, 
            body: body
        });

        const responseText = await response.text();
        
        if (response.ok || response.status === 302) { 
            alert('✅ Presentation simulated and sent successfully! Check Verifier logs for verification status.');
            console.log('Verifier Response (Success/Redirect):', responseText);
        } else {
            console.error('Verifier response status:', response.status, responseText);
            alert(`❌ Presentation failed (HTTP ${response.status}). Check console for Verifier error.`);
        }
        
    } catch (error) {
        console.error('Error during simulated presentation:', error);
        alert('An unexpected error occurred during the simulated presentation.');
    } finally {
        // Hide simulation buttons and clear state
        if (simulatePresentBtn) {
            simulatePresentBtn.style.display = 'none';
            simulatePresentBtn.disabled = false;
        }
        currentPresentationSession = null;
    }
}


/**
 * Generates an OID4VP request and displays it as a QR code.
 * @param {object} presentationDefinition - The presentation definition payload (DIF format).
 * @param {string} source - The source of the credentials ('veramo', 'walt-id', or 'privado').
 */
async function generatePresentation(presentationDefinition, source) {
    try {
        let deeplink;
        let offerResponse;
        
        if (!selectedCredential) {
            alert('No credential selected for presentation.');
            return;
        }
        
        // --- WALT.ID VERIFIER PRESENTATION FLOW (FIXED) ---
        if (source === 'waltid') {

            // Build the payload aligned with the walt.id Verifier API examples for /openid4vc/verify
            const payload = {
                // The verifier expects the presentation definition to be nested under 'input_descriptor'
                request_credentials: presentationDefinition.input_descriptors.map(descriptor => {
                    const formatKey = Object.keys(descriptor.format)[0]; 
                    return {
                        format: formatKey,
                        type: getVCTypeForDisplay(selectedCredential), // Use the specific VC type
                        input_descriptor: descriptor
                    };
                }),
                vc_policies: ["signature", "expired", "not-before"] 
            };
            
            console.log("Sending Presentation Request to walt.id verifier:", JSON.stringify(payload, null, 2));

            // Use fetch directly to handle non-JSON text/plain response
            const url = `${waltidBaseUrlVerifier}/openid4vc/verify`;
            const headers = {
                // Assuming waltidVerifierAuthToken is the API Key or base URL component
                'authorizeBaseUrl': waltidVerifierAuthToken,
                'Content-Type': 'application/json',
                'accept': '*/*', // Tell the server we can accept plain text too
                'response-mode': 'direct_post' // Ensure we get a direct response
            };
            
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP Error ${response.status}: ${errorText}`);
            }

            // Extract the deep-link (expected to be text/plain)
            const contentType = response.headers.get("content-type");
            let deepLinkUrl;

            if (contentType && contentType.includes("text/plain")) {
                deepLinkUrl = await response.text();
            } else {
                // Fallback for unexpected JSON response structure
                offerResponse = await response.json();
                deepLinkUrl = offerResponse.url;
            }
            
            if (deepLinkUrl) {
                deeplink = deepLinkUrl;

                // 1. Parse the deep-link URL to get state and response_uri
                const params = new URLSearchParams(deeplink.split('?')[1]);
                const state = params.get('state');
                
                // The Verifier response link provides response_uri
                const responseUri = params.get('response_uri'); 

                if (state && responseUri) {
                    currentPresentationSession = { state, responseUri };
                    console.log("Presentation Session Started:", currentPresentationSession);
                    
                    // Show the 'Simulate Present' button now
                    const simPresentBtn = getElement('simulate-present-btn');
                    if (simPresentBtn) simPresentBtn.style.display = 'block';
                } else {
                    console.error("Could not parse state or response_uri from deeplink:", deeplink);
                }
            } else {
                 throw new Error("Verifier did not return a valid deep link URL.");
            }

        // --- END WALT.ID VERIFIER PRESENTATION FLOW ---
        
        } else if (source === 'veramo' || source === 'privado') { 
            // Keep existing logic for other sources (placeholders from previous iteration)
            const issuerDid = selectedCredential.issuer?.id || selectedIdentityForCredentials;

            if (source === 'veramo') {
                 // Placeholder for Veramo OID4VP Logic
                 const payload = {
                     data: {
                         issuer: issuerDid,
                         claims: presentationDefinition.input_descriptors.map(descriptor => ({
                             credentialType: descriptor.id.replace('credential-descriptor-1-', ''),
                             claimType: descriptor.constraints.fields[0].path[0].replace('$.vc.credentialSubject.', ''),
                         }))
                     }
                 };

                 // Assume fetchData still works correctly for these endpoints
                 offerResponse = await fetchData(
                     `${veramoBaseUrl}/createSelectiveDisclosureRequest`,
                     'POST',
                     { 'Authorization': veramoAuthToken },
                     payload
                 );
                 deeplink = offerResponse; 
            } else if (source === 'privado') {
                 // Placeholder for Privado OID4VP Logic
                 const payload = {
                     presentationDefinition: presentationDefinition
                    };
                 // Assume fetchData still works correctly for these endpoints
                 offerResponse = await fetchData(
                     `${privadoBaseUrl}/presentations/definitions`,
                     'POST',
                     { 'Authorization': authorizationHeader },
                     payload
                    );
                 const requestData = await fetchData(offerResponse.url, 'GET', { 'Authorization': authorizationHeader });
                 deeplink = requestData.body;
            }
        } 
        
        else {
            console.error('Unsupported credential source for presentation:', source);
            alert('Presentation is not supported for the selected credential source.');
            return;
        }

        if (deeplink) {
            displayQrCode(deeplink);
        } else {
            //alert('Failed to generate a presentation offer. Check the console for details.');
        }

    } catch (error) {
        console.error('Error generating presentation offer:', error);
        //alert('An error occurred while generating the presentation offer. Check the console for more details.');
    }
}


/**
 * Displays a QR code using QRious.
 */
function displayQrCode(data) {
    const qrCodeModal = getElement('presentation-modal');
    const qrCodeDisplay = getElement('qr-code-display');
    const deeplinkDisplay = getElement('deeplink-display');

    if (!qrCodeModal || !qrCodeDisplay || !deeplinkDisplay) {
        console.error("Missing QR code display elements.");
        return;
    }

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
            const vcTypeDisplay = getVCTypeForDisplay(credential);
            option.value = credential.claimID || credential.id;
            option.textContent = `ID: ${credential.claimID || credential.id}, Type: ${vcTypeDisplay}, Subject: ${credential.credentialSubject?.id || 'N/A'}`;
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

    // **NEW ELEMENT:** Added to HTML
    const simulatePresentBtn = getElement('simulate-present-btn'); 

    // --- ADDED: Load identities immediately when this component initializes ---
    if (identitySelectElement) {
        populateAllIssuers();
    }
    // --------------------------------------------------------------------------

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

    if (presentCredentialBtn) {
        presentCredentialBtn.addEventListener('click', () => {
            if (!selectedCredential) {
                alert('Please select a credential from the list first.');
                return;
            }
            // Trigger display of selective disclosure section
            const presentationDetailsSection = getElement('presentation-details-section');
            if (presentationDetailsSection) presentationDetailsSection.style.display = 'block';
        });
    }

    if (generatePresentationBtn) {
        generatePresentationBtn.addEventListener('click', async () => {
            // ... (credential and claims check) ...
            
            const credentialType = Array.isArray(selectedCredential.type) ? selectedCredential.type[selectedCredential.type.length - 1] : selectedCredential.type;

            const selectedClaims = [];
            const checkboxes = document.querySelectorAll('#credential-claims-container .claim-checkbox:checked');
            checkboxes.forEach(checkbox => {
                selectedClaims.push(checkbox.name);
            });

            if (selectedClaims.length === 0) {
                alert('Please select at least one claim to disclose.');
                return;
            }
            
            // FIX: Create a clean DIF Input Descriptor without redundant root keys.
            const inputDescriptor = {
                id: `credential-descriptor-1-${credentialType}`,
                name: `Request for a ${credentialType} Credential`,
                purpose: `To prove that you have a ${credentialType} credential, disclosing: ${selectedClaims.join(', ')}.`,
                
                // Add an explicit schema constraint for the VC type
                schema: [{ uri: `https://schema.org/${credentialType}` }], // Use a generic schema link or the actual one
                
                format: {
                    jwt_vc_json: { alg: ["ES256K"] } 
                },
                constraints: {
                    // FIX: Remove redundant constraints (like is_credential_subject and limit_disclosure) 
                    // unless explicitly needed. Focus only on the fields here.
                    fields: selectedClaims.map(claim => ({
                        path: [`$.vc.credentialSubject.${claim}`], 
                        filter: {
                            type: "string", 
                            pattern: ".*"
                        }
                    }))
                }
            };

            const presentationDefinition = {
                id: "vp_request",
                // Only include the clean descriptor here
                input_descriptors: [inputDescriptor]
            };

            console.log("Generated Presentation Definition (DIF):", JSON.stringify(presentationDefinition, null, 2));

            // Always use waltid source for the demo presentation flow as per the existing logic
            await generatePresentation(presentationDefinition, "waltid"); 
        });
    }

    // **NEW EVENT LISTENER**
    if (simulatePresentBtn) {
        simulatePresentBtn.addEventListener('click', acceptAndPresentWaltidCredential);
    }

    if (closePresentationModalBtn) {
        closePresentationModalBtn.addEventListener('click', () => {
            if (presentationModal) presentationModal.style.display = 'none';
            // Also reset simulation state when modal is closed manually
            currentPresentationSession = null;
            if (simulatePresentBtn) simulatePresentBtn.style.display = 'none';
        });
    }
    if (closeQrModalBtn) {
        closeQrModalBtn.addEventListener('click', () => {
            if (presentationModal) presentationModal.style.display = 'none';
            // Also reset simulation state when modal is closed manually
            currentPresentationSession = null;
            if (simulatePresentBtn) simulatePresentBtn.style.display = 'none';
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
                    //alert(`Error storing credential in Veramo: ${error.message}`);
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
                } else if (credentialSource === 'privado') {
                    const selectedVcToRevoke = currentCredentials.find(vc => (vc.claimID || vc.id) === credentialId);
                    const revocationNonce = selectedVcToRevoke?.revocationNonce;
                    if (revocationNonce === undefined || revocationNonce === null) {
                        throw new Error('Selected credential does not have a valid revocation nonce. Cannot revoke.');
                    }
                    const revokeUrl = `${privadoBaseUrl}/identities/${encodeURIComponent(issuerDid)}/credentials/revoke/${encodeURIComponent(revocationNonce)}`;
                    await fetchData(revokeUrl, 'POST', { 'Authorization': authorizationHeader, 'accept': 'application/json' });
                    alert('Privado ID Credential revoked successfully!');
                } else {
                    alert('Revocation/Deletion is not implemented for walt.id credentials in this demo.');
                    return;
                }

                if (revokeCredentialModal) revokeCredentialModal.style.display = 'none';
                await loadCredentials(issuerDid);
            } catch (error) {
                console.error("Error during credential operation:", error);
                //alert(`Error during credential operation: ${error.message}`);
            }
        });
    }
    if (checkRevocationStatusBtn) {
        checkRevocationStatusBtn.addEventListener('click', async () => {
            if (!selectedCredential) { alert('Please select a credential from the list first to check its revocation status.'); return; }
            if (!selectedIdentityForCredentials) { alert('Could not determine the issuer identity for the selected credential. Please load credentials by selecting an identity first.'); return; }

            const credentialSource = selectedCredential.source || 'privado';

            if (revocationStatusDisplay) {
                revocationStatusDisplay.textContent = 'Checking revocation status...';
                revocationStatusDisplay.className = 'mt-4 text-gray-700';
            }

            try {
                const credentialIdForRevocation = selectedCredential.claimID || selectedCredential.id;
                const issuerDid = selectedIdentityForCredentials;

                if (credentialSource !== 'privado') {
                    if (revocationStatusDisplay) {
                        revocationStatusDisplay.textContent = `${credentialSource} credentials' revocation status cannot be checked via a public API in this demo.`;
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