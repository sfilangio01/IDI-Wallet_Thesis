// js/credential-selector.js

import { getElement } from './utils.js';
import { credentialTemplates } from './config.js'; // Ensure this import is correct and config.js is populated

let selectedCredentialKeys = new Set(); // Stores keys of currently selected templates

/**
 * Renders the grid of credential cards.
 * @param {string} searchTerm - Optional search term to filter credentials.
 */
export function renderCredentialCards(searchTerm = '') {
    console.log("credential-selector.js: renderCredentialCards called.");
    console.log("credential-selector.js: credentialTemplates content:", credentialTemplates);

    const gridContainer = getElement('credential-cards-grid');
    if (!gridContainer) {
        console.error("credential-selector.js: #credential-cards-grid not found! Cannot render cards.");
        return;
    }
    console.log("credential-selector.js: #credential-cards-grid found:", gridContainer);

    const noCredentialsMessage = getElement('no-credentials-found');
    const startIssuanceButton = getElement('start-issuance-process-btn');

    gridContainer.innerHTML = ''; // Clear existing cards

    // Filter templates based on search term
    const filteredTemplates = Object.entries(credentialTemplates).filter(([key, template]) => {
        const matches = template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        template.type.toLowerCase().includes(searchTerm.toLowerCase());
        // console.log(`Checking ${template.name}: matches=${matches}`); // Uncomment for very detailed filtering logs
        return matches;
    });

    console.log("credential-selector.js: Filtered templates count:", filteredTemplates.length);

    // Display message if no templates found after filtering
    if (filteredTemplates.length === 0) {
        noCredentialsMessage.classList.remove('hidden');
    } else {
        noCredentialsMessage.classList.add('hidden');
    }

    // Render each filtered template as a card
    filteredTemplates.forEach(([key, template]) => {
        console.log(`credential-selector.js: Attempting to create card for ${template.name}`);
        const isSelected = selectedCredentialKeys.has(key);
        const card = document.createElement('div');
        card.className = `credential-card ${isSelected ? 'selected' : ''}`; // Apply custom CSS classes
        card.dataset.credentialKey = key; // Store key for easy lookup

        card.innerHTML = `
            <div class="card-icon-wrapper">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" data-slot="icon" class="card-icon">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H8.25a3 3 0 0 1-3-3V8.25a3 3 0 0 1 3-3h7.5Z" />
                </svg>
            </div>
            <h3 class="card-title">${template.name}</h3>
            <p class="card-type">${template.type}</p>
        `;

        card.addEventListener('click', () => {
            toggleCredentialSelection(key);
            updateStartButtonState(); // Update button state on card click
        });
        gridContainer.appendChild(card); // Add the created card to the grid
    });
    updateStartButtonState(); // Update button state after all cards are rendered
}

/**
 * Toggles the selection state of a credential card.
 * @param {string} key - The key of the credential template.
 */
function toggleCredentialSelection(key) {
    const card = document.querySelector(`[data-credential-key="${key}"]`);
    if (!card) return; // Should not happen if called from card's event listener

    if (selectedCredentialKeys.has(key)) {
        selectedCredentialKeys.delete(key);
        card.classList.remove('selected'); // Remove the 'selected' class
    } else {
        selectedCredentialKeys.add(key);
        card.classList.add('selected'); // Add the 'selected' class
    }
    console.log("credential-selector.js: Current Selected Credential Keys:", Array.from(selectedCredentialKeys));
}

/**
 * Updates the state (enabled/disabled) of the "Start Issuance Process" button.
 */
export function updateStartButtonState() {
    const startIssuanceButton = getElement('start-issuance-process-btn');
    if (startIssuanceButton) {
        if (selectedCredentialKeys.size > 0) {
            startIssuanceButton.disabled = false;
            // Apply active button styles from your existing CSS
            startIssuanceButton.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
            startIssuanceButton.classList.add('bg-blue-500'); /* Using your defined bg-blue-500 */
        } else {
            startIssuanceButton.disabled = true;
            // Apply disabled button styles from your existing CSS
            startIssuanceButton.classList.add('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
            startIssuanceButton.classList.remove('bg-blue-500');
        }
    }
}

/**
 * Gets the array of selected credential template objects.
 * @returns {Array<object>} An array of selected credential template definitions.
 */
export function getSelectedCredentialTemplates() {
    return Array.from(selectedCredentialKeys).map(key => credentialTemplates[key]);
}

/**
 * Clears the selected credential keys.
 */
export function clearSelectedCredentialTemplates() {
    selectedCredentialKeys.clear();
    renderCredentialCards(); // Re-render to clear visual selection and update button state
}

/**
 * Sets up event listeners for the credential selection UI.
 */
export function setupCredentialSelectorEventListeners() {
    console.log("credential-selector.js: setupCredentialSelectorEventListeners called.");
    const searchInput = getElement('credential-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            renderCredentialCards(event.target.value);
        });
    }

    renderCredentialCards(); // Initial render of all cards on page load
}