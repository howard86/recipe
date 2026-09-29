import { describe, expect, test } from "bun:test";
import { fromRows, moveRow, newRow, splitPastedLines, toRows } from "./rows";

describe("editor rows", () => {
  test("round-trips sections", () => {
    const items = [
      { section: null, text: "a" },
      { section: "Sauce", text: "b" },
      { section: "Sauce", text: "c" },
    ];
    const rows = toRows(items, (item) => item.text);
    expect(rows.map((row) => [row.kind, row.text])).toEqual([
      ["item", "a"],
      ["section", "Sauce"],
      ["item", "b"],
      ["item", "c"],
    ]);
    expect(fromRows(rows)).toEqual(items);
  });

  test("drops blank rows", () => {
    expect(fromRows([newRow("item", "  "), newRow("item", "salt")])).toEqual([
      { section: null, text: "salt" },
    ]);
  });

  test("splits pasted blocks", () => {
    expect(splitPastedLines("1 cup flour\r\n\n 2 eggs ")).toEqual([
      "1 cup flour",
      "2 eggs",
    ]);
  });

  test("moves rows and ignores out-of-range moves", () => {
    const rows = ["a", "b", "c"].map((text) => newRow("item", text));
    expect(moveRow(rows, 0, 2).map((row) => row.text)).toEqual(["b", "c", "a"]);
    expect(moveRow(rows, 0, 5).map((row) => row.text)).toEqual(["a", "b", "c"]);
  });
});
