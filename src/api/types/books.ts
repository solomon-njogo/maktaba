export type BookStatus = "Reading" | "Done" | "TBR" | "To-Buy";
export type BorrowedFlag = "Yes" | "No";

export interface AirtableBook {
  id: string;
  Title: string;
  Publishers?: string[];
  PublishDate?: string;
  ISBN13?: string[];
  ISBN10?: string[];
  Author: string;
  ISBN?: string;
  Status?: BookStatus;
  StartDate?: string;
  EndDate?: string;
  Borrowed?: BorrowedFlag;
  BorrowedBy?: string;
  BorrowedOn?: string;
  BorrowedUntil?: string;
  DateAdded?: string;
  Genre?: string;
  Thumbnail?: string;
  DeletedAt?: string;
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

export interface FormattedBookResponse {
  id?: string;
  Title: string;
  Author: string;
  ISBN?: string;
  Status: BookStatus;
  StartDate?: string;
  EndDate?: string;
  Borrowed?: BorrowedFlag;
  BorrowedBy?: string;
  BorrowedOn?: string;
  BorrowedUntil?: string;
  DateAdded?: string;
  Genre?: string;
  Thumbnail?: string;
  coverUrl?: string;
  inLibrary: boolean;
}

export interface BookUpdatePayload {
  Status?: BookStatus;
  Borrowed?: BorrowedFlag;
  BorrowedBy?: string;
  BorrowedOn?: string;
  BorrowedUntil?: string;
}
