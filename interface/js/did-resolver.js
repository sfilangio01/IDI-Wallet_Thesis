// js/did-resolver.js

import { getElement, fetchData } from './utils.js';
import { veramoBaseUrl, veramoAuthToken } from './config.js'; // Use veramoBaseUrl and veramoAuthToken from config

/**
 * Sets up event listeners for the DID Resolution functionality.
 * This should be called on the page where DID resolution elements exist.
 */
export function setupDidResolverEventListeners() {
    const resolveButton = getElement("resolve-btn");
    const didInput = getElement("did-input");
    const resultContainer = getElement("did-result");

    if (!resolveButton || !didInput || !resultContainer) {
        console.warn("DID Resolver elements not found on this page. Skipping setup.");
        return;
    }

    resolveButton.addEventListener("click", async () => {
        const did = didInput.value.trim();
        resultContainer.style.display = "none";
        resultContainer.textContent = "";

        if (!did) {
            alert("Please enter a valid DID.");
            return;
        }

        try {
            // FIX: Removed the redundant '/agent' from the path, as veramoBaseUrl already includes it.
            const responseData = await fetchData(
                `${veramoBaseUrl}/resolveDid`, 
                "POST",
                {
                    "Accept": "application/json; charset=utf-8",
                    "Authorization": veramoAuthToken
                },
                {
                    didUrl: did,
                    options: {
                        accept: "application/did+ld+json" // or "application/did+json"
                    }
                }
            );

            resultContainer.style.display = "block";
            resultContainer.textContent = JSON.stringify(responseData, null, 2);

        } catch (err) {
            resultContainer.style.display = "block";
            resultContainer.textContent = `❌ Error: ${err.message}`;
            console.error("Error resolving DID:", err);
        }
    });
}