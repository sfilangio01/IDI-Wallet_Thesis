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

export const waltidBaseUrlIssuer = 'http://localhost:7002/'

export const waltidBaseUrlVerifier = 'http://localhost:7003/'

export const waltidVerifierAuthToken = 'openid4vp://authorize'
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
    // --- Existing Privado ID/Iden3 Templates ---
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
            { id: 'hireDate', label: 'Hire Date (YYYYMMDD)', type: 'number', required: false, placeholder: 'e.g., 20200101' }, 
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
            { id: 'birthDate', label: 'Birth Date (YYYYMMDD)', type: 'number', required: false, placeholder: 'e.g., 19900101' }, 
            { id: 'gender', label: 'Gender', type: 'text', required: false, placeholder: 'e.g., Male, Female, Non-binary' },
            { id: 'email', label: 'Email Address', type: 'email', required: false, placeholder: 'john.doe@example.com' }, 
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
    },

    // ---------------------------------------------
    // --- New W3C VC Templates (for Walt ID/General) ---
    // ---------------------------------------------
    'BankId': {
        name: 'Bank ID Credential',
        schema: 'N/A', // Schema link not provided in source JSON
        type: 'BankId',
        fields: [
            { id: 'accountId', label: 'Account ID', type: 'text', required: true, defaultValue: '1234567890' },
            { id: 'IBAN', label: 'IBAN', type: 'text', required: true, defaultValue: 'DE99123456789012345678' },
            { id: 'BIC', label: 'BIC', type: 'text', required: true, defaultValue: 'DEUTDEDBBER' },
            { id: 'givenName', label: 'Given Name', type: 'text', required: true, defaultValue: 'JOHN' },
            { id: 'familyName', label: 'Family Name', type: 'text', required: true, defaultValue: 'DOE' },
            { id: 'birthDate', label: 'Birth Date (YYYY-MM-DD)', type: 'date', required: true, defaultValue: '1958-08-17' }
        ]
    },
    'ePassport': {
        name: 'ePassport Credential',
        schema: 'N/A', // Schema link not provided in source JSON
        type: 'ePassport',
        fields: [
            { id: 'fullName', label: 'Full Name', type: 'text', required: true, defaultValue: 'John Doe' },
            { id: 'passportNumber', label: 'Passport Number', type: 'text', required: true, defaultValue: 'P12345678' },
            { id: 'issuingCountry', label: 'Issuing Country (Code)', type: 'text', required: true, defaultValue: 'AUT' },
            { id: 'nationality', label: 'Nationality (Code)', type: 'text', required: true, defaultValue: 'AUT' },
            { id: 'dateOfBirth', label: 'Date of Birth (YYYY-MM-DD)', type: 'date', required: true, defaultValue: '1990-04-15' },
            { id: 'sex', label: 'Sex', type: 'text', required: true, defaultValue: 'M' },
            { id: 'authority', label: 'Issuing Authority', type: 'text', required: false, defaultValue: 'Wien' },
            { id: 'height', label: 'Height', type: 'text', required: false, placeholder: 'e.g., 182 cm' }
        ]
    },
    'TaxCredential': {
        name: 'Tax Assessment Credential',
        schema: 'N/A', // Schema link not provided in source JSON
        type: 'TaxCredential',
        fields: [
            { id: 'person.tin', label: 'Tax ID Number (TIN)', type: 'text', required: true, defaultValue: 'US-98-7654321' },
            { id: 'person.givenName', label: 'Given Name', type: 'text', required: true, defaultValue: 'John' },
            { id: 'person.familyName', label: 'Family Name', type: 'text', required: true, defaultValue: 'Doe' },
            { id: 'assessmentSummary.taxYear', label: 'Tax Year', type: 'number', required: true, defaultValue: '2024' },
            { id: 'assessmentSummary.grossIncomeTotal.amount', label: 'Gross Income (Amount)', type: 'number', required: true, defaultValue: '94500' },
            { id: 'assessmentSummary.grossIncomeTotal.currency', label: 'Gross Income (Currency)', type: 'text', required: true, defaultValue: 'USD' }
        ]
    },
    'BoardingPass': {
        name: 'Boarding Pass Credential',
        schema: 'N/A', // Schema link not provided in source JSON
        type: 'BoardingPass',
        fields: [
            { id: 'firstName', label: 'First Name', type: 'text', required: true, defaultValue: 'John' },
            { id: 'lastName', label: 'Last Name', type: 'text', required: true, defaultValue: 'Doe' },
            { id: 'flight', label: 'Flight Number', type: 'text', required: true, defaultValue: 'LH123' },
            { id: 'seat', label: 'Seat Number', type: 'text', required: true, defaultValue: '1A' },
            { id: 'date', label: 'Flight Date (MM/DD/YYYY)', type: 'text', required: true, defaultValue: '09/01/2021' }
        ]
    },
    'Visa': {
        name: 'Visa Credential',
        schema: 'N/A', // Schema link not provided in source JSON
        type: 'Visa',
        fields: [
            { id: 'firstName', label: 'First Name', type: 'text', required: true, defaultValue: 'John' },
            { id: 'lastName', label: 'Last Name', type: 'text', required: true, defaultValue: 'Doe' },
            { id: 'passportNumber', label: 'Passport Number', type: 'text', required: true, defaultValue: 'G7F2A04F7O' },
            { id: 'visaType', label: 'Visa Type', type: 'text', required: true, defaultValue: 'Tourist' },
            { id: 'dateOfBirth', label: 'Date of Birth (YYYY-MM-DD)', type: 'date', required: true, defaultValue: '1980-01-01' },
            { id: 'visaValidity.start', label: 'Validity Start Date', type: 'date', required: true, defaultValue: '2024-01-01' },
            { id: 'visaValidity.end', label: 'Validity End Date', type: 'date', required: true, defaultValue: '2024-06-30' }
        ]
    },
    'VaccinationCertificate': {
        name: 'Vaccination Certificate',
        schema: 'https://raw.githubusercontent.com/walt-id/waltid-ssikit-vclib/master/src/test/resources/schemas/VerifiableVaccinationCertificate.json',
        type: 'VaccinationCertificate',
        fields: [
            { id: 'givenNames', label: 'Given Name(s)', type: 'text', required: true, defaultValue: 'Jane' },
            { id: 'familyName', label: 'Family Name', type: 'text', required: true, defaultValue: 'DOE' },
            { id: 'dateOfBirth', label: 'Date of Birth (YYYY-MM-DD)', type: 'date', required: true, defaultValue: '1993-04-08' },
            { id: 'uniqueCertificateIdentifier', label: 'Certificate ID (UVCI)', type: 'text', required: true, defaultValue: 'UVCI0904008084H' },
            { id: 'vaccinationProphylaxisInformation.0.dateOfVaccination', label: 'Vaccination Date (YYYY-MM-DD)', type: 'date', required: true, defaultValue: '2021-02-12' },
            { id: 'vaccinationProphylaxisInformation.0.doseNumber', label: 'Dose Number', type: 'number', required: true, defaultValue: '1' },
            { id: 'vaccinationProphylaxisInformation.0.countryOfVaccination', label: 'Country of Vaccination (Code)', type: 'text', required: true, defaultValue: 'DE' }
        ]
    },
    'HotelReservation': {
        name: 'Hotel Reservation Credential',
        schema: 'https://insert-link', // Placeholder from source JSON
        type: 'HotelReservation',
        fields: [
            { id: 'firstName', label: 'First Name', type: 'text', required: true, defaultValue: 'Jane' },
            { id: 'familyName', label: 'Family Name', type: 'text', required: true, defaultValue: 'DOE' },
            { id: 'dateOfBirth', label: 'Date of Birth (YYYY-MM-DD)', type: 'date', required: true, defaultValue: '1993-04-08' },
            { id: 'placeOfBirth', label: 'Place of Birth', type: 'text', required: true, defaultValue: 'LILLE, FRANCE' },
            { id: 'currentAddress.0', label: 'Current Address', type: 'text', required: true, defaultValue: '42 Great Place, Canada' }
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