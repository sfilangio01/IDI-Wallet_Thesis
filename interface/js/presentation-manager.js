// js/present-credential.js

import { getElement, fetchData } from './utils.js';
import { veramoBaseUrl, veramoAuthToken } from './config.js';

let loadedCredentials = [];

/**
 * Loads credentials from the Veramo agent.
 * Veramo's `dataStoreORMGetVerifiableCredentials` returns all stored VCs.
 * @returns {Promise<Array<object>>} An array of Verifiable Credentials.
 */
async function loadVeramoCredentials() {
    try {
        const credentials = await fetchData(
            `${veramoBaseUrl}/dataStoreORMGetVerifiableCredentials`,
            'POST',
            { 'Authorization': veramoAuthToken },
            {} // Empty body to find all
        );
        console.log('Loaded credentials from Veramo:', credentials);
        // The endpoint returns objects with a 'vc' property that holds the actual credential
        return credentials.map(vc => ({ ...vc, source: 'veramo' }));
    } catch (error) {
        console.error('Error loading Veramo credentials:', error);
        return [];
    }
}

/**
 * Renders the fetched credentials as interactive cards in the UI.
 * @param {Array<object>} credentials - An array of credential objects.
 */
function renderCredentials(credentials) {
    const container = getElement('credentials-container');
    const noCredentialsMessage = getElement('no-credentials-message');
    const generateBtn = getElement('generate-presentation-btn');
    container.innerHTML = '';

    if (credentials.length === 0) {
        noCredentialsMessage.style.display = 'block';
        generateBtn.style.display = 'none';
        return;
    }

    noCredentialsMessage.style.display = 'none';
    generateBtn.style.display = 'block';

    credentials.forEach((credential, index) => {
        const card = document.createElement('div');
        card.className = 'credential-card';
        card.innerHTML = `
            <div class="flex items-center mb-2">
                <input type="checkbox" id="vc-checkbox-${index}" data-index="${index}" class="vc-checkbox mr-2 h-5 w-5 text-blue-600">
                <label for="vc-checkbox-${index}" class="text-lg font-semibold cursor-pointer">
                    ${credential.credentialSubject?.name || credential.vc.credentialSubject?.id || `Credential #${index + 1}`}
                </label>
            </div>
            <div class="vc-details pl-7 mt-2 space-y-2 text-gray-700">
                </div>
        `;
        container.appendChild(card);

        const detailsDiv = card.querySelector('.vc-details');
        const subject = credential.credentialSubject || credential.vc.credentialSubject;

        if (subject) {
            // Create a checkbox for each claim to allow selective disclosure
            for (const key in subject) {
                if (key !== 'id') {
                    const claimId = `claim-${index}-${key}`;
                    const claimDiv = document.createElement('div');
                    claimDiv.className = 'flex items-center';
                    claimDiv.innerHTML = `
                        <input type="checkbox" id="${claimId}" name="${key}" data-index="${index}" class="claim-checkbox mr-2 h-4 w-4 text-green-600" checked>
                        <label for="${claimId}" class="flex-grow">
                            <span class="font-medium">${key}:</span> ${subject[key]}
                        </label>
                    `;
                    detailsDiv.appendChild(claimDiv);
                }
            }
        }
    });
}

/**
 * Generates an OID4VP request and displays it as a QR code.
 * @param {object} presentationDefinition - The presentation definition payload.
 * @param {string} source - The source of the credentials ('veramo' or 'walt-id').
 */
async function generatePresentation(presentationDefinition, source) {
    try {
        let offerResponse;
        let deeplink;

        if (source === 'veramo') {
            const payload = {
                presentationDefinition: presentationDefinition
            };
            offerResponse = await fetchData(
                `${veramoBaseUrl}/getVerifiablePresentationRequest`,
                'POST',
                { 'Authorization': veramoAuthToken },
                payload
            );
            deeplink = offerResponse.requestUrl;
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
        } else {
            console.error('Unsupported credential source:', source);
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

    // Clear previous QR
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

/**
 * Sets up event listeners for the Present Credential page.
 */
export function setupPresentationEventListeners() {
    const loadBtn = getElement('load-credentials-btn');
    const generateBtn = getElement('generate-presentation-btn');
    const presentationModal = getElement('presentation-modal');
    const closePresentationModalBtn = getElement('close-presentation-modal');
    const closeQrModalBtn = getElement('close-qr-modal');

    if (loadBtn) {
        loadBtn.addEventListener('click', async () => {
            loadedCredentials = await loadVeramoCredentials();
            renderCredentials(loadedCredentials);
        });
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', async () => {
            const selectedCredentials = Array.from(document.querySelectorAll('.vc-checkbox:checked'))
                .map(checkbox => loadedCredentials[checkbox.dataset.index]);

            if (selectedCredentials.length === 0) {
                alert('Please select at least one credential to present.');
                return;
            }

            const presentationDefinition = {
                id: "vp_request",
                input_descriptors: []
            };

            selectedCredentials.forEach((vc, vcIndex) => {
                const credentialType = vc.vc.type[1];
                const claims = Array.from(document.querySelectorAll(`.claim-checkbox[data-index="${vcIndex}"]:checked`))
                    .map(checkbox => checkbox.name);

                const constraints = {
                    fields: claims.map(claim => ({
                        path: [`$.vc.credentialSubject.${claim}`]
                    }))
                };

                presentationDefinition.input_descriptors.push({
                    id: `credential-descriptor-${vcIndex}`,
                    name: `Request for a ${credentialType} Credential`,
                    purpose: `To prove that you have a ${credentialType} credential.`,
                    format: {
                        jwt_vc: { alg: ["ES256K"] }
                    },
                    constraints: constraints
                });
            });

            console.log('Generated Presentation Definition:', JSON.stringify(presentationDefinition, null, 2));

            const source = selectedCredentials[0].source;
            await generatePresentation(presentationDefinition, source);
        });
    }

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
}