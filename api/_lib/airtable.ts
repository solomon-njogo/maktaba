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
  Status: 'Reading' | 'Completed' | 'Backlog';
  DateAdded?: string;
}