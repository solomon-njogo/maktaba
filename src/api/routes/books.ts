import { Router } from "express";

import { HttpError } from "../_lib/http-error";
import {
  cleanIsbnString,
  createBook,
  getLibraryBookByIsbn,
  listBooks,
  lookupIsbn,
  softDeleteBook,
  updateBook,
} from "../services/book.service";
import type { BookUpdatePayload } from "../types/books";

const booksRouter = Router();

function requireIsbn(raw: string | undefined): string {
  if (!raw || typeof raw !== "string") {
    throw new HttpError(400, "A valid ISBN string parameter is required.");
  }
  const isbn = cleanIsbnString(raw);
  if (!isbn) {
    throw new HttpError(400, "A valid ISBN string parameter is required.");
  }
  return isbn;
}

booksRouter.get("/", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const borrowed =
      typeof req.query.borrowed === "string" ? req.query.borrowed : undefined;
    const books = await listBooks({ status, borrowed });
    res.status(200).json(books);
  } catch (error) {
    next(error);
  }
});

booksRouter.get("/lookup/:isbn", async (req, res, next) => {
  try {
    const isbn = requireIsbn(req.params.isbn);
    const book = await lookupIsbn(isbn);
    res.status(200).json(book);
  } catch (error) {
    next(error);
  }
});

booksRouter.get("/:isbn", async (req, res, next) => {
  try {
    const isbn = requireIsbn(req.params.isbn);
    const book = await getLibraryBookByIsbn(isbn);
    res.status(200).json(book);
  } catch (error) {
    next(error);
  }
});

booksRouter.post("/", async (req, res, next) => {
  try {
    const isbn = requireIsbn(req.body?.isbn ?? req.body?.ISBN);
    const book = await createBook(isbn);
    res.status(201).json(book);
  } catch (error) {
    next(error);
  }
});

booksRouter.patch("/:isbn", async (req, res, next) => {
  try {
    const isbn = requireIsbn(req.params.isbn);
    const patch = req.body as BookUpdatePayload;
    const book = await updateBook(isbn, patch ?? {});
    res.status(200).json(book);
  } catch (error) {
    next(error);
  }
});

booksRouter.delete("/:isbn", async (req, res, next) => {
  try {
    const isbn = requireIsbn(req.params.isbn);
    const book = await softDeleteBook(isbn);
    res.status(200).json(book);
  } catch (error) {
    next(error);
  }
});

export { booksRouter };
