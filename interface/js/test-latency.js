// js/did-creator.js

import { getElement, fetchData } from './utils.js';
import { veramoBaseUrl, veramoAuthToken } from './config.js'; 

// --- CONFIGURATION FOR DID CREATION TEST SUITE ---
const DID_METHODS_TO_TEST = [
    { provider: 'did:ethr', count: 10, aliasBase: 'ethr_test', options: { network: "sepolia" } },
    { provider: 'did:key', count: 10, aliasBase: 'key_test' },
    { provider: 'did:web', count: 10, aliasBase: 'web_test_example.com' }, // Note: Requires web server config
    { provider: 'did:polygonid', count: 10, aliasBase: 'poly_test', options: { network: "amoy" } },
    { provider: 'did:iden3', count: 10, aliasBase: 'iden3_test', options: { network: "privado:main" } },
];
const TOTAL_DIDS_TO_CREATE = DID_METHODS_TO_TEST.reduce((sum, item) => sum + item.count, 0);


/**
 * Calculates the Nth percentile of a sorted array of numbers.
 */
function calculatePercentile(times, p) {
    if (!times || times.length === 0) return 0;
    const index = Math.ceil(p / 100 * times.length) - 1;
    return times[Math.max(0, index)]; 
}

/**
 * Generates the full list of creation payloads for the test suite.
 * @returns {Array<{didMethod: string, alias: string, options: object}>}
 */
function generateDidCreationPayloads() {
    const payloads = [];
    DID_METHODS_TO_TEST.forEach(methodConfig => {
        for (let i = 1; i <= methodConfig.count; i++) {
            // Ensure unique alias for each creation
            const alias = `${methodConfig.aliasBase}_${i}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const payload = {
                provider: methodConfig.provider,
                alias: alias,
                kms: "local",
            };
            if (methodConfig.options) {
                payload.options = methodConfig.options;
            }
            payloads.push(payload);
        }
    });
    return payloads;
}

/**
 * Executes a single DID creation against the Veramo Agent.
 */
async function executeDidCreation(payload) {
    const startTime = performance.now();
    try {
        const createRes = await fetchData(
            `${veramoBaseUrl}/didManagerCreate`,
            "POST",
            {
                "Accept": "application/json; charset=utf-8",
                "Authorization": veramoAuthToken
            },
            payload
        );

        const endTime = performance.now();
        return { 
            time: Math.round(endTime - startTime), 
            success: true, 
            did: createRes.did,
            alias: payload.alias,
            provider: payload.provider
        };

    } catch (err) {
        const endTime = performance.now();
        return { 
            time: Math.round(endTime - startTime), 
            success: false, 
            alias: payload.alias,
            provider: payload.provider,
            error: err.message 
        };
    }
}


/**
 * Runs the full DID creation test suite against all specified methods.
 */
async function runDidCreationTestSuite() {
    const payloads = generateDidCreationPayloads();
    const successfulTimes = [];
    const failedResults = []; // Stores {alias, time, error}
    
    // Retrieve elements
    const createButton = getElement("did-test-btn");
    const statusHeader = getElement("test-suite-header");
    const detailsContainer = getElement("test-suite-details");
    const testStatusBox = getElement("test-suite-status");
    const errorContainer = getElement("error-message");

    createButton.disabled = true;
    detailsContainer.innerHTML = '';
    errorContainer.style.display = 'none';
    testStatusBox.style.display = "block";

    statusHeader.textContent = `Test Status: Creating 0 of ${TOTAL_DIDS_TO_CREATE} DIDs...`;
    statusHeader.style.color = '#3b82f6';

    const overallStartTime = performance.now();

    for (let i = 0; i < TOTAL_DIDS_TO_CREATE; i++) {
        const payload = payloads[i];
        const currentDescription = `${payload.provider}:${payload.alias.substring(0, 10)}...`;
        
        statusHeader.textContent = `Test Status: Creating ${i + 1} of ${TOTAL_DIDS_TO_CREATE} DIDs... (Current: ${currentDescription})`;

        // Use the execute function for the test suite
        const result = await executeDidCreation(payload);

        if (result.success) {
            successfulTimes.push(result.time);
        } else {
            failedResults.push(result);
        }
    }
    
    const overallEndTime = performance.now();
    const overallDuration = Math.round(overallEndTime - overallStartTime);
    
    let successes = successfulTimes.length;
    let failures = failedResults.length;

    // --- Statistics Calculation ---
    successfulTimes.sort((a, b) => a - b);
    
    const totalSuccessfulTime = successfulTimes.reduce((sum, time) => sum + time, 0);
    const averageTime = successes > 0 ? Math.round(totalSuccessfulTime / successes) : 0;
    const p50 = calculatePercentile(successfulTimes, 50);
    const p85 = calculatePercentile(successfulTimes, 85);
    
    // Calculate latency for failed creations
    const failedTimes = failedResults.map(r => r.time);
    const totalFailedTime = failedTimes.reduce((sum, time) => sum + time, 0);
    const avgFailedTime = failures > 0 ? Math.round(totalFailedTime / failures) : 0;

    // Get the top 5 slowest successful creations
    const worst5SuccessfulTimes = successfulTimes.slice(-5).reverse();
    const worst5SuccessList = worst5SuccessfulTimes.map(t => `${t} ms`).join(', ');

    // --- Display Results ---
    statusHeader.textContent = `✅ Creation Benchmark Complete! ${successes} Successes / ${failures} Failures.`;
    statusHeader.style.color = '#10b981';

    detailsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item stat-success">
                <strong>${successes}</strong> DIDs Created
            </div>
            <div class="stat-item stat-failure">
                <strong>${failures}</strong> DIDs Failed
            </div>
            <div class="stat-item stat-timing">
                <strong>${overallDuration} ms</strong> Total Wall Clock Time
            </div>
            <div class="stat-item stat-timing">
                <strong>${averageTime} ms</strong> Avg. Success Time
            </div>
            <div class="stat-item stat-timing">
                P50 (Median): <strong>${p50} ms</strong>
            </div>
            <div class="stat-item stat-timing">
                P85: <strong>${p85} ms</strong>
            </div>
        </div>
        
        <h4 class="text-base font-bold mt-4 text-orange-600">Performance Breakdown (Latency)</h4>
        <ul class="list-disc ml-5 text-sm space-y-1">
            <li>Average time for failed creations: <strong>${avgFailedTime} ms</strong></li>
            <li>Worst 5 successful times: <strong>${worst5SuccessList}</strong></li>
        </ul>
        
        <h4 class="text-base font-bold mt-4 text-red-600">Failed DID Creations (${failures}):</h4>
        <textarea class="bg-white p-2 rounded-md text-xs w-full mt-2 border" rows="5" readonly>
${failedResults.map(r => `${r.provider} (Alias: ${r.alias.substring(0, 20)}...) (Took ${r.time} ms)`).join('\n')}
        </textarea>
    `;
    createButton.disabled = false;
}


/**
 * Sets up event listeners for the DID Creation functionality (Batch Only).
 */
export function setupDidCreatorEventListeners() {
    const testButton = getElement("did-test-btn");
    const testStatusBox = getElement("test-suite-status");

    if (!testButton) {
        console.warn("DID Creator Test Suite button not found on this page. Skipping setup.");
        return;
    }
    
    if (testStatusBox) {
        testStatusBox.style.display = "none"; // Hide initially
    }
    
    // --- Test Suite Logic ---
    testButton.addEventListener("click", runDidCreationTestSuite);
}