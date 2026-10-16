import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { LocalBook } from "@/lib/offline/types"

import { booksWaitingToStart, pickReadingCard, shelfCounts } from "./shelf.ts"

function book(overrides: Partial<LocalBook> & Pick<LocalBook, "Title" | "Status">): LocalBook {
  return {
    Author: "Octavia Butler",
    inLibrary: true,
    ...overrides,
  }
}

describe("shelf counts", () => {
  it("counts a Borrowed TBR book in Shelf, Borrowed, and TBR", () => {
    const counts = shelfCounts([
      book({
        Title: "Kindred",
        Status: "TBR",
        Borrowed: "Yes",
      }),
    ])

    assert.deepEqual(counts, { shelf: 1, borrowed: 1, tbr: 1, toBuy: 0 })
  })

  it("leaves a returned book out of Borrowed", () => {
    const counts = shelfCounts([
      book({
        Title: "Parable of the Sower",
        Status: "Done",
        Borrowed: "No",
      }),
    ])

    assert.deepEqual(counts, { shelf: 1, borrowed: 0, tbr: 0, toBuy: 0 })
  })

  it("counts a To-Buy book only in To-Buy", () => {
    const counts = shelfCounts([
      book({
        Title: "Dawn",
        Status: "To-Buy",
      }),
    ])

    assert.deepEqual(counts, { shelf: 0, borrowed: 0, tbr: 0, toBuy: 1 })
  })
})

describe("Reading card", () => {
  it("picks the Reading book with the latest start date", () => {
    const card = pickReadingCard([
      book({
        Title: "Kindred",
        Status: "Reading",
        StartDate: "2024-01-15",
        DateAdded: "2026-01-01",
      }),
      book({
        Title: "Fledgling",
        Status: "Reading",
        StartDate: "2026-04-02",
        DateAdded: "2020-01-01",
      }),
    ])

    assert.equal(card?.Title, "Fledgling")
  })

  it("breaks a start-date tie with the latest date added", () => {
    const card = pickReadingCard([
      book({
        Title: "Kindred",
        Status: "Reading",
        StartDate: "2026-04-02",
        DateAdded: "2024-05-01",
      }),
      book({
        Title: "Fledgling",
        Status: "Reading",
        StartDate: "2026-04-02",
        DateAdded: "2026-08-19",
      }),
    ])

    assert.equal(card?.Title, "Fledgling")
  })

  it("keeps a started book ahead of one with only a later date added", () => {
    const card = pickReadingCard([
      book({
        Title: "Kindred",
        Status: "Reading",
        StartDate: "2024-01-15",
        DateAdded: "2020-01-01",
      }),
      book({
        Title: "Fledgling",
        Status: "Reading",
        DateAdded: "2026-09-01",
      }),
    ])

    assert.equal(card?.Title, "Kindred")
  })

  it("can be a borrowed Reading book", () => {
    const card = pickReadingCard([
      book({
        Title: "Kindred",
        Status: "Reading",
        StartDate: "2026-04-02",
        Borrowed: "Yes",
      }),
      book({
        Title: "Dawn",
        Status: "TBR",
      }),
    ])

    assert.equal(card?.Title, "Kindred")
  })

  it("is empty when nothing is Reading", () => {
    const card = pickReadingCard([
      book({ Title: "Kindred", Status: "TBR" }),
      book({ Title: "Dawn", Status: "Done", StartDate: "2026-01-01" }),
    ])

    assert.equal(card, null)
  })
})

describe("start-reading list", () => {
  it("lists TBR books that are not Borrowed, in title order", () => {
    const waiting = booksWaitingToStart([
      book({ Title: "Fledgling", Author: "Octavia Butler", Status: "TBR" }),
      book({ Title: "Kindred", Author: "Octavia Butler", Status: "TBR", Borrowed: "No" }),
      book({ Title: "Dawn", Author: "Octavia Butler", Status: "TBR", Borrowed: "Yes" }),
      book({ Title: "Clay's Ark", Author: "Octavia Butler", Status: "Done" }),
      book({ Title: "Wild Seed", Author: "Octavia Butler", Status: "To-Buy" }),
      book({ Title: "Adulthood Rites", Author: "Octavia Butler", Status: "Reading" }),
    ]).map((item) => item.Title)

    assert.deepEqual(waiting, ["Fledgling", "Kindred"])
  })

  it("is empty when nothing is waiting", () => {
    const waiting = booksWaitingToStart([
      book({ Title: "Dawn", Status: "TBR", Borrowed: "Yes" }),
      book({ Title: "Wild Seed", Status: "To-Buy" }),
    ])

    assert.deepEqual(waiting, [])
  })
})
