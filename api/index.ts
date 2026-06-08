import express from "express";
import { handleGetBook } from "./routes/books/[isbn]";


const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse incoming JSON bodies
app.use(express.json());

// --- MIDDLEWARE ---
// Bind your route handler using Express route parameters (:isbn)
app.get("/api/books/:isbn", (req, res) => {
  // Map Express req.params over to the expected req.query structure your handler uses
  const adaptedReq = {
    query: { isbn: req.params.isbn }
  };
  
  handleGetBook(adaptedReq as any, res as any);
});

// --- HEALTH CHECK ---
app.get("/api/health", (req: express.Request, res: express.Response) => {
  res.status(200).send('OK');
});


// --- 404 ROUTE HANDLING ---
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.status(404).send('Route not found');
});

// --- START THE SERVER ---
app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on: http://localhost:${PORT}`);
});