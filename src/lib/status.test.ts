import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  BOOK_STATUSES,
  STATUS_META,
  formatCalendarDate,
  localToday,
  nextStatusAction,
  statusMovePatch,
} from "./status.ts"

describe("BOOK_STATUSES and STATUS_META", () => {
  it("lists statuses in pipeline order with metadata", () => {
    assert.deepEqual(BOOK_STATUSES, ["To-Buy", "TBR", "Reading", "Done"])
    for (const status of BOOK_STATUSES) {
      assert.equal(STATUS_META[status].label, status)
      assert.ok(STATUS_META[status].description.length > 0)
    }
  })
})

describe("nextStatusAction", () => {
  it("advances through To-Buy -> TBR -> Reading -> Done", () => {
    assert.deepEqual(nextStatusAction("To-Buy"), {
      status: "TBR",
      label: "Move to TBR",
    })
    assert.deepEqual(nextStatusAction("TBR"), {
      status: "Reading",
      label: "Start reading",
    })
    assert.deepEqual(nextStatusAction("Reading"), {
      status: "Done",
      label: "Mark done",
    })
    assert.equal(nextStatusAction("Done"), null)
  })
})

describe("localToday and formatCalendarDate", () => {
  it("zero-pads single-digit month and day", () => {
    assert.equal(localToday(new Date(2026, 0, 5)), "2026-01-05")
    assert.equal(localToday(new Date(2026, 10, 25)), "2026-11-25")
  })

  it("formats YYYY-MM-DD strings and handles missing or malformed values", () => {
    assert.equal(formatCalendarDate(undefined), "")
    assert.equal(formatCalendarDate(""), "")
    assert.equal(formatCalendarDate("invalid"), "invalid")
    const expected = new Date(Date.UTC(2026, 3, 2)).toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }
    )
    assert.equal(formatCalendarDate("2026-04-02T12:00:00Z"), expected)
  })
})

describe("statusMovePatch", () => {
  it("fills StartDate when moving to Reading if missing", () => {
    assert.deepEqual(
      statusMovePatch({ Status: "TBR" }, "Reading", "2026-11-25"),
      { Status: "Reading", StartDate: "2026-11-25" }
    )
  })

  it("preserves existing StartDate when moving to Reading", () => {
    assert.deepEqual(
      statusMovePatch(
        { Status: "Done", StartDate: "2026-01-10" },
        "Reading",
        "2026-11-25"
      ),
      { Status: "Reading" }
    )
  })

  it("fills EndDate when moving to Done if missing", () => {
    assert.deepEqual(
      statusMovePatch(
        { Status: "Reading", StartDate: "2026-11-01" },
        "Done",
        "2026-11-25"
      ),
      { Status: "Done", EndDate: "2026-11-25" }
    )
  })

  it("preserves existing EndDate when moving to Done", () => {
    assert.deepEqual(
      statusMovePatch(
        { Status: "Reading", StartDate: "2026-11-01", EndDate: "2026-11-10" },
        "Done",
        "2026-11-25"
      ),
      { Status: "Done" }
    )
  })

  it("does not add dates when moving to TBR or To-Buy", () => {
    assert.deepEqual(
      statusMovePatch({ Status: "Reading" }, "TBR", "2026-11-25"),
      { Status: "TBR" }
    )
    assert.deepEqual(
      statusMovePatch({ Status: "TBR" }, "To-Buy", "2026-11-25"),
      { Status: "To-Buy" }
    )
  })
})
