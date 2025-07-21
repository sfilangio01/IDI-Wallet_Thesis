// polygon-id-plugin.js
import { AbstractAgent, AgentContext } from '@veramo/core';
import { verifyAuthResponse, createAuthorizationRequest, generateZKProof, verifyZKProof } from "@iden3/js-iden3-auth"; // Adjust imports as needed

export class PolygonIdPlugin {
    async generatePolygonIdProof(
        { credential, revealAttributes, verifierIdentity },
        context: AgentContext<AbstractAgent>
    ): Promise<any> {
        try {
            // 1. Adapt Veramo credential to Polygon ID format
            const polygonIdCredential = this.adaptCredential(credential);

            // 2. Construct the proof request
            const authRequest = await createAuthorizationRequest(
                "Proof of Age and/or City", // Description
                verifierIdentity,       // Verifier's identity
                "https://example.com/callback",          // Adjust callback URL
                {
                    circuitId: "credentialAtomicQueryMTPV2", // Or another circuit ID
                    query: this.constructQuery(revealAttributes, polygonIdCredential),
                }
            );

            // 3. Generate the ZK proof
            const proof = await generateZKProof(
                polygonIdCredential,
                authRequest,
                {
                    mtp: "path", // Adjust Merkle tree proof path (if needed)
                    sig: "signature", // Adjust signature type (if needed)
                }
            );

            return proof;

        } catch (error) {
            console.error('Error generating Polygon ID proof:', error);
            throw error;
        }
    }

    async verifyPolygonIdProof(
        { proof, verificationParams },
        context: AgentContext<AbstractAgent>
    ): Promise<boolean> {
        try {
            // 1. Verify the proof
            const isValid = await verifyZKProof(
                proof,
                verificationParams,
                {
                    mtp: "path", // Adjust Merkle tree proof path (if needed)
                    sig: "signature", // Adjust signature type (if needed)
                }
            );

            return isValid;

        } catch (error) {
            console.error('Error verifying Polygon ID proof:', error);
            return false;
        }
    }

    // --- Helper Functions ---

    adaptCredential(credential) {
        // Adapt Veramo credential to Polygon ID format
        return {
            id: credential.id,
            type: credential.type,
            issuer: credential.issuer,
            holder: credential.holder,
            name: credential.credentialSubject.name,
            age: credential.credentialSubject.age,
            city: credential.credentialSubject.city,
            country: credential.credentialSubject.country,
            issuanceDate: credential.issuanceDate,
        };
    }

    constructQuery(revealAttributes, polygonIdCredential) {
        // Construct the query for the proof request
        const query = {};

        if (revealAttributes.includes("age")) {
            query.age = {
                circuitId: "credentialAtomicQueryMTPV2",
                value: polygonIdCredential.age,
                op: ">=",
                schemaKey: "age",
                type: "integer",
                required: true,
                isRevocationQuery: false,
            };
        }

        if (revealAttributes.includes("city")) {
            query.city = {
                circuitId: "credentialAtomicQueryMTPV2",
                value: polygonIdCredential.city,
                op: "==",
                schemaKey: "city",
                type: "string",
                required: true,
                isRevocationQuery: false,
            };
        }

        return query;
    }
}