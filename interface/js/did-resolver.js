// js/did-resolver.js

import { getElement, fetchData } from './utils.js';
import { veramoBaseUrl, veramoAuthToken } from './config.js';

// Define the DID methods for the creation test batch
const DID_METHODS = ["did:jwk", "did:ethr", "did:key", "did:pkh"];
// Set the desired count per method
const DIDS_PER_METHOD = 25; // 4 providers * 25 DIDs = 100 DIDs total

// Function to generate the list of DID creation tasks
function generateCreationBatch() {
    const batch = [];
    // Total DIDs generated will be: DID_METHODS.length * DIDS_PER_METHOD (4 * 25 = 100)
    const didsPerMethod = DIDS_PER_METHOD;

    DID_METHODS.forEach(method => {
        for (let i = 0; i < didsPerMethod; i++) {
            batch.push(method);
        }
    });
    return batch;
}

// --- DID LIST (Provided by the user, expanded with identities) ---
// NOTE: The full array is omitted here for file size/readability reasons.
// Please paste your original ALL_DIDS content here:
const ALL_DIDS = [
    // Existing DIDs
    "did:algo:app:1845671812:da490f2d15a625459bf970a3d55e1a646dfd3a956d011546e953e945d39fdada",
    "did:algo:mainnet:app:1845671812:da490f2d15a625459bf970a3d55e1a646dfd3a955d011546e953e945d39fdada",
    "did:bba:47ef0798566073ea302b8178943aaa83f227614d6f36a4d2bcd92993bbed6044",
    "did:bba:t:45e6df15dc0a7d91dcccd24fda3b52c3983a214fb0eed0938321c11ec99403cf",
    "did:bid:ef214PmkhKndUcArDQPgD5J4fFVwqJFPt",
    "did:btcr2:k1qypcylxwhf8sykn2dztm6z8lxm43kwkyzf07qmp9jafv3zfntmpwtks9hmnrw",
    "did:btcr:x705-jznz-q3nl-srs",
    "did:btcr:xkrn-xz7q-qsye-28p",
    "did:btcr:xz35-jznz-q9yu-ply",
    "did:ccp:3CzQLF3qfFVQ1CjGVzVRZaFXrjAd",
    "did:ccp:ceNobbK6Me9F5zwyE3MKY88QZLw",
    "did:cheqd:mainnet:Ps1ysXP2Ae6GBfxNhNQNKN",
    "did:cheqd:testnet:55dbc8bf-fba3-4117-855c-1e0dc1d3bb47",
    "did:dns:danubetech.com",
    "did:dyne:demo:2r1FxbRA1EyfgeXh9TgEYT5RfkbMFUwLEmbYqeBajNbp",
    "did:dyne:demo:FFqGYxShyDGAHd4QyLY1KFCSGBb1mBP9sZebEyBM7JPi",
    "did:dyne:demo_A:DBzNYB3ft2ncfeGaVV8aR5x95tU5hKUqGLYpDJifEVwu",
    "did:dyne:sandbox.test:JBdcDrTMkEuR8A2QnMQLRDXBL82AKxTpuHkxhmzgdkVH",
    "did:ebsi:z24q53pA3pjcnoukP6fD5jXt",
    "did:ebsi:zjUnExsyyweQ9p4cy3nvrVc",
    "did:empe:02bbae4a3c51a3134d0aa4bfe1e7ed19c6debe84",
    "did:ens:vitalik.eth",
    "did:eosio:4667b205c6838ef70ff7988f6e8257e8be0e1284a2f59699054a018f743b1d11:caleosblocks",
    "did:eosio:eos:eoscanadacom",
    "did:ethr:0x03fdd57adec3d438ea237fe46b33ee1e016eda6b585c3e27ea66686c2ea5358479",
    "did:ethr:0x1:0x03fdd57adec3d438ea237fe46b33ee1e016eda6b585c3e27ea66686c2ea5358479",
    "did:ethr:0x1:0x3b0BC51Ab9De1e5B7B6E34E5b960285805C41736",
    "did:ethr:0x3b0BC51Ab9De1e5B7B6E34E5b960285805C41736",
    "did:ethr:sepolia:0x03fdd57adec3d438ea237fe46b33ee1e016eda6b585c3e27ea66686c2ea5358479",
    "did:evan:0x7df25c5090b5361562ef30b3c30ddcde0ac59dd4",
    "did:everscale:47325e80e3cef5922d3a3583ae5c405ded7bda781cb069f2bc932a6c3d6ec62e",
    "did:everscale:mainnet:47325e80e3cef5922d3a3583ae5c405ded7bda781cb069f2bc932a6c3d6ec62e",
    "did:everscale:testnet:d760f69f830dfa0668f2e7923392217589ec8d62dcb90f2c06656665dba7fb4d",
    "did:evrc:issuer:polygon:62eeb90e-eee4-4d31-8927-1075e82b2a74",
    "did:gatc:25sPfKCaYnzV6f8ckJeqyqNcpsbeBPBS",
    "did:gatc:2xtSori9UQZdTqzxrkp7zqKM4Kj5B4C7",
    "did:gatc:32MxGGj4gpCEWMiKjPtCqsrbg9JF9Kn4",
    "did:gatc:acYseLtTEVeqF8oBhJEejbCVHJ8auVupaRuo6gw4hmXjcc77uCKqyM3imEJH",
    "did:iden3:polygon:amoy:xC8VZLUUfo5p9DWUawReh7QSstmYN6zR7qsQhQCsw",
    "did:indy:idunion:test:BDrEcHc8Tb4Lb2VyQZWEDE",
    "did:indy:indicio:demo:KKyAeG7woJMV6MhhAREVKp",
    "did:indy:nxd:LLDnZr8iaYM3F77pUWXnVX",
    "did:indy:sovrin:WRfXPg8dantKVubE3HX8pw",
    "did:indy:sovrin:builder:VbPQNHsvoLZdaNU7fTBeFx",
    "did:iota:0xf4d6f08f5a1b80dd578da7dc1b49c886d580acd4cf7d48119dfeb82b538ad88a",
    "did:itn:EzfteTXcoHXh5W1PURHrS3",
    "did:itn:PA7xLNkMAqzzrDp4UBnrZm",
    "did:jwk:eyJraWQiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6andrLXRodW1icHJpbnQ6c2hhLTI1NjpGZk1iek9qTW1RNGVmVDZrdndUSUpqZWxUcWpsMHhqRUlXUTJxb2JzUk1NIiwia3R5IjoiT0tQIiwiY3J2IjoiRWQyNTUxOSIsImFsZyI6IkVkRFNBIiwieCI6IkFOUmpIX3p4Y0tCeHNqUlBVdHpSYnA3RlNWTEtKWFE5QVBYOU1QMWo3azQifQ",
    "did:jwk:eyJraWQiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6andrLXRodW1icHJpbnQ6c2hhLTI1Njpnc0w0VTRxX1J6VFhRckpwQUNnZGkwb1lCdUV1QjNZNWZFanhDd1NPUFlBIiwia3R5IjoiRUMiLCJjcnYiOiJQLTM4NCIsImFsZyI6IkVTMzg0IiwieCI6ImEtRWV5T2hlRUNWcDJqRkdVRTNqR0RCNlAzVV80S0lyZHRzTU9RQXFQN0NBMlVvV3NERG1nOWdJUVhiOEthd0ciLCJ5Ijoib3cxWDJ6VFVRaG12elY4NnpHdGhKc0xLeDE2MmhmSmxmN1p0OTFYUnZBTzRScE4zR2RGaVl3Tmc0NXJWUmlUcSJ9",
    "did:key:z2J9gcGbsEDUmANXS8iJTVefK5t4eCx9x5k8jr8EyXWekTiEet6Jt6gwup2aWawzhHyMadvVMFcQ3ruwqg1Y8rYzjto1ccQu",
    "did:key:z3tEFS9q2WkwvvVvr1BrYwNreqcudmcCQGGRSQ8r73recEqAUHGeLPWzwK6toBdKJgX3Fs",
    "did:key:z4MXj1wBzi9jUstyPMS4jQqB6KdJaiatPkAtVtGc6bQEQEEsKTic4G7Rou3iBf9vPmT5dbkm9qsZsuVNjq8HCuW1w24nhBFGkRE4cd2Uf2tfrB3N7h4mnyPp1BF3ZttHTYv3DLUPi1zMdkULiow3M1GfXkoC6DoxDUm1jmN6GBj22SjVsr6dxezRVQc7aj9TxE7JLbMH1wh5X3kA58H3DFW8rnYMakFGbca5CB2Jf6CnGQZmL7o5uJAdTwXfy2iiiyPxXEGerMhHwhjTA1mKYobyk2CpeEcmvynADfNZ5MBvcCS7m3XkFCMNUYBS9NQ3fze6vMSUPsNa6GVYmKx2x6JrdEjCk3qRMMmyjnjCMfR4pXbRMZa3i",
    "did:key:z5TcEoNqw2THWrFNZP62f2UmKMsuDnxmtYiNFHbVvqyPKUVyt7XfYmJ6HUsxmMYh2QWRctQ65HEw6BcPXxQevdAAWsd2aTNSjVUZ6VoyuPv8g8BySddJG9bDLGzey9EHSdYMcHYrYV8ycwKeNxcSrLqTCqxzDBHmyW6zEzDyYUoa8S8SAzAhVXF2uT19iyczDekWKZoPw",
    "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
    "did:key:z82Lkytz3HqpWiBmt2853ZgNgNG8qVoUJnyoMvGw6ZEBktGcwUVdKpUNJHct1wvp9pXjr7Y",
    "did:key:zDnaerDaTF5BXEavCrfRZEk316dpbLsfPDZ3WJ5hRTPFU2169",
    "did:key:zQ3shokFTS3brHcDQrn82RUDfCZESWL1ZdCEJwekUDPQiYBme",
    "did:key:zUC7DWA2FazpvPXmiXeTWuLjdMGXXmmWXbwoKNo554L3E4PD5ZsoZPqzCvkFkkQGvWp6uLZ3PKQJMfXYzLGNoiMyqXYSQa19cvWTiH3QpzddfRVWW6FtFMWTcvUb7wg4o9khbDt",
    "did:kscirc:k2f2PhnVHabRenKbaKfLMyuxRU94S1HfAwsR2dMHxTqVeEzmPxsd",
    "did:kscirc:k7745fAnbFGBeECS7xTDkowVXZZxEvMhpfbcQjaLYSiyed5du9MJ",
    "did:meta:0000000000000000000000000000000000000000000000000000000000005e65",
    "did:mydata:z6MkjgVfx2YE7SUBZBej65E7UHSjAyMLukPvdPjPytpTy1ZM",
    "did:mydata:z6MktaWPDXK7qwt9YgcGVuCFAXBvrEP3WPtxJQg37jnULXWL",
    "did:near:CF5RiJYh4EVmEt8UADTjoP3XaZo1NPWxv6w5TmkLqjpR",
    "did:oyd:zQmNauTUUdkpi5TcrTZ2524SKM8dJAzuuw4xfW13iHrtY1W%40did2.data-container.net",
    "did:oyd:zQmaBZTghndXTgxNwfbdpVLWdFf6faYE4oeuN2zzXdQt1kh",
    "did:peer:2.Ez6LSghwSE437wnDE1pt3X6hVDUQzSjsHzinpX3XFvMjRAm7y.Vz6Mkhh1e5CEYYq6JBUcTZ6Cp2ranCWRrv7Yax3Le4N59R6dd.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9hbGljZS5kaWQuZm1ncC5hcHAvIiwiciI6W10sImEiOlsiZGlkY29tbS92MiJdfQ",
    "did:peer:2.Ez6LSpSrLxbAhg2SHwKk7kwpsH7DM7QjFS5iK6qP87eViohud.Vz6MkqRYqQiSgvZQdnBytw86Qbs2ZWUkGv22od935YF4s8M7V.SeyJ0IjoiZG0iLCJzIjoiaHR0cHM6Ly9leGFtcGxlLmNvbS9lbmRwb2ludDEiLCJyIjpbImRpZDpleGFtcGxlOnNvbWVtZWRpYXRvciNzb21la2V5MSJdLCJhIjpbImRpZGNvbW0vdjIiLCJkaWRjb21tL2FpcDI7ZW52PXJmYzU4NyJdfQ",
    "did:pkh:tz:tz2BFTyPeYRzxd5aiBchbXN3WCZhx7BqbMBq",
    "did:plc:44ybard66vv44zksje25o7dz",
    "did:plc:yk4dd2qkboz2yv6tpubpc6co",
    "did:prism:0d8481c41b654794f02922601f84811763c655dcfc376acf841eb996846d5e68",
    "did:prism:52e163e8e53466b808e53df870bccd0a066aa4d05af9b689f5c73edcbe23d625",
    "did:prism:c36cd59bbc62dee1925e1343a8fed051416e417116d6169d060746f1e6816cd4",
    "did:schema:evan-ipfs:json-schema:Qma2beXKwZeiUXcaRaQKwbBV1TqyiJnsMTYExUTdQue43J",
    "did:schema:public-ipfs:json-schema:Qma2beXKwZeiUXcaRaQKwbBV1TqyiJnsMTYExUTdQue43J",
    "did:sol:devnet:2eK2DKs6vdzTEoj842Gfcs6DdtffPpw1iF6JbzQL4TuK",
    "did:tgrid:trustgrid:dev:QjA1qdXKmxzgK4u8mFoBpF",
    "did:tz:tz1YwA1FwpgLtc1G8DKbbZ6e6PTb1dQMRn5x",
    "did:v1:nym:z6Mkmpe2DyE4NsDiAb58d75hpi1BjqbH6wYMschUkjWDEEuR",
    "did:v1:test:nym:z6MkgF4uJbLMoUin2uKaBf4Jb1F7SHzuALE8Ldq8FPPpHE9t",
    "did:v1:test:nym:z6MkmWLiAt5FtfwgFJwMDGS1GiFn1KpUXsd7bn1v2hLyXvud",
    "did:web:danubetech.com",
    "did:web:identity.foundation",
    "did:webs:peacekeeper.github.io:did-webs-iiw37-tutorial:EKYGGh-FtAphGmSZbsuBs_t4qpsjYJ2ZqvMKluq9OxmP",
    "did:webvh:QmPEQVM1JPTyrvEgBcDXwjK4TeyLGSX1PxjgyeAisdWM1p:gist.githubusercontent.com:brianorwhatever:9c4633d18eb644f7a47f93a802691626:raw",
    "did:webvh:QmVJ5nUYb9iugnUz4yDfbe8UFbhmnsvS2EAzSpSfPScRAn:opsecid.github.io",

    // Additional DIDs from identities (ensuring no duplicates)
    "did:cheqd:testnet:a1abbc1d-db96-480b-9935-9956a3f60e07#organization-1",
    "did:ethr:0x02fd55d6154073b386f5a229856a3b301b76bd6f7d30b5a9edb7165f3e8d7bfd01",
    "did:web:localhost",
    "did:polygonid:polygon:amoy:2qVxpu4mRLx7vGm5bRCwVoSP5f6DrA5df2hH2i97DC",
    "did:polygonid:polygon:amoy:2qZCp1UQTDaLVka3XvZ5tE2AXrmUPp1mpqfi2vGVjK",
    "did:iden3:privado:main:2SZWQpd13xUynTXDvbK5PMvbzJibX4tJEJxmX3qaGe",
    "did:polygonid:polygon:amoy:2qWsqKYdKBrd6vYor7G3xjmHc37kq2c3N5TR3odMLq",
    "did:polygonid:polygon:zkevm:2qeZhnQU64h7qsQQNbvJa1jQZ7kEMQSRwbbZLNrPAL",
    "did:polygonid:polygon:amoy:2qS81ASFbwQkriUKJv9WfNKMcSi5u9rLYNt6hSrkmH",
    "did:iden3:privado:main:2SiE4biKBHH2jWX6Gby2v2oN91AqnFE8zV7fGsiPCJ",
    "did:polygonid:polygon:amoy:2qT9E9X4rPyKEJ8ug3hRhyWGWunZYMniSFmm5maytx",
    "did:polygonid:polygon:amoy:2qWM6qXDkjxNS1ZoEiADqD13Ybb2aEUMM5Uia5yTv5",
    "did:polygonid:polygon:amoy:2qbX7tPufepJkPU3aPNsHkZcePcR3yVe1gNdBrjMgA",
    "did:polygonid:polygon:amoy:2qVegfrwqQQGZ14kAfKmwCex8Y1DVQKaNBresuU1CQ",
    "did:polygonid:polygon:amoy:2qaNPj6Wa2vq12xrCxqNzcXj7cCPZNb3aQeZxQD1yq",
    "did:polygonid:polygon:amoy:2qXpyTbMF4JgD8Tcv57Rb4mXbvGtPjTZmNX3arBeAH",
    "did:polygonid:polygon:amoy:2qYyGztShRHYMuMAJH5g9bAaJ8tQkn1fqjuDtvBUsk",
    "did:iden3:privado:main:2SfJZgeNS6NnJ1qzmXtxgVgdxwbwuzmeH6W544Vkzh",
    "did:polygonid:polygon:amoy:2qStA4RUNXC9XvAeG76X7rKBLeKwzQTNddE98WHg74",
];


/**
 * Calculates the Nth percentile of a sorted array of numbers.
 */
function calculatePercentile(times, p) {
    if (!times || times.length === 0) return 0;
    const index = Math.ceil(p / 100 * times.length) - 1;
    return times[Math.max(0, index)];
}

/**
 * Executes a single DID resolution against the Veramo Agent.
 */
async function resolveSingleDid(did) {
    const startTime = performance.now();
    try {
        await fetchData(
            `${veramoBaseUrl}/resolveDid`,
            "POST",
            {
                "Accept": "application/json; charset=utf-8",
                "Authorization": veramoAuthToken
            },
            {
                didUrl: did,
                options: {
                    accept: "application/did+ld+json"
                }
            }
        );

        const endTime = performance.now();
        return { time: Math.round(endTime - startTime), success: true, did: did };

    } catch (err) {
        const endTime = performance.now();
        return { time: Math.round(endTime - startTime), success: false, did: did, error: err.message };
    }
}

/**
 * Executes a single DID creation against the Veramo Agent.
 */
/**
 * Executes a single DID creation against the Veramo Agent.
 */
async function createSingleDid(provider) {
    const startTime = performance.now();
    
    // Define the request body, including specific options for did:web
    const requestBody = {
        provider: provider,
        alias: `test-${Date.now()}`,
        kms: "local",
    };
    
    try {
        const responseData = await fetchData(
            `${veramoBaseUrl}/didManagerCreate`,
            "POST",
            {
                "Authorization": veramoAuthToken
            },
            requestBody // Use the modified request body
        );

        const endTime = performance.now();
        return { time: Math.round(endTime - startTime), success: true, did: responseData.did, provider: provider };

    } catch (err) {
        const endTime = performance.now();
        return { time: Math.round(endTime - startTime), success: false, did: `Creation for ${provider} failed`, error: err.message };
    }
}

// --- DID RESOLUTION TEST SUITE ---
async function runDidTestSuite() {
    const totalDids = ALL_DIDS.length;
    const successfulTimes = [];
    const failedResults = [];

    // Retrieve elements
    const resolveButton = getElement("did-test-btn");
    const statusHeader = getElement("test-suite-header");
    const detailsContainer = getElement("test-suite-details");
    const testStatusBox = getElement("test-suite-status");

    resolveButton.disabled = true;
    detailsContainer.innerHTML = '';
    testStatusBox.style.display = "block";

    statusHeader.textContent = `Test Status: Resolving 0 of ${totalDids} DIDs...`;
    statusHeader.style.color = '#3b82f6';

    const overallStartTime = performance.now();

    for (let i = 0; i < totalDids; i++) {
        const did = ALL_DIDS[i];
        
        statusHeader.textContent = `Test Status: Resolving ${i + 1} of ${totalDids} DIDs... (Current: ${did.substring(0, 30)}...)`;

        const result = await resolveSingleDid(did);

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
    
    const failedTimes = failedResults.map(r => r.time);
    const totalFailedTime = failedTimes.reduce((sum, time) => sum + time, 0);
    const avgFailedTime = failures > 0 ? Math.round(totalFailedTime / failures) : 0;

    const worst5SuccessfulTimes = successfulTimes.slice(-5).reverse();
    const worst5SuccessList = worst5SuccessfulTimes.map(t => `${t} ms`).join(', ');

    // --- Display Results ---
    statusHeader.textContent = `✅ Resolution Benchmark Complete! ${successes} Successes / ${failures} Failures.`;
    statusHeader.style.color = '#10b981';

    detailsContainer.innerHTML = `
        <div class="stats-grid">
            <div class="stat-item stat-success">
                <strong>${successes}</strong> Resolutions Succeeded
            </div>
            <div class="stat-item stat-failure">
                <strong>${failures}</strong> Resolutions Failed
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
            <li>Average time for failed resolutions: <strong>${avgFailedTime} ms</strong></li>
            <li>Worst 5 successful times: <strong>${worst5SuccessList}</strong></li>
        </ul>
        
        <h4 class="text-base font-bold mt-4 text-red-600">Unresolved DIDs (${failures}):</h4>
        <textarea class="bg-white p-2 rounded-md text-xs w-full mt-2 border" rows="5" readonly>
${failedResults.map(r => `${r.did} (Took ${r.time} ms)`).join('\n')}
        </textarea>
    `;
    resolveButton.disabled = false;
}

// --- DID CREATION TEST SUITE ---
async function runDidCreationTestSuite() {
    const didProviders = generateCreationBatch();
    const totalDids = didProviders.length; // Will be 100
    const successfulResults = []; // Collects {time, did, provider}
    const failedResults = []; // Stores {did, time, error}

    // Retrieve elements
    const createButton = getElement("did-create-test-btn");
    const statusHeader = getElement("test-suite-header");
    const detailsContainer = getElement("test-suite-details");
    const testStatusBox = getElement("test-suite-status");

    createButton.disabled = true;
    detailsContainer.innerHTML = '';
    testStatusBox.style.display = "block";

    statusHeader.textContent = `Test Status: Creating 0 of ${totalDids} DIDs...`;
    statusHeader.style.color = '#3b82f6';

    const overallStartTime = performance.now();

    for (let i = 0; i < totalDids; i++) {
        const provider = didProviders[i];

        // LOGGING: Show what is being created in the console
        console.log(`[Creation ${i + 1}/${totalDids}] Starting creation for provider: ${provider}`);

        statusHeader.textContent = `Test Status: Creating ${i + 1} of ${totalDids} DIDs... (Current Provider: ${provider})`;

        const result = await createSingleDid(provider);

        if (result.success) {
            successfulResults.push(result); // Store the full result object
            // LOGGING: Show success in the console
            console.log(`[Creation ${i + 1}/${totalDids}] ✅ Success: ${result.did} (${result.time} ms)`);
        } else {
            failedResults.push(result);
            // LOGGING: Show failure in the console
            console.error(`[Creation ${i + 1}/${totalDids}] ❌ Failed: ${result.did}. Error: ${result.error}`);
        }

    }

    const overallEndTime = performance.now();
    const overallDuration = Math.round(overallEndTime - overallStartTime);

    let successes = successfulResults.length;
    let failures = failedResults.length;

    // --- Statistics Calculation ---
    const successfulTimes = successfulResults.map(r => r.time);
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
        <h4 class="text-xl font-semibold text-gray-800 mb-2">DID Creation Latency Test Results (${totalDids} DIDs)</h4>
        <div class="stats-grid">
            <div class="stat-item stat-success">
                <strong>${successes}</strong> Creations Succeeded
            </div>
            <div class="stat-item stat-failure">
                <strong>${failures}</strong> Creations Failed
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
  
        <h4 class="text-base font-bold mt-4 text-gray-600">Created DIDs (Successes: ${successes}):</h4>
        <textarea class="bg-white p-2 rounded-md text-xs w-full mt-2 border" rows="5" readonly>
${successfulResults.map(r => `${r.provider}: ${r.did} (${r.time} ms)`).join('\n')}
        </textarea>
        <h4 class="text-base font-bold mt-4 text-red-600">Failed DID Creations (${failures}):</h4>
        <textarea class="bg-white p-2 rounded-md text-xs w-full mt-2 border" rows="5" readonly>
${failedResults.map(r => `${r.did} (Took ${r.time} ms, Error: ${r.error})`).join('\n')}
        </textarea>
      
    `;
    createButton.disabled = false;
}


/**
 * Sets up event listeners for the DID Resolution functionality.
 */
export function setupDidResolverEventListeners() {
    const resolveButton = getElement("resolve-btn");
    const didInput = getElement("did-input");
    const resultContainer = getElement("did-result");
    const testButton = getElement("did-test-btn");
    const createTestButton = getElement("did-create-test-btn"); // NEW ELEMENT
    const errorMessage = getElement("error-message");
    const testStatusBox = getElement("test-suite-status");

    if (!resolveButton || !didInput || !resultContainer || !testButton || !createTestButton) { // CHECK NEW ELEMENT
        console.warn("DID Resolver elements not found on this page. Skipping setup.");
        return;
    }

    if (testStatusBox) {
        testStatusBox.style.display = "block";
    }


    // --- Single DID Resolution Logic ---
    resolveButton.addEventListener("click", async () => {
        // ... (resolution logic remains unchanged)
        const did = didInput.value.trim();
        resultContainer.style.display = "none";
        resultContainer.textContent = "";
        errorMessage.style.display = "none";

        if (!did) {
            errorMessage.textContent = "Please enter a valid DID.";
            errorMessage.style.display = "block";
            return;
        }

        try {
            const startTime = performance.now();
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
                        accept: "application/did+ld+json"
                    }
                }
            );
            const endTime = performance.now();
            const duration = Math.round(endTime - startTime);

            resultContainer.style.display = "block";
            resultContainer.textContent = `Resolution Successful (${duration} ms):\n\n` + JSON.stringify(responseData, null, 2);

        } catch (err) {
            resultContainer.style.display = "none";
            errorMessage.textContent = `❌ Resolution Failed: ${err.message}`;
            errorMessage.style.display = "block";
            console.error("Error resolving DID:", err);
        }
    });

    // --- Test Suite Logic ---
    testButton.addEventListener("click", runDidTestSuite);
    createTestButton.addEventListener("click", (event) => {
        event.preventDefault(); // Prevents page reload
        runDidCreationTestSuite();
    });
}