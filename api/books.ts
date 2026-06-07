import type { VercelRequest, VercelResponse } from '@vercel/node';
import base, { BookRecord } from './_lib/airtable';
import { FieldSet } from 'airtable';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Target your specific table inside the base
  const table = base('Books'); 

  // --- HANDLE GET REQUESTS (Fetch items) ---
  if (request.method === 'GET') {
    try {
      // Fetch the first page of records (up to 100)
      const records = await table.select({ maxRecords: 100 }).firstPage();
      
      // Clean up the formatting to only send the data your apps care about
      const formattedData = records.map(record => ({
        id: record.id,
        ...(record.fields as unknown as BookRecord),
      }));

      return response.status(200).json({ success: true, data: formattedData });
    } catch (error: any) {
      return response.status(500).json({ success: false, error: error.message });
    }
  }

  // --- HANDLE POST REQUESTS (Create new item) ---
  if (request.method === 'POST') {
    try {
      const { Title, Author, Status, ISBN } = request.body as BookRecord;

      if (!Title || !Author) {
        return response.status(400).json({ success: false, error: 'Missing Title or Author' });
      }

      // Insert record into Airtable
      // Insert record into Airtable mapping to your exact column names
        const createdRecords = await table.create([
            {
            fields: {
                Title,
                Author,
                ISBN, // Matches the # ISBN column
                Status: Status || 'Todo',
                'Start date': new Date().toISOString().split('T')[0] // Matches your "Start date" column precisely
            } as unknown as FieldSet
            }
        ]);

      return response.status(201).json({
        success: true,
        message: 'Record created successfully!',
        data: {
          id: createdRecords[0].id,
          ...createdRecords[0].fields
        }
      });
    } catch (error: any) {
      return response.status(500).json({ success: false, error: error.message });
    }
  }

  // Catch unhandled HTTP methods
  return response.status(405).json({ error: 'Method not allowed' });
}