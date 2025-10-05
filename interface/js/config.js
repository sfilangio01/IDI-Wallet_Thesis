// js/config.js

// --- Configuration Constants ---
// BASE URL for your Privado ID / Polygon ID issuer service.
// IMPORTANT: Update this with your current Tunnelmole URL, ensuring it ends with /v2.
export const privadoBaseUrl = 'https://1yob7m-ip-195-231-104-246.tunnelmole.net/v2';
// BASE URL for your Veramo agent.
export const veramoBaseUrl = 'http://localhost:3332/agent';
// Authorization header for your Privado ID / Polygon ID API.
export const authorizationHeader = 'Basic dXNlci1pc3N1ZXI6cGFzc3dvcmQtaXNzdWVy';
// Authorization token for your Veramo agent.
export const veramoAuthToken = 'Bearer test123';

// --- Global State Variables ---
// These are still global, but are managed/exported by a central config.
export let currentIdentities = [];
export let currentCredentials = [];
export let selectedCredential = null;
export let selectedIdentityForCredentials = null;

// Functions to update global state (important for re-renders)
export function updateCurrentIdentities(newIdentities) {
    currentIdentities = newIdentities;
}

export function updateCurrentCredentials(newCredentials) {
    currentCredentials = newCredentials;
}

export function updateSelectedCredential(credential) {
    selectedCredential = credential;
}

export function updateSelectedIdentityForCredentials(identityDid) {
    selectedIdentityForCredentials = identityDid;
}

// Credential Templates Definition
// Define various credential types, their schemas, and the fields they require.
// You'll need to find or define appropriate schemas for these.
// For Polygon ID, schemas often follow the iden3 claim-schema-vocab format.
// IMPORTANT: Verify these schema URLs are correct and accessible!
export const credentialTemplates = {
    'KYCAgeCredential': {
        name: 'KYC Age Credential',
        schema: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCAgeCredential-v3.json',
        type: 'KYCAgeCredential',
        fields: [
            { id: 'birthday', label: 'Birthday (YYYYMMDD)', type: 'number', required: true, defaultValue: '19900101' },
            { id: 'documentType', label: 'Document Type', type: 'number', required: true, defaultValue: '1' }
        ]
    },
    'KYCCountryOfResidenceCredential': {
        name: 'KYC Country of Residence',
        schema: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCCountryOfResidenceCredential-v1.json',
        type: 'KYCCountryOfResidenceCredential',
        fields: [
            { id: 'countryCode', label: 'Country Code', type: 'number', required: true, placeholder: 'e.g., 826 for UK' },
            { id: 'documentType', label: 'Document Type', type: 'number', required: true, defaultValue: '1' }
        ]
    },
    'KYCEmployee': { // Using KYCEmployee as the type based on the schema filename
        name: 'KYC Employee Credential',
        schema: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/KYCEmployee-v101.json',
        type: 'KYCEmployee',
        fields: [
            { id: 'ZKPexperiance', label: 'Has ZKP Experience?', type: 'checkbox', required: false, defaultValue: false },
            { id: 'hireDate', label: 'Hire Date (YYYYMMDD)', type: 'number', required: false, placeholder: 'e.g., 20200101' }, // Changed to number for YYYYMMDD
            { id: 'position', label: 'Position', type: 'text', required: false, placeholder: 'e.g., Software Engineer' },
            { id: 'salary', label: 'Salary', type: 'number', required: false, placeholder: 'e.g., 50000' },
            { id: 'documentType', label: 'Document Type', type: 'number', required: true, defaultValue: '1' }
        ]
    },
    'BasicProfileCredential': { // Using a common iden3 schema for name/email/address related claims
        name: 'Basic Profile Credential',
        schema: 'https://raw.githubusercontent.com/iden3/claim-schema-vocab/main/schemas/json/BasicProfileCredential-v1.json',
        type: 'BasicProfileCredential',
        fields: [
            { id: 'firstName', label: 'First Name', type: 'text', required: true, placeholder: 'John' },
            { id: 'lastName', label: 'Last Name', type: 'text', required: true, placeholder: 'Doe' },
            { id: 'birthDate', label: 'Birth Date (YYYYMMDD)', type: 'number', required: false, placeholder: 'e.g., 19900101' }, // Note: birthDate vs birthday depending on schema
            { id: 'gender', label: 'Gender', type: 'text', required: false, placeholder: 'e.g., Male, Female, Non-binary' },
            { id: 'email', label: 'Email Address', type: 'email', required: false, placeholder: 'john.doe@example.com' }, // This would be part of a profile schema
            { id: 'streetAddress', label: 'Street Address', type: 'text', required: false, placeholder: '123 Main St' },
            { id: 'city', label: 'City', type: 'text', required: false, placeholder: 'Anytown' },
            { id: 'postalCode', label: 'Postal Code', type: 'text', required: false, placeholder: 'AB12 3CD' },
            { id: 'country', label: 'Country', type: 'text', required: false, placeholder: 'UK' }
        ]
    },
    'EmployeeCredential': { // This was your previous example, keeping it in case it's a separate custom one
        name: 'Employee Credential (Custom)',
        schema: 'https://example.com/schemas/EmployeeCredential-v1.json', // Custom schema example
        type: 'EmployeeCredential',
        fields: [
            { id: 'employeeId', label: 'Employee ID', type: 'text', required: true, placeholder: 'EMP-12345' },
            { id: 'jobTitle', label: 'Job Title', type: 'text', required: true, placeholder: 'Software Engineer' },
            { id: 'department', label: 'Department', type: 'text', required: false, placeholder: 'Engineering' },
            { id: 'startDate', label: 'Start Date (YYYY-MM-DD)', type: 'date', required: true }
        ]
    },
    'StudentCredential': { // Your previous example
        name: 'Student Credential (Custom)',
        schema: 'https://example.com/schemas/StudentCredential-v1.json', // Custom schema example
        type: 'StudentCredential',
        fields: [
            { id: 'studentId', label: 'Student ID', type: 'text', required: true, placeholder: 'STU-9876' },
            { id: 'university', label: 'University', type: 'text', required: true, placeholder: 'University of X' },
            { id: 'major', label: 'Major', type: 'text', required: false, placeholder: 'Computer Science' },
            { id: 'enrollmentDate', label: 'Enrollment Date (YYYY-MM-DD)', type: 'date', required: true }
        ]
    }
};

// Logout functionality (kept here for now, as it's a global action)
export function handleLogout(event) {
    event.preventDefault();
    alert('Logged out (client-side only). In a real application, this would clear tokens/sessions.');
    // Example: localStorage.removeItem('authToken');
    // Example: window.location.href = 'login.html'; // Redirect to a login page
}