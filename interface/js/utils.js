// js/utils.js

const KEY = "Key123";

/**
 * Safely retrieves a DOM element by its ID.
 * Returns null if the element does not exist.
 * @param {string} id - The ID of the element to retrieve.
 * @returns {HTMLElement | null} The found element or null.
 */
export function getElement(id) {
    return document.getElementById(id);
}

/**
 * Fetches data from a given URL with specified method, headers, and body.
 * @param {string} url - The URL to fetch.
 * @param {string} [method='GET'] - The HTTP method (GET, POST, PUT, DELETE).
 * @param {object} [headers={}] - HTTP headers to include in the request.
 * @param {object | null} [body=null] - The request body object, which will be JSON.stringified.
 * @returns {Promise<any>} A promise that resolves with the parsed JSON response.
 * @throws {Error} Throws an error if the network request fails or the response is not OK/JSON.
 */
export async function fetchData(url, method = 'GET', headers = {}, body = null) {
    const options = {
        method: method,
        headers: { ...headers },
    };

    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    console.log('--- Making API Call ---');
    console.log('URL:', url);
    console.log('Method:', options.method);
    console.log('Headers:', options.headers);
    console.log('Body:', options.body ? JSON.parse(options.body) : 'N/A');
    console.log('-----------------------');

    try {
        const response = await fetch(url, options);
        console.log('API Response Status:', response.status, response.statusText);

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            if (!response.ok) {
                let errorJson = {};
                try {
                    errorJson = await response.json();
                } catch (parseError) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
                }
                let errorMessage = `HTTP error! status: ${response.status}`;
                if (errorJson && errorJson.message) {
                    errorMessage += `, message: ${errorJson.message}`;
                } else if (Object.keys(errorJson).length > 0) {
                    errorMessage += `, details: ${JSON.stringify(errorJson)}`;
                }
                throw new Error(errorMessage);
            }
            return await response.json();
        } else {
            const responseText = await response.text();
            throw new Error(`API returned non-JSON response (Content-Type: ${contentType || 'None'}): ${responseText.substring(0, 200)}... (truncated)`);
        }
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error("Network or CORS error caught:", error);
            throw new Error("Network error (CORS or connection issue). Check browser console for details.");
        } else if (error instanceof DOMException && error.name === 'AbortError') {
             console.warn("Fetch request was aborted.", error);
             throw new Error("Fetch request aborted.");
        }
        throw error;
    }
}

/**
 * Resets form fields within a specified modal to their default values.
 * @param {string} formId - The ID of the modal div to reset.
 */
export function resetForm(formId) {
    const formElement = getElement(formId);
    if (!formElement) return;

    const inputs = formElement.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = input.defaultChecked;
        } else {
            input.value = input.defaultValue;
        }
    });

    const errorLabels = formElement.querySelectorAll('.text-red-500');
    errorLabels.forEach(label => label.style.display = 'none');
}

/**
 * Encrypts a string of data using a key derived from a password string.
 * @param {string} data - The plain text string to encrypt.
 * @param {string} keyString - The password string to derive the encryption key from.
 * @returns {Promise<string>} The base64-encoded encrypted data.
 */
export async function encryptWithKey(data, keyString) {
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

/**
 * Decrypts a base64-encoded string using a key derived from a password string.
 * @param {string} encryptedText - The base64-encoded string to decrypt.
 * @param {string} keyString - The password string to derive the decryption key from.
 * @returns {Promise<string>} The decrypted plain text string.
 */
export async function decryptWithKey(encryptedText, keyString) {
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
