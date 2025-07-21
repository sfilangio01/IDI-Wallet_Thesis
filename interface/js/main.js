// js/main.js

import { getElement } from './utils.js';
import { loadIdentities, setupIdentityEventListeners } from './identity-manager.js';
import { setupCredentialIssuerEventListeners } from './credential-issuer.js';
import { setupCredentialManagerEventListeners } from './credential-manager.js';
import { setupPresentationEventListeners } from './presentation-manager.js';
import { setupDidResolverEventListeners } from './did-resolver.js';
import { setupCredentialSelectorEventListeners } from './credential-selector.js';
import { handleLogout } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log("main.js: DOM Content Loaded.");

    // --- Common Elements (may appear on multiple pages or linked from others) ---
    const newIdentityModal = getElement('new-identity-modal');
    const deleteIdentityModal = getElement('delete-identity-modal');
    const revokeCredentialModal = getElement('revoke-credential-modal');
    const issuanceDetailsModal = getElement('issuance-details-modal');
    const qrCodeModal = getElement('qr-code-modal');
    const presentationQrModal = getElement('presentation-qr-modal');


    // --- Setup Page-Specific Event Listeners ---
    // A broad check, assuming a body element exists on all app pages
    if (document.querySelector('body')) {
        // Initialize Identity Manager if elements are present (e.g., on identities.html)
        if (getElement('identity-list') || getElement('create-identity-btn') || getElement('identity-select-delete')) {
            console.log("main.js: Setting up Identity Event Listeners.");
            setupIdentityEventListeners();
        }

        // Initialize Credential Selector (for grid of cards on issue-credential.html)
        if (getElement('credential-cards-grid')) {
            console.log("main.js: Setting up Credential Selector Event Listeners.");
            setupCredentialSelectorEventListeners();
        }

        // Initialize Credential Issuer (for processing issuance requests from the modal on issue-credential.html)
        if (getElement('start-issuance-process-btn') || getElement('process-issuance-btn')) {
            console.log("main.js: Setting up Credential Issuer Event Listeners.");
            setupCredentialIssuerEventListeners();
        }

        // Initialize Credential Manager if elements are present (e.g., on credentials.html)
        if (getElement('load-credentials-btn') || getElement('revoke-credential-btn')) {
            console.log("main.js: Setting up Credential Manager Event Listeners.");
            setupCredentialManagerEventListeners();
        }

        // Initialize Presentation Manager if elements are present (e.g., on present-credential.html)
        if (getElement('generate-presentation-qr-btn')) {
            console.log("main.js: Setting up Presentation Event Listeners.");
            setupPresentationEventListeners();
        }

        // Initialize DID Resolver if elements are present (e.g., on resolve-did.html)
        if (getElement('resolve-btn') && getElement('did-input') && getElement('did-result')) {
            console.log("main.js: Setting up DID Resolver Event Listeners.");
            setupDidResolverEventListeners();
        }
    }

    // --- Global Window Click Listener to Close Modals ---
    window.addEventListener('click', (event) => {
        if (newIdentityModal && event.target === newIdentityModal) {
            newIdentityModal.style.display = 'none';
        }
        if (issuanceDetailsModal && event.target === issuanceDetailsModal) {
            issuanceDetailsModal.style.display = 'none';
        }
        if (deleteIdentityModal && event.target === deleteIdentityModal) {
            deleteIdentityModal.style.display = 'none';
        }
        if (revokeCredentialModal && event.target === revokeCredentialModal) {
            revokeCredentialModal.style.display = 'none';
        }
        // QR Code modal for issuance is explicitly closed by its own button now, not by outside click
        // if (qrCodeModal && event.target === qrCodeModal) {
        //     qrCodeModal.style.display = 'none';
        // }
        if (presentationQrModal && event.target === presentationQrModal) {
            presentationQrModal.style.display = 'none';
        }
    });

    // --- Initial page load actions (global) ---
    // This loads identities for dropdowns on various pages (Issue, Manage, etc.)
    console.log("main.js: Calling loadIdentities.");
    loadIdentities();

    // --- Logout Functionality ---
    const logoutBtn = getElement('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});