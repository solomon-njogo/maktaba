import { getBookByIsbn } from "../../services/book.service";

// Mock types for standard Request/Response handlers
interface ApiRequest {
  query: { isbn: string };
}
interface ApiResponse {
  status: (code: number) => ApiResponse;
  json: (data: any) => void;
}

export async function handleGetBook(req: ApiRequest, res: ApiResponse) {
  const { isbn } = req.query;

  // Minimal route validation
  if (!isbn || typeof isbn !== "string") {
    return res.status(400).json({ error: "A valid ISBN string parameter is required." });
  }

  try {
    const bookData = await getBookByIsbn(isbn);

    if (!bookData) {
      return res.status(404).json({ error: `Book with ISBN ${isbn} not found.` });
    }

    // Return the clean, mapped data to your client/frontend
    return res.status(200).json(bookData);

  } catch (error) {
    console.error(`Route Error [GET /books/${isbn}]:`, error);
    return res.status(500).json({ error: "Internal server error while retrieving book metadata." });
  }
}