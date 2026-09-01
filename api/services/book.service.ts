import airtableBase from "../_lib/airtable.config";
import { OpenLibraryBookDetails, OpenLibraryResponse } from "../types/books"; 
import { AirtableBook } from "../types/books";

const TABLE_NAME = "Books";

/**
 * Helper: Standardizes ISBN formats by removing dashes and spaces.
 */
export function cleanIsbnString(isbn: string): string {
    return isbn.replace(/[-\s]/g, "");
  }


  /**
 * Reusable: Searches Airtable for a book by its ISBN.
 * Returns the raw Airtable record fields or null if not found.
 */
export async function searchBookInAirtable(isbn: string): Promise<AirtableBook | null> {
    const cleanIsbn = cleanIsbnString(isbn);
    
    const existingRecords = await airtableBase(TABLE_NAME)
      .select({
        filterByFormula: `{ISBN} = '${cleanIsbn}'`,
        maxRecords: 1,
      })
      .firstPage();
  
    if (existingRecords.length === 0) return null;
    
    const record = existingRecords[0];
    
    // Maps Airtable fields directly to your application's type definition
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

/**
 * Fetches book details from the Open Library API.
 * Returns a partial AirtableBook structure or null if missing.
 */
export async function fetchBookFromOpenLibrary(isbn: string): Promise<Partial<AirtableBook> | null> {
    const cleanIsbn = cleanIsbnString(isbn);
    const isbnKey = `ISBN:${cleanIsbn}`;
    const url = `https://openlibrary.org/api/books?bibkeys=${isbnKey}&jscmd=details&format=json`;
  
    const apiResponse = await fetch(url);
    if (!apiResponse.ok) {
      throw new Error(`Open Library API responded with status: ${apiResponse.status}`);
    }
  
    const data: OpenLibraryResponse = await apiResponse.json();
    if (!data || !data[isbnKey]) return null;
  
    const details = data[isbnKey].details;
  
    return {
      Title: details.title,
      Publishers: details.publishers ?? [],
      PublishDate: details.publish_date ?? "",
      ISBN13: details.isbn_13 ?? [],
      ISBN10: details.isbn_10 ?? [],
      Author: details.authors?.map((a) => a.name).join(", ") ?? "",
      Thumbnail: new File([], `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-L.jpg`),
    };
  }

/**
 * Get Book by ISBN.
 */
export async function getBookByIsbn(isbn: string): Promise<Partial<AirtableBook> | null> {
    try {
      // Phase 1: Try Airtable
      const cachedBook = await searchBookInAirtable(isbn);
      if (cachedBook) return cachedBook;
  
      // Phase 2: Try Open Library if file does not exist in airtable
      return await fetchBookFromOpenLibrary(isbn);
      
    } catch (error) {
      console.error("Error getting book by ISBN:", error);
      throw error;
    }
  }

/**
 * Save Book to Airtable.
 */

export async function saveBookToAirtable(details: string) {
    try{
        // Get book details from getBookByIsbn
        return{
            details
        }
        // Save book details to Airtable db (Books)

    }
    catch (error) {
        console.error("Error saving book to Airtable:", error);
        throw error;
    }
}