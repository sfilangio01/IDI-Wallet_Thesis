// js/presentation-manager.js

import { getElement, fetchData } from './utils.js';
import { privadoBaseUrl, authorizationHeader } from './config.js';

/**
 * Sets up event listeners for the Credential Presentation page (present-credential.html).
 */
export function setupPresentationEventListeners() {
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
            // This structure is HIGHLY dependent on the Privado ID (Polygon ID) Verifier API.
            // You MUST verify the exact payload with the Privado ID documentation.
            const presentationRequestPayload = {
                reason: 'Credential Presentation Demo',
                schema: {
                    url: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCAgeCredential-v3.json',
                    type: 'KYCAgeCredential'
                },
                // IMPORTANT: The callback URL is where the wallet sends the Verifiable Presentation.
                // This MUST be an endpoint on your *backend server* that is publicly accessible (e.g., via ngrok).
                // A client-side HTML/JS app cannot directly receive these inbound callbacks.
                callbackUrl: 'YOUR_VERIFIER_BACKEND_CALLBACK_URL', // **REPLACE THIS WITH YOUR ACTUAL BACKEND URL**
            };

            try {
                const qrCodeResponse = await fetchData(
                    `${privadoBaseUrl}/presentation/request-qr`,
                    'POST',
                    { 'Authorization': authorizationHeader, 'accept': 'application/json' },
                    presentationRequestPayload
                );

                let qrData = qrCodeResponse.qrCode || qrCodeResponse.url || qrCodeResponse;

                if (qrData) {
                    // Assuming you have a canvas for QRious on the presentation page as well
                    const canvas = getElement('qrcodeCanvasPresentation'); // Give your presentation QR canvas a unique ID
                    if (canvas) {
                        try {
                            new QRious({
                                element: canvas,
                                value: qrData,
                                size: 200,
                                level: 'H',
                                background: 'white',
                                foreground: 'black'
                            });
                            console.log('Presentation QR code generated on canvas using QRious!');
                            if (presentationQrDisplay) presentationQrDisplay.innerHTML = ''; // Clear loading message
                        } catch (drawError) {
                            console.error('Error generating QR code with QRious for presentation:', drawError);
                            if (presentationQrDisplay) {
                                presentationQrDisplay.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}" alt="Presentation QR Code" class="mx-auto block">`;
                            }
                        }
                    } else {
                        console.warn("Canvas element for presentation QR code not found. Using public QR API as fallback for display.");
                        if (presentationQrDisplay) {
                            presentationQrDisplay.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}" alt="Presentation QR Code" class="mx-auto block">`;
                        }
                    }
                    
                    if (presentationQrModalContent) presentationQrModalContent.textContent = JSON.stringify(qrData, null, 2);
                    if (presentationQrModal) presentationQrModal.style.display = 'block';
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
}