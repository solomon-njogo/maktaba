import Airtable from 'airtable';

// Initialize the Airtable base client using your environment variables
const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_ACCESS_TOKEN || ''
}).base(process.env.AIRTABLE_BASE_ID || '');

if (!process.env.AIRTABLE_ACCESS_TOKEN || !process.env.AIRTABLE_BASE_ID) {
  throw new Error("Missing Airtable configuration in environment variables. Please check your .env file.");
}

export default base;