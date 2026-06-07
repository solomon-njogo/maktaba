import type { VercelRequest, VercelResponse } from '@vercel/node';


// This endpoint will live at your root API path: your-domain.com/api/
export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  return response.status(200).json({
    status: 'healthy',
    message: 'Central maktaba backend core is running.',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
}

