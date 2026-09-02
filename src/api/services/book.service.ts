import type { FieldSet, Record as AirtableRecord } from "airtable";

import airtableBase from "../_lib/airtable.config";
import { HttpError } from "../_lib/http-error";
import type {
  BookStatus,
  BookUpdatePayload,
  BorrowedFlag,
  FormattedBookResponse,
  OpenLibraryResponse,
} from "../types/books";

const TABLE_NAME = "Books";
const VALID_STATUSES: BookStatus[] = ["Reading", "Done", "TBR", "To-Buy"];

type AttachmentLike = { url?: string };

export function cleanIsbnString(isbn: string): string {
  return isbn.replace(/[-\s]/g, "");
}

function escapeAirtableString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function isbnFormula(isbn: string): string {
  return `{ISBN} = '${escapeAirtableString(isbn)}'`;
}

function coverUrlFromIsbn(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value];
  }
  return [];
}

function asOptionalString(value: unknown): string | undefined {
  if (value == null || value === "") return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function thumbnailFromField(value: unknown, isbn?: string): string | undefined {
  if (typeof value === "string" && value) return value;
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0] as AttachmentLike | string;
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && first.url) return first.url;
  }
  if (isbn) return coverUrlFromIsbn(isbn);
  return undefined;
}

function isDeleted(deletedAt: unknown): boolean {
  return Boolean(asOptionalString(deletedAt));
}

function formatRecord(
  record: AirtableRecord<FieldSet>,
  inLibrary: boolean
): FormattedBookResponse {
  const isbn =
    asOptionalString(record.get("ISBN")) ??
    asStringArray(record.get("ISBN13"))[0] ??
    asStringArray(record.get("ISBN10"))[0];
  const status = (asOptionalString(record.get("Status")) as BookStatus) || "TBR";
  const thumbnail = thumbnailFromField(record.get("Thumbnail"), isbn);

  return {
    id: record.id,
    Title: asOptionalString(record.get("Title")) ?? "Untitled",
    Author: asOptionalString(record.get("Author")) ?? "",
    ISBN: isbn,
    Status: VALID_STATUSES.includes(status) ? status : "TBR",
    StartDate: asOptionalString(record.get("StartDate")),
    EndDate: asOptionalString(record.get("EndDate")),
    Borrowed: (asOptionalString(record.get("Borrowed")) as BorrowedFlag) || "No",
    BorrowedBy: asOptionalString(record.get("BorrowedBy")),
    BorrowedOn: asOptionalString(record.get("BorrowedOn")),
    BorrowedUntil: asOptionalString(record.get("BorrowedUntil")),
    DateAdded: asOptionalString(record.get("DateAdded")),
    Genre: asOptionalString(record.get("Genre")),
    Thumbnail: thumbnail,
    coverUrl: thumbnail,
    inLibrary,
  };
}

async function findRecordsByIsbn(isbn: string) {
  return airtableBase(TABLE_NAME)
    .select({
      filterByFormula: isbnFormula(isbn),
      maxRecords: 5,
    })
    .firstPage();
}

async function findActiveRecordByIsbn(
  isbn: string
): Promise<AirtableRecord<FieldSet> | null> {
  const records = await findRecordsByIsbn(isbn);
  return records.find((record) => !isDeleted(record.get("DeletedAt"))) ?? null;
}

export async function listBooks(filters?: {
  status?: string;
  borrowed?: string;
}): Promise<FormattedBookResponse[]> {
  const clauses: string[] = [];

  if (filters?.status) {
    if (!VALID_STATUSES.includes(filters.status as BookStatus)) {
      throw new HttpError(400, "Invalid status filter.");
    }
    clauses.push(`{Status} = '${escapeAirtableString(filters.status)}'`);
  }

  if (filters?.borrowed) {
    const borrowed =
      filters.borrowed === "Yes" || filters.borrowed === "true"
        ? "Yes"
        : filters.borrowed === "No" || filters.borrowed === "false"
          ? "No"
          : null;
    if (!borrowed) {
      throw new HttpError(400, "Invalid borrowed filter. Use Yes or No.");
    }
    clauses.push(`{Borrowed} = '${borrowed}'`);
  }

  const query = airtableBase(TABLE_NAME).select(
    clauses.length > 0
      ? { filterByFormula: `AND(${clauses.join(",")})` }
      : {}
  );
  const records = await query.all();

  return records
    .filter((record) => !isDeleted(record.get("DeletedAt")))
    .map((record) => formatRecord(record, true))
    .sort((a, b) => (b.DateAdded ?? "").localeCompare(a.DateAdded ?? ""));
}

export async function fetchBookFromOpenLibrary(
  isbn: string
): Promise<FormattedBookResponse | null> {
  const cleanIsbn = cleanIsbnString(isbn);
  const isbnKey = `ISBN:${cleanIsbn}`;
  const url = `https://openlibrary.org/api/books?bibkeys=${isbnKey}&jscmd=details&format=json`;

  const apiResponse = await fetch(url).catch((error: unknown) => {
    throw new HttpError(
      502,
      `Open Library is unreachable${error instanceof Error ? `: ${error.message}` : "."}`
    );
  });
  if (!apiResponse.ok) {
    throw new HttpError(
      502,
      `Open Library API responded with status: ${apiResponse.status}`
    );
  }

  const data = (await apiResponse.json()) as OpenLibraryResponse;
  if (!data?.[isbnKey]?.details) return null;

  const details = data[isbnKey].details;
  const thumbnail = coverUrlFromIsbn(cleanIsbn);

  return {
    Title: details.title,
    Author: details.authors?.map((author) => author.name).join(", ") ?? "",
    ISBN: cleanIsbn,
    Status: "TBR",
    Borrowed: "No",
    Genre: undefined,
    Thumbnail: thumbnail,
    coverUrl: thumbnail,
    inLibrary: false,
  };
}

export async function lookupIsbn(isbn: string): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn);
  if (!cleanIsbn) {
    throw new HttpError(400, "A valid ISBN is required.");
  }

  const existing = await findActiveRecordByIsbn(cleanIsbn);
  if (existing) {
    return formatRecord(existing, true);
  }

  const remote = await fetchBookFromOpenLibrary(cleanIsbn);
  if (!remote) {
    throw new HttpError(404, `Book with ISBN ${cleanIsbn} not found.`);
  }
  return remote;
}

export async function getLibraryBookByIsbn(
  isbn: string
): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn);
  const existing = await findActiveRecordByIsbn(cleanIsbn);
  if (!existing) {
    throw new HttpError(404, `Book with ISBN ${cleanIsbn} is not in the library.`);
  }
  return formatRecord(existing, true);
}

function fieldsFromPreview(
  preview: FormattedBookResponse,
  isbn: string
): FieldSet {
  const fields: FieldSet = {
    Title: preview.Title,
    Author: preview.Author,
    ISBN: isbn,
    Status: "TBR",
    Borrowed: "No",
    DateAdded: new Date().toISOString().slice(0, 10),
  };

  if (preview.Genre) fields.Genre = preview.Genre;
  if (preview.coverUrl) {
    fields.Thumbnail = [{ url: preview.coverUrl }] as unknown as FieldSet["Thumbnail"];
  }

  return fields;
}

export async function createBook(isbn: string): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn);
  if (!cleanIsbn) {
    throw new HttpError(400, "A valid ISBN is required.");
  }

  const records = await findRecordsByIsbn(cleanIsbn);
  const active = records.find((record) => !isDeleted(record.get("DeletedAt")));
  if (active) {
    throw new HttpError(409, `Book with ISBN ${cleanIsbn} is already in the library.`);
  }

  const deleted = records.find((record) => isDeleted(record.get("DeletedAt")));
  if (deleted) {
    const restored = await airtableBase(TABLE_NAME).update(deleted.id, {
      DeletedAt: "",
      Status: "TBR",
      Borrowed: "No",
      BorrowedBy: "",
      BorrowedOn: "",
      BorrowedUntil: "",
    } as Partial<FieldSet>);
    return formatRecord(restored, true);
  }

  const preview = await lookupIsbn(cleanIsbn);
  const created = await airtableBase(TABLE_NAME).create(
    fieldsFromPreview(preview, cleanIsbn)
  );
  return formatRecord(created, true);
}

export async function updateBook(
  isbn: string,
  patch: BookUpdatePayload
): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn);
  const existing = await findActiveRecordByIsbn(cleanIsbn);
  if (!existing) {
    throw new HttpError(404, `Book with ISBN ${cleanIsbn} is not in the library.`);
  }

  const fields: FieldSet = {};

  if (patch.Status !== undefined) {
    if (!VALID_STATUSES.includes(patch.Status)) {
      throw new HttpError(400, "Invalid status.");
    }
    fields.Status = patch.Status;
  }

  if (patch.Borrowed !== undefined) {
    if (patch.Borrowed !== "Yes" && patch.Borrowed !== "No") {
      throw new HttpError(400, "Borrowed must be Yes or No.");
    }
    fields.Borrowed = patch.Borrowed;
    if (patch.Borrowed === "No") {
      fields.BorrowedBy = "";
      fields.BorrowedOn = "";
      fields.BorrowedUntil = "";
    }
  }

  if (patch.BorrowedBy !== undefined) fields.BorrowedBy = patch.BorrowedBy;
  if (patch.BorrowedOn !== undefined) fields.BorrowedOn = patch.BorrowedOn;
  if (patch.BorrowedUntil !== undefined) {
    fields.BorrowedUntil = patch.BorrowedUntil;
  }

  if (Object.keys(fields).length === 0) {
    throw new HttpError(400, "No valid fields to update.");
  }

  const updated = await airtableBase(TABLE_NAME).update(existing.id, fields);
  return formatRecord(updated, true);
}

export async function softDeleteBook(isbn: string): Promise<FormattedBookResponse> {
  const cleanIsbn = cleanIsbnString(isbn);
  const existing = await findActiveRecordByIsbn(cleanIsbn);
  if (!existing) {
    throw new HttpError(404, `Book with ISBN ${cleanIsbn} is not in the library.`);
  }

  const updated = await airtableBase(TABLE_NAME).update(existing.id, {
    DeletedAt: new Date().toISOString(),
  });
  return formatRecord(updated, false);
}
