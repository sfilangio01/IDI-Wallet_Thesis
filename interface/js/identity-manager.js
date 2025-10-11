// js/identity-manager.js

import { getElement, fetchData, resetForm } from './utils.js';
// Import Veramo-specific configuration
import { privadoBaseUrl, authorizationHeader, veramoBaseUrl, veramoAuthToken, currentIdentities, updateCurrentIdentities } from './config.js';

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

// Centralized configuration for DID methods, blockchains, and networks
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
                    },
                    "zkevm": { // Mainnet for zkEVM
                        label: "zkEVM (Polygon Mainnet)",
                        contractAddress: "0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896",
                        networkURL: "https://zkevm-rpc.com",
                        chainID: 1101
                    },
                    "cardona": { // Testnet for zkEVM
                        label: "Cardona (Polygon Testnet)",
                        contractAddress: "0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896",
                        networkURL: "https://etherscan.cardona.zkevm-rpc.com",
                        chainID: 2442
                    }
                },
                defaultNetwork: "amoy" // Default for Polygon
            }
        }
    },
    "iden3": {
        blockchains: {
            "privado": {
                networks: {
                    "main": { // Mainnet for Privado
                        label: "Main (Privado Mainnet)",
                        contractAddress: "0x3C9acB2205Aa72A05F6D77d708b5Cf85FCa3a896",
                        networkURL: "https://rpc-mainnet.privado.id",
                        chainID: 21000
                    }
                },
                defaultNetwork: "main"
            }
        }
    },
    "did:key": {
        blockchains: {
            "none": {
                networks: { "none": { label: "N/A" } },
                defaultNetwork: "none"
            }
        }
    },
    "did:ethr": {
        blockchains: {
            "ethereum": {
                networks: {
                    "goerli": { label: "Goerli (Testnet)" },
                    "mainnet": { label: "Mainnet" }
                },
                defaultNetwork: "goerli"
            }
        }
    },
    "did:web": {
        blockchains: {
            "none": {
                networks: { "none": { label: "N/A" } },
                defaultNetwork: "none"
            }
        }
    }
};

const allowedIdentityTypes = ["BJJ", "ETH"];

function populateSelect(selectElement, optionsData, defaultValue = null, placeholderText = "Select...") {
    if (!selectElement) return;
    selectElement.innerHTML = '';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = "";
    placeholderOption.textContent = placeholderText;
    placeholderOption.disabled = true;
    placeholderOption.selected = true;
    selectElement.appendChild(placeholderOption);
    const keys = Array.isArray(optionsData) ? optionsData : Object.keys(optionsData);
    keys.forEach(key => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = optionsData[key] && optionsData[key].label ? optionsData[key].label : key.charAt(0).toUpperCase() + key.slice(1);
        selectElement.appendChild(option);
    });
    if (defaultValue && keys.includes(defaultValue)) {
        selectElement.value = defaultValue;
        placeholderOption.selected = false;
    } else if (keys.length > 0) {
        selectElement.value = keys[0];
        placeholderOption.selected = false;
    } else {
        placeholderOption.selected = true;
    }
}

function populateDidMethodSelect() {
    const didMethodSelect = getElement('didMethod');
    populateSelect(didMethodSelect, appBlockchainConfig, "polygonid", "Select DID Method");
}

function populateBlockchainSelect(selectedDidMethod) {
    const blockchainSelect = getElement('blockchain');
    const didMethodEntry = appBlockchainConfig[selectedDidMethod];
    const blockchainsForMethod = didMethodEntry ? didMethodEntry.blockchains : {};
    let defaultBlockchain = null;
    if (didMethodEntry?.defaultBlockchain) {
      defaultBlockchain = didMethodEntry.defaultBlockchain;
    } else if (Object.keys(blockchainsForMethod).length > 0) {
      defaultBlockchain = Object.keys(blockchainsForMethod)[0];
    }
    populateSelect(blockchainSelect, blockchainsForMethod, defaultBlockchain, "Select Blockchain");
}

function populateNetworkSelect(selectedDidMethod, selectedBlockchain) {
    const networkSelect = getElement('network');
    const blockchainEntry = appBlockchainConfig[selectedDidMethod]?.blockchains[selectedBlockchain];
    const networksForBlockchain = blockchainEntry ? blockchainEntry.networks : {};
    const defaultNetwork = blockchainEntry ? blockchainEntry.defaultNetwork : null;
    populateSelect(networkSelect, networksForBlockchain, defaultNetwork, "Select Network");
}

function populateIdentityTypeSelect() {
    const identityTypeSelect = getElement('identityType');
    populateSelect(identityTypeSelect, allowedIdentityTypes, "BJJ", "Select Identity Type");
}

async function loadPrivadoIdentities() {
    try {
        const identities = await fetchData(`${privadoBaseUrl}/identities`, 'GET', { 'Authorization': authorizationHeader, 'accept': 'application/json' });
        return identities.map(identity => ({ ...identity, source: 'privado' }));
    } catch (error) {
        console.error("Error loading identities from Privado ID:", error);
        return [];
    }
}

async function loadVeramoDids() {
    try {
        const veramoDids = await fetchData(`${veramoBaseUrl}/didManagerFind`, 'POST', { 'Authorization': veramoAuthToken }, {});
        
        const decryptedDids = await Promise.all(veramoDids.map(async did => {
            if (did.alias) {
                try {
                    const decryptedAlias = await decryptWithKey(did.alias, KEY);
                    return { ...did, alias: decryptedAlias, source: 'veramo' };
                } catch (e) {
                    console.error("Decryption failed for a Veramo DID alias:", e);
                    //return { ...did, alias: `[Decryption Failed] ${did.alias}`, source: 'veramo' };
                    return { ...did, alias: `${did.alias}`, source: 'veramo' };
                
                }
            }
            return { ...did, source: 'veramo' };
        }));

        return decryptedDids;
    } catch (error) {
        console.error("Error loading DIDs from Veramo agent:", error);
        return [];
    }
}

export async function loadAllIdentities(updateDropdowns = true) {
    console.log("Loading all identities from Privado ID and Veramo...");
    try {
        const [privadoIdentities, veramoDids] = await Promise.all([
            loadPrivadoIdentities(),
            loadVeramoDids()
        ]);
        
        updateCurrentIdentities([...privadoIdentities, ...veramoDids]);
        renderIdentities(privadoIdentities, veramoDids);

        if (updateDropdowns) {
            const allIdentities = [...privadoIdentities, ...veramoDids];
            const identitySelectElement = getElement('identity-select');
            if (identitySelectElement) populateIdentitySelect(allIdentities);
            const identitySelectDeleteElement = getElement('identity-select-delete');
            if (identitySelectDeleteElement) populateIdentitySelectDelete(allIdentities);
            const identitySelectRevokeElement = getElement('identity-select-revoke');
            if (identitySelectRevokeElement) populateIdentitySelectRevoke(allIdentities);
        }
        alert('Identities loaded successfully!');
    } catch (error) {
        console.error("Error loading all identities:", error);
        alert(`Error loading all identities: ${error.message}`);
    }
}

export function renderIdentities(privadoIdentities, veramoDids) {
    const privadoList = getElement('privado-identity-list');
    const veramoList = getElement('veramo-identity-list');
    if (!privadoList || !veramoList) return;
    privadoList.innerHTML = '';
    if (privadoIdentities.length > 0) {
        privadoIdentities.forEach(identity => {
            const listItem = document.createElement('li');
            listItem.className = "py-2 border-b border-gray-200";
            listItem.textContent = `${identity.displayName} (${identity.identifier})`;
            privadoList.appendChild(listItem);
        });
    } else {
        privadoList.innerHTML = '<li class="text-gray-500">No Privado ID identities found.</li>';
    }
    veramoList.innerHTML = '';
    if (veramoDids.length > 0) {
        veramoDids.forEach(did => {
            const listItem = document.createElement('li');
            listItem.className = "py-2 border-b border-gray-200";
            const displayName = did.alias || did.did;
            listItem.textContent = `${displayName} (${did.did})`;
            veramoList.appendChild(listItem);
        });
    } else {
        veramoList.innerHTML = '<li class="text-gray-500">No Veramo identities found.</li>';
    }
}

export function populateIdentitySelect(allIdentities) {
    const identitySelectElement = getElement('identity-select');
    if (!identitySelectElement) return;
    identitySelectElement.innerHTML = '';
    if (allIdentities && allIdentities.length > 0) {
        allIdentities.forEach(identity => {
            const option = document.createElement('option');
            const did = identity.did || identity.identifier;
            const displayName = identity.displayName || identity.alias || 'Unnamed';
            option.value = did;
            option.textContent = `${displayName} (${did}) - [${identity.source}]`;
            option.dataset.source = identity.source;
            identitySelectElement.appendChild(option);
        });
        identitySelectElement.disabled = false;
    } else {
        const option = document.createElement('option');
        option.textContent = 'No identities available';
        identitySelectElement.appendChild(option);
        option.disabled = true;
    }
}

export function populateIdentitySelectDelete(allIdentities) {
    const identitySelectDeleteElement = getElement('identity-select-delete');
    if (!identitySelectDeleteElement) return;
    identitySelectDeleteElement.innerHTML = '';
    if (allIdentities && allIdentities.length > 0) {
        allIdentities.forEach(identity => {
            const did = identity.did || identity.identifier;
            const displayName = identity.displayName || identity.alias || 'Unnamed';
            const option = document.createElement('option');
            option.value = did;
            option.textContent = `${displayName} (${did}) - [${identity.source}]`;
            option.dataset.source = identity.source;
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

export function populateIdentitySelectRevoke(allIdentities) {
    const identitySelectRevokeElement = getElement('identity-select-revoke');
    if (!identitySelectRevokeElement) return;
    identitySelectRevokeElement.innerHTML = '';
    if (allIdentities && allIdentities.length > 0) {
        allIdentities.forEach(identity => {
            const did = identity.did || identity.identifier;
            const displayName = identity.displayName || identity.alias || 'Unnamed';
            const option = document.createElement('option');
            option.value = did;
            option.textContent = `${displayName} (${did}) - [${identity.source}]`;
            option.dataset.source = identity.source;
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

function validateIdentityForm() {
    let isValid = true;
    const didMethod = getElement('didMethod')?.value.trim();
    const blockchain = getElement('blockchain')?.value.trim();
    const network = getElement('network')?.value.trim();
    const displayName = getElement('displayName')?.value.trim();
    const didMethodError = getElement('didMethod-error');
    if (didMethodError) didMethodError.style.display = (!didMethod || didMethod === "") ? 'block' : 'none';
    const blockchainError = getElement('blockchain-error');
    const showBlockchainFields = !['did:key', 'did:web'].includes(didMethod);
    if (showBlockchainFields && blockchainError) blockchainError.style.display = (!blockchain || blockchain === "") ? 'block' : 'none';
    const networkError = getElement('network-error');
    if (showBlockchainFields && networkError) networkError.style.display = (!network || network === "") ? 'block' : 'none';
    const displayNameError = getElement('displayName-error');
    if (displayNameError) displayNameError.style.display = !displayName ? 'block' : 'none';
    isValid = isValid && (!!didMethod && didMethod !== "");
    if (showBlockchainFields) {
        isValid = isValid && (!!blockchain && blockchain !== "") && (!!network && network !== "");
    }
    isValid = isValid && !!displayName;
    return isValid;
}

export function resetIdentityForm() {
    populateDidMethodSelect();
    const didMethodSelect = getElement('didMethod');
    if (didMethodSelect) {
        const changeEvent = new Event('change');
        didMethodSelect.dispatchEvent(changeEvent);
    }
    populateIdentityTypeSelect();
    const displayName = getElement('displayName');
    if (displayName) displayName.value = 'New Identity';
    resetForm('new-identity-modal');
}

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
    const identityTypeSelect = getElement('identityType');
    const blockchainFormGroup = getElement('blockchain-form-group');
    const networkFormGroup = getElement('network-form-group');
    const identityTypeFormGroup = getElement('identityType-form-group');
    resetIdentityForm();
    if (didMethodSelect) {
        didMethodSelect.addEventListener('change', (event) => {
            const selectedDidMethod = event.target.value;
            const isPrivadoId = selectedDidMethod === 'polygonid' || selectedDidMethod === 'iden3';
            const usesBlockchain = !['did:key', 'did:web'].includes(selectedDidMethod);
            if (blockchainFormGroup) blockchainFormGroup.style.display = usesBlockchain ? 'block' : 'none';
            if (networkFormGroup) networkFormGroup.style.display = usesBlockchain ? 'block' : 'none';
            if (identityTypeFormGroup) identityTypeFormGroup.style.display = isPrivadoId ? 'block' : 'none';
            populateBlockchainSelect(selectedDidMethod);
            const currentBlockchainSelection = blockchainSelect ? blockchainSelect.value : null;
            populateNetworkSelect(selectedDidMethod, currentBlockchainSelection);
        });
    }
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
                resetIdentityForm();
                const didMethodSelect = getElement('didMethod');
                if (didMethodSelect) {
                    const changeEvent = new Event('change');
                    didMethodSelect.dispatchEvent(changeEvent);
                }
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
            const displayName = getElement('displayName').value;
            if (didMethod.startsWith('did:')) {
                const encryptedDisplayName = await encryptWithKey(displayName, KEY);
                const payload = {
                    provider: didMethod,
                    alias: encryptedDisplayName,
                    kms: 'local'
                };
                const usesBlockchain = !['did:key', 'did:web'].includes(didMethod);
                if (usesBlockchain) {
                    const blockchain = getElement('blockchain').value;
                    const network = getElement('network').value;
                    payload.options = { network };
                }
                try {
                    const newVeramoDid = await fetchData(`${veramoBaseUrl}/didManagerCreate`, 'POST', { 'Authorization': veramoAuthToken }, payload);
                    console.log("New Veramo DID Created:", newVeramoDid);
                    alert(`Veramo DID (${didMethod}) created successfully!`);
                    if (newIdentityModal) newIdentityModal.style.display = 'none';
                    await loadAllIdentities();
                    resetIdentityForm();
                } catch (error) {
                    console.error("Error creating Veramo DID:", error);
                    alert(`Error creating Veramo DID: ${error.message}`);
                }
            } else {
                const blockchain = getElement('blockchain').value;
                const network = getElement('network').value;
                const identityType = getElement('identityType').value;
                const identityData = {
                    didMetadata: { method: didMethod, blockchain: blockchain, network: network, type: identityType },
                    displayName: displayName
                };
                try {
                    const newIdentity = await fetchData(`${privadoBaseUrl}/identities`, 'POST', { 'Authorization': authorizationHeader, 'accept': 'application/json' }, identityData);
                    console.log("New Privado ID Identity Created:", newIdentity);
                    if (newIdentityModal) newIdentityModal.style.display = 'none';
                    await loadAllIdentities();
                    alert('Privado ID Identity created successfully!');
                    resetIdentityForm();
                } catch (error) {
                    console.error("Error creating Privado ID identity:", error);
                    alert(`Error creating Privado ID identity: ${error.message}`);
                }
            }
        });
    }
    if (loadIdentitiesBtn) {
        loadIdentitiesBtn.addEventListener('click', async () => { await loadAllIdentities(); });
    }
    if (deleteIdentityBtn) {
        deleteIdentityBtn.addEventListener('click', () => {
            if (deleteIdentityModal) deleteIdentityModal.style.display = 'block';
            loadAllIdentities();
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
            const identityToDeleteDid = identitySelectDeleteElement ? identitySelectDeleteElement.value : null;
            if (!identityToDeleteDid) { alert('Please select an identity to delete.'); return; }
            const selectedOption = identitySelectDeleteElement.selectedOptions[0];
            const identitySource = selectedOption.dataset.source;
            try {
                if (identitySource === 'veramo') {
                    await fetchData(`${veramoBaseUrl}/didManagerDelete`, 'POST', { 'Authorization': veramoAuthToken }, { did: identityToDeleteDid });
                    console.log("Veramo DID Deleted:", identityToDeleteDid);
                    alert('Veramo DID deleted successfully!');
                } else {
                    await fetchData(`${privadoBaseUrl}/identities/${encodeURIComponent(identityToDeleteDid)}`, 'DELETE', { 'Authorization': authorizationHeader, 'accept': 'application/json' });
                    console.log("Privado ID Identity Deleted:", identityToDeleteDid);
                    alert('Privado ID Identity deleted successfully!');
                }
                if (deleteIdentityModal) deleteIdentityModal.style.display = 'none';
                await loadAllIdentities();
            } catch (error) {
                console.error("Error deleting identity:", error);
                alert(`Error deleting identity: ${error.message}`);
            }
        });
    }
}
