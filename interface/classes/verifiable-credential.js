/**
 * @class VerifiableCredential
 * @description Represents the full structure of an issued or received Verifiable Credential,
 * as returned by the Privado ID API, including both the top-level metadata and the nested W3C VC object.
 */
class VerifiableCredential {
    /**
     * Creates an instance of VerifiableCredential.
     * It's designed to be constructed from the raw credential object received from the Privado ID API.
     *
     * @param {object} rawCredentialData - The raw credential object received from the Privado ID API.
     * Expected structure: { id: string, proofTypes: [], revoked: boolean, vc: { ...W3C_VC_Object... } }
     */
    constructor(rawCredentialData) {
        if (!rawCredentialData || typeof rawCredentialData !== 'object') {
            throw new Error("Invalid raw credential data provided to VerifiableCredential constructor.");
        }

        // --- Top-level properties from Privado ID API response (metadata about the VC) ---
        // 'id' from the top level seems to be the primary claimID for Privado ID's internal tracking
        this.claimID = rawCredentialData.id;
        this.proofTypes = rawCredentialData.proofTypes;
        this.revoked = rawCredentialData.revoked; // Status of the credential
        this.schemaHash = rawCredentialData.schemaHash;

        // --- Extracting the actual W3C Verifiable Credential (VC) from 'vc' property ---
        const vc = rawCredentialData.vc;
        if (!vc || typeof vc !== 'object') {
            throw new Error("Nested 'vc' object missing or invalid in raw credential data.");
        }

        // --- Properties from the nested 'vc' object (W3C Verifiable Credential fields) ---
        this.id = vc.id; // The standard W3C VC ID (e.g., urn:uuid:...)
        this['@context'] = vc['@context'];
        this.type = vc.type; // This is an array, e.g., ["VerifiableCredential", "KYCAgeCredential"]
        this.issuanceDate = vc.issuanceDate;
        this.expirationDate = vc.expirationDate; // Added this, as seen in your example VC structure
        this.issuer = vc.issuer; // Issuer DID (e.g., did:iden3:polygon:amoy:...)

        // Credential Subject
        this.credentialSubject = vc.credentialSubject; // This is an object like { id: DID, birthday: ..., documentType: ... }

        // Credential Status (e.g., for on-chain revocation)
        this.credentialStatus = vc.credentialStatus;
        this.revocationNonce = vc.credentialStatus?.revocationNonce; // Extracting revNonce from credentialStatus

        // Credential Schema (detailed object)
        this.credentialSchema = vc.credentialSchema; // This is an object like { id: url, type: "JsonSchema2023" }

        // Proof
        this.proof = vc.proof; // This is an array of proof objects
    }

    /**
     * Helper method to get the specific credential type (e.g., "KYCAgeCredential") from the type array.
     * @returns {string | undefined} The specific credential type or undefined.
     */
    getSpecificCredentialType() {
        if (Array.isArray(this.type) && this.type.length > 1) {
            return this.type[1]; // Assuming the specific type is always the second element
        }
        return undefined;
    }

    /**
     * Helper method to get the subject's DID.
     * @returns {string | undefined} The subject's DID or undefined.
     */
    getSubjectDID() {
        return this.credentialSubject?.id;
    }

    /**
     * Helper method to get the issuer's DID.
     * @returns {string | undefined} The issuer's DID or undefined.
     */
    getIssuerDID() {
        return this.issuer;
    }
}

// Export the class so it can be imported in other files.
export { VerifiableCredential };