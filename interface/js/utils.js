// js/utils.js

import { authorizationHeader } from './config.js'; // Import authorizationHeader for fetchData

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
 * Includes enhanced logging for debugging network calls and error handling for non-JSON responses.
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
        headers: { ...headers }, // Create a shallow copy to modify safely
    };

    if (body) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    console.log('----------------------------------------------------');
    console.log('Making API Call:');
    console.log('   URL:', url);
    console.log('   Method:', options.method);
    console.log('   Headers:', options.headers);
    console.log('   Body:', options.body ? JSON.parse(options.body) : 'N/A');
    console.log('----------------------------------------------------');

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
 * Resets form fields within specified modals to their default values.
 * Note: Assumes modal divs are not actual <form> tags, so directly targets input IDs.
 * @param {string} formId - The ID of the modal div to reset.
 */
export function resetForm(formId) {
    // This will be handled by specific module's reset function if complex
    // For now, keeping a basic version here and letting modules override/extend.

    // Hide all error messages within the modal/form
    const formElement = getElement(formId);
    if (formElement) {
        const errorLabels = formElement.querySelectorAll('.text-red-500');
        errorLabels.forEach(label => label.style.display = 'none');
    }
}