import type { VercelRequest, VercelResponse } from '@vercel/node';

// This endpoint will live at your root API path: your-domain.com/api/users
// It will handle GET and POST requests to fetch and create users
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // Handle different HTTP methods safely
  if (request.method === 'GET') {
    // Future home of: Fetch from central DB matching the shared user schema
    return response.status(200).json({ 
      message: "Fetched central user data successfully." 
    });
  }

  if (request.method === 'POST') {
    const { email } = request.body;
    return response.status(201).json({
      message: `User ${email} initialized successfully.`
    });
  }

  return response.status(405).json({ error: 'Method not allowed' });
}