// js/identity-manager.js

import { getElement, fetchData, resetForm } from './utils.js';
import { privadoBaseUrl, authorizationHeader, currentIdentities, updateCurrentIdentities } from './config.js';

// Centralized configuration for DID methods, blockchains, and networks
// This structure maps DID Methods -> Blockchains -> Networks with their details.
const appBlockchainConfig = {
    "polygonid": { // DID method 'polygonid'
        blockchains: {
            "polygon": {
                networks: {
                    "amoy": { // Testnet
                        label: "Amoy (Polygon Testnet)",
                        contractAddress: "0x1a4cC30f2aA0377b0c3bc9848766D90cb4404124",
                        networkURL: "https://polygon-amoy.g.alchemy.com/v2/Vn13i_64sI7cB_OEe0Kwc8hgwoUq7nKN",
                        chainID: 80002
                        // ... include other YAML fields like defaultGasLimit, etc. if needed in frontend
                    },
                    "zkevm": { // Mainnet for zkEVM
                        label: "zkEVM (Polygon Mainnet)",
                        contractAddress: "0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896",
                        networkURL: "https://zkevm-rpc.com", // Switch to dedicated rpc url as this public one might be rate limited
                        chainID: 1101
                    },
                    "cardona": { // Testnet for zkEVM
                        label: "Cardona (Polygon Testnet)",
                        contractAddress: "0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896",
                        networkURL: "https://etherscan.cardona.zkevm-rpc.com", // Adjust to RPC URL if different from explorer
                        chainID: 2442
                    }
                },
                defaultNetwork: "amoy" // Default for Polygon
            }
        }
    },
    "iden3": { // DID method 'iden3' (assuming this for Ethereum/Privado based on past context)
        blockchains: {
            "ethereum": {
                networks: {
                    "main": { // Mainnet
                        label: "Main (Ethereum Mainnet)",
                        contractAddress: "0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896",
                        networkURL: "https://mainnet.infura.io/v3/be767d3df1be471aaa5dfe3f7aa110fc",
                        chainID: 1
                    },
                    "sepolia": { // Explicitly adding Sepolia as a common testnet if you want it
                        label: "Sepolia (Ethereum Testnet)",
                        contractAddress: "0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896",
                        networkURL: "https://sepolia.infura.io/v3/be767d3df1be471aaa5dfe3f7aa110fc",
                        chainID: 11155111
                    }
                },
                defaultNetwork: "main" // Default for Ethereum
            },
            "privado": { // Assuming 'iden3' is the method for Privado
                networks: {
                    "main": { // Mainnet for Privado
                        label: "Main (Privado Mainnet)",
                        contractAddress: "0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896",
                        networkURL: "https://rpc-mainnet.privado.id",
                        chainID: 21000
                    }
                },
                defaultNetwork: "main" // Default for Privado
            }
        }
    }
    // Add other DID methods here if needed, following the same structure
};

// Allowed Identity Types as per schema
const allowedIdentityTypes = ["BJJ", "ETH"];

/**
 * Populates a select element with options from an array or object keys.
 * Includes a placeholder and handles default selection.
 * @param {HTMLElement} selectElement - The select element to populate.
 * @param {Array|Object} optionsData - Data to create options. If object, uses keys as values and 'label' property or capitalized key as text.
 * @param {string} [defaultValue] - The value to set as selected by default.
 * @param {string} [placeholderText="Select..."] - Text for the initial disabled placeholder option.
 */
function populateSelect(selectElement, optionsData, defaultValue = null, placeholderText = "Select...") {
    if (!selectElement) return;

    selectElement.innerHTML = ''; // Clear existing options

    const placeholderOption = document.createElement('option');
    placeholderOption.value = "";
    placeholderOption.textContent = placeholderText;
    placeholderOption.disabled = true;
    placeholderOption.selected = true; // Make it selected by default
    selectElement.appendChild(placeholderOption);

    const keys = Array.isArray(optionsData) ? optionsData : Object.keys(optionsData);

    keys.forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        // Use 'label' property if available, otherwise capitalize the key
        option.textContent = optionsData[key] && optionsData[key].label ? optionsData[key].label : key.charAt(0).toUpperCase() + key.slice(1);
        selectElement.appendChild(option);
    });

    // Attempt to set the default value
    if (defaultValue && keys.includes(defaultValue)) {
        selectElement.value = defaultValue;
        placeholderOption.selected = false; // Unselect placeholder if default is set
    } else if (keys.length > 0) {
        // If no specific default, but options exist, select the first actual option
        selectElement.value = keys[0];
        placeholderOption.selected = false;
    } else {
        // If no options, ensure placeholder remains selected
        placeholderOption.selected = true;
    }
}

/**
 * Populates the DID Method dropdown.
 */
function populateDidMethodSelect() {
    const didMethodSelect = getElement('didMethod');
    populateSelect(didMethodSelect, appBlockchainConfig, "polygonid", "Select DID Method"); // Default to 'polygonid'
}

/**
 * Populates the Blockchain dropdown based on the selected DID method.
 * @param {string} selectedDidMethod - The currently selected DID method.
 */
function populateBlockchainSelect(selectedDidMethod) {
    const blockchainSelect = getElement('blockchain');
    const didMethodEntry = appBlockchainConfig[selectedDidMethod];
    const blockchainsForMethod = didMethodEntry ? didMethodEntry.blockchains : {};
    
    // Determine default blockchain for the selected DID method
    let defaultBlockchain = null;
    if (selectedDidMethod === "polygonid" && blockchainsForMethod["polygon"]) {
        defaultBlockchain = "polygon";
    } else if (selectedDidMethod === "iden3" && blockchainsForMethod["ethereum"]) {
        defaultBlockchain = "ethereum";
    } else if (Object.keys(blockchainsForMethod).length > 0) {
        defaultBlockchain = Object.keys(blockchainsForMethod)[0];
    }

    populateSelect(blockchainSelect, blockchainsForMethod, defaultBlockchain, "Select Blockchain");
}

/**
 * Populates the Network dropdown based on the selected Blockchain and DID Method.
 * @param {string} selectedDidMethod - The currently selected DID method.
 * @param {string} selectedBlockchain - The currently selected blockchain.
 */
function populateNetworkSelect(selectedDidMethod, selectedBlockchain) {
    const networkSelect = getElement('network');
    const blockchainEntry = appBlockchainConfig[selectedDidMethod]?.blockchains[selectedBlockchain];
    const networksForBlockchain = blockchainEntry ? blockchainEntry.networks : {};
    const defaultNetwork = blockchainEntry ? blockchainEntry.defaultNetwork : null;
    
    populateSelect(networkSelect, networksForBlockchain, defaultNetwork, "Select Network");
}

/**
 * Populates the Identity Type dropdown.
 */
function populateIdentityTypeSelect() {
    const identityTypeSelect = getElement('identityType');
    populateSelect(identityTypeSelect, allowedIdentityTypes, "BJJ", "Select Identity Type"); // Default to 'BJJ'
}


/**
 * Loads existing identities from the Privado ID service and updates the UI.
 * Populates identity lists and dropdowns on relevant pages.
 */
export async function loadIdentities() {
    console.log("identity-manager.js: loadIdentities called.");
    try {
        const identities = await fetchData(`${privadoBaseUrl}/identities`, 'GET', { 'Authorization': authorizationHeader, 'accept': 'application/json' });
        console.log("identity-manager.js: Identities fetched successfully:", identities);

        updateCurrentIdentities(identities); // Update global state

        const identityList = getElement('identity-list');
        if (identityList) renderIdentities(identities);

        const identitySelectElement = getElement('identity-select');
        if (identitySelectElement) {
            console.log("identity-manager.js: Found #identity-select. Attempting to populate.");
            populateIdentitySelect(identities);
        } else {
            console.log("identity-manager.js: #identity-select not found on this page.");
        }

        const identitySelectDeleteElement = getElement('identity-select-delete');
        if (identitySelectDeleteElement) populateIdentitySelectDelete(identities);

        const identitySelectRevokeElement = getElement('identity-select-revoke');
        if (identitySelectRevokeElement) populateIdentitySelectRevoke(identities);

    } catch (error) {
        console.error("identity-manager.js: Error loading identities:", error);
        const identityList = getElement('identity-list');
        if (identityList) {
            identityList.innerHTML = `<li class="text-error">Error loading identities: ${error.message}</li>`;
        }
        alert(`Error loading identities: ${error.message}`);
    }
}

/**
 * Renders the list of identities in the UI.
 * @param {Array<object>} identities - An array of identity objects to display.
*/
export function renderIdentities(identities) {
    const identityList = getElement('identity-list');
    if (!identityList) return;

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
export function populateIdentitySelect(identities) {
    const identitySelectElement = getElement('identity-select');
    if (!identitySelectElement) {
        console.warn("identity-manager.js: populateIdentitySelect called, but #identity-select element not found.");
        return;
    }
    console.log("identity-manager.js: Populating #identity-select with identities:", identities);

    identitySelectElement.innerHTML = ''; // Clear existing options
    if (identities && identities.length > 0) {
        identities.forEach(identity => {
            const option = document.createElement('option');
            option.value = identity.identifier;
            option.textContent = `${identity.displayName} (${identity.identifier})`;
            identitySelectElement.appendChild(option);
        });
        identitySelectElement.disabled = false;
        console.log("identity-manager.js: #identity-select populated and enabled.");
    } else {
        const option = document.createElement('option');
        option.textContent = 'No identities available';
        identitySelectElement.appendChild(option);
        identitySelectElement.disabled = true;
        console.warn("identity-manager.js: No identities received to populate #identity-select. Element disabled.");
    }
}

/**
 * Populates the identity selection dropdown for deleting identities.
 * @param {Array<object>} identities - An array of identity objects.
 */
export function populateIdentitySelectDelete(identities) {
    const identitySelectDeleteElement = getElement('identity-select-delete');
    if (!identitySelectDeleteElement) return;

    identitySelectDeleteElement.innerHTML = '';
    if (identities && identities.length > 0) {
        identities.forEach(identity => {
            const option = document.createElement('option');
            option.value = identity.identifier;
            option.textContent = `${identity.displayName} (${identity.identifier})`;
            identitySelectDeleteElement.appendChild(option);
        });
        identitySelectDeleteElement.disabled = false;
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
export function populateIdentitySelectRevoke(identities) {
    const identitySelectRevokeElement = getElement('identity-select-revoke');
    if (!identitySelectRevokeElement) return;

    identitySelectRevokeElement.innerHTML = '';
    if (identities && identities.length > 0) {
        identities.forEach(identity => {
            const option = document.createElement('option');
            option.value = identity.identifier;
            option.textContent = `${identity.displayName} (${identity.identifier})`;
            identitySelectRevokeElement.appendChild(option);
        });
        identitySelectRevokeElement.disabled = false;
    } else {
        const option = document.createElement('option');
        option.textContent = 'No identities available';
        identitySelectRevokeElement.appendChild(option);
        option.disabled = true;
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

    const didMethodError = getElement('didMethod-error');
    if (didMethodError) didMethodError.style.display = (!didMethod || didMethod === "") ? 'block' : 'none';
    const blockchainError = getElement('blockchain-error');
    if (blockchainError) blockchainError.style.display = (!blockchain || blockchain === "") ? 'block' : 'none';
    const networkError = getElement('network-error');
    if (networkError) networkError.style.display = (!network || network === "") ? 'block' : 'none';
    const identityTypeError = getElement('identityType-error');
    if (identityTypeError) identityTypeError.style.display = (!identityType || identityType === "") ? 'block' : 'none';
    const displayNameError = getElement('displayName-error');
    if (displayNameError) displayNameError.style.display = !displayName ? 'block' : 'none';

    isValid = isValid && (!!didMethod && didMethod !== "");
    isValid = isValid && (!!blockchain && blockchain !== "");
    isValid = isValid && (!!network && network !== "");
    isValid = isValid && (!!identityType && identityType !== "");
    isValid = isValid && !!displayName;
    
    return isValid;
}

/**
 * Resets inputs for the 'Create New Identity' modal.
 */
export function resetIdentityForm() {
    // Populate DID Method, which will trigger cascading updates
    populateDidMethodSelect();
    const didMethodSelect = getElement('didMethod');
    const selectedDidMethod = didMethodSelect ? didMethodSelect.value : null;

    if (selectedDidMethod) {
        populateBlockchainSelect(selectedDidMethod);
        const blockchainSelect = getElement('blockchain');
        const selectedBlockchain = blockchainSelect ? blockchainSelect.value : null;

        if (selectedBlockchain) {
            populateNetworkSelect(selectedDidMethod, selectedBlockchain);
        } else {
            // If no blockchain is selected (e.g., initial state), clear network dropdown
            populateNetworkSelect(null, null);
        }
    } else {
        // If no DID Method is selected, clear blockchain and network dropdowns
        populateBlockchainSelect(null);
        populateNetworkSelect(null, null);
    }
    
    populateIdentityTypeSelect(); // Reset Identity Type dropdown

    const displayName = getElement('displayName');
    if (displayName) displayName.value = 'New Identity';
    
    resetForm('new-identity-modal'); // Call generic resetForm for error messages
}

/**
 * Sets up event listeners for the Identity Management page (identities.html).
 */
export function setupIdentityEventListeners() {
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

    const didMethodSelect = getElement('didMethod');
    const blockchainSelect = getElement('blockchain');
    const networkSelect = getElement('network');
    const identityTypeSelect = getElement('identityType'); // Get the identityType select

    // Initial population of all dropdowns when listeners are set up
    // This will set defaults and trigger cascading population
    resetIdentityForm(); // Use reset function to initialize all form fields correctly

    // Event listener for DID Method change (triggers blockchain and network population)
    if (didMethodSelect) {
        didMethodSelect.addEventListener('change', (event) => {
            const selectedDidMethod = event.target.value;
            populateBlockchainSelect(selectedDidMethod);
            // After changing DID method and blockchain, reset and re-populate network
            const currentBlockchainSelection = blockchainSelect ? blockchainSelect.value : null;
            populateNetworkSelect(selectedDidMethod, currentBlockchainSelection);
        });
    }

    // Event listener for Blockchain change (triggers network population)
    if (blockchainSelect) {
        blockchainSelect.addEventListener('change', (event) => {
            const selectedDidMethod = didMethodSelect ? didMethodSelect.value : null;
            const selectedBlockchain = event.target.value;
            populateNetworkSelect(selectedDidMethod, selectedBlockchain);
        });
    }

    if (createIdentityBtn) {
        createIdentityBtn.addEventListener('click', () => { 
            if (newIdentityModal) {
                newIdentityModal.style.display = 'block'; 
                resetIdentityForm(); // Reset form values and dropdowns
            }
        });
    }
    if (closeIdentityModalBtn) {
        closeIdentityModalBtn.addEventListener('click', () => { if (newIdentityModal) newIdentityModal.style.display = 'none'; resetIdentityForm(); });
    }
    if (submitIdentityFormBtn) {
        submitIdentityFormBtn.addEventListener('click', async () => {
            if (!validateIdentityForm()) { 
                alert('Please fill in all required fields correctly.');
                return; 
            }
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
                resetIdentityForm();
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
}