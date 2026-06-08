// Define an interface matching your Airtable table column names
export interface AirtableBook {
  Title: string;
  Publishers: string[];
  PublishDate: string;
  ISBN13: string[];
  ISBN10: string[];
  Author: string;
  ISBN?: string;     
  Status?: 'Reading' | 'Done' | 'TBR' | 'To-Buy';
  StartDate?: Date;
  EndDate?: Date;
  Borrowed?: 'Yes' | 'No';
  BorrowedBy?: string;
  BorrowedOn?: Date;
  BorrowedUntil?: Date;
  DateAdded?: Date;
  Genre?: string;
  Thumbnail?: File;
}

export interface OpenLibraryBookDetails {
  title: string;
  publishers?: string[];
  publish_date?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  covers?: number[];
  authors?: Array<{ name: string; key: string }>;
}

export interface OpenLibraryResponse {
  [isbnKey: string]: {
    details: OpenLibraryBookDetails;
  };
}

// A clean, unified format your frontend will receive
export interface FormattedBookResponse {
    Title: string;
    Author: string;
    ISBN?: string;     
    Status: 'Reading' | 'Done' | 'TBR' | 'To-Buy';
    StartDate?: Date;
    EndDate?: Date;
    Borrowed?: 'Yes' | 'No';
    BorrowedBy?: string;
    BorrowedOn?: Date;
    BorrowedUntil?: Date;
    DateAdded?: Date;
    Genre?: string;
    Thumbnail?: File;
}