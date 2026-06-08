import airtableBase from "../_lib/airtable.config";
import { OpenLibraryBookDetails, OpenLibraryResponse } from "../types/books"; 
import { AirtableBook } from "../types/books";

const TABLE_NAME = "Books";

export async function getBookByIsbn(isbn: string): Promise<AirtableBook | null> {
  const cleanIsbn = isbn.replace(/[-\s]/g, "");

  try {
    // 1. Search your Airtable base for the ISBN
    const existingRecords = await airtableBase(TABLE_NAME)
      .select({
        filterByFormula: `{ISBN} = '${cleanIsbn}'`,
        maxRecords: 1,
      })
      .firstPage();

    // If found, return your Book object exactly as it is configured in the DB
    if (existingRecords.length > 0) {
      const record = existingRecords[0];
      return {
        Title: record.get("Title") as string,       
        Publishers: record.get("Publishers") as string[],
        PublishDate: record.get("PublishDate") as string,
        ISBN13: record.get("ISBN13") as string[],
        ISBN10: record.get("ISBN10") as string[],
        Author: record.get("Author") as string,
        Status: record.get("Status") as AirtableBook["Status"],
        StartDate: record.get("StartDate") as Date | undefined,
        EndDate: record.get("EndDate") as Date | undefined,
        Borrowed: record.get("Borrowed") as AirtableBook["Borrowed"],
        BorrowedBy: record.get("BorrowedBy") as string,
        BorrowedOn: record.get("BorrowedOn") as unknown as Date,
        BorrowedUntil: record.get("BorrowedUntil") as unknown as Date,
        DateAdded: record.get("DateAdded") as unknown as Date,
        Genre: record.get("Genre") as string,
        Thumbnail: record.get("Thumbnail") as unknown as File,
      };
    }

    // 2. If it's a new book, look it up via Open Library
    const isbnKey = `ISBN:${cleanIsbn}`;
    const url = `https://openlibrary.org/api/books?bibkeys=${isbnKey}&jscmd=details&format=json`;

    const apiResponse = await fetch(url);
    if (!apiResponse.ok) {
      throw new Error(`Open Library API responded with status: ${apiResponse.status}`);
    }

    const data: OpenLibraryResponse = await apiResponse.json();

    if (!data || !data) {
      return null; // Book not found anywhere
    }

    return {
      Title: data[isbnKey].details.title,
      Publishers: data[isbnKey].details.publishers ?? [],
      PublishDate: data[isbnKey].details.publish_date ?? "",
      ISBN13: data[isbnKey].details.isbn_13 ?? [],
      ISBN10: data[isbnKey].details.isbn_10 ?? [],
      Author: data[isbnKey].details.authors?.map((a) => a.name).join(", ") ?? "",
      Thumbnail: new File([], `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`),
    };
  } catch (error) {
    console.error("Error getting book by ISBN:", error);
    throw error;
  }
}