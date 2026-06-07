import Airtable from 'airtable';

// Initialize the Airtable base client using your environment variables
const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_ACCESS_TOKEN 
}).base(process.env.AIRTABLE_BASE_ID || '');

export default base;

// Define an interface matching your Airtable table column names
export interface BookRecord {
    Title: string;
    Author: string;
    ISBN?: string;                         // Added matching your table
    Status: 'Todo' | 'In progress' | 'Done'; // Update these to match your actual Status dropdown options
    'Start date'?: string;                 // Fixed to match "Start date" exactly
  }