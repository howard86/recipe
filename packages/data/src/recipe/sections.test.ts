import { expect, test } from "bun:test";
import { groupBySection } from "./sections";

test("groups consecutive equal sections only", () => {
  const groups = groupBySection([
    { section: null, text: "a" },
    { section: "Sauce", text: "b" },
    { section: "Sauce", text: "c" },
    { section: null, text: "d" },
  ]);
  expect(groups.map((group) => [group.section, group.items.length])).toEqual([
    [null, 1],
    ["Sauce", 2],
    [null, 1],
  ]);
});
