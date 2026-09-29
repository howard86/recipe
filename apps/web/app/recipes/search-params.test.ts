import { describe, expect, test } from "bun:test";
import { browseHref, parseBrowseQuery } from "./search-params";

describe("browse query", () => {
  test("parses and sanitises params", () => {
    expect(
      parseBrowseQuery({
        cuisine: "italian",
        diet: "Bad Slug!",
        maxTime: "30",
        page: "2",
        q: "  lasagna ",
        sort: "quickest",
        tag: ["make-ahead", "make-ahead", "main"],
      })
    ).toEqual({
      cuisine: "italian",
      cursor: undefined,
      diet: undefined,
      maxTime: 30,
      mine: false,
      page: 2,
      q: "lasagna",
      sort: "quickest",
      tags: ["make-ahead", "main"],
    });
  });

  test("ignores unknown sorts and odd times", () => {
    const query = parseBrowseQuery({ maxTime: "17", sort: "random" });
    expect(query.sort).toBeUndefined();
    expect(query.maxTime).toBeUndefined();
  });

  test("browseHref resets pagination when filters change", () => {
    const query = parseBrowseQuery({ page: "3", q: "soup", tag: "quick" });
    expect(browseHref(query, { cuisine: "thai" })).toBe(
      "/recipes?q=soup&tag=quick&cuisine=thai"
    );
    expect(browseHref(query, { page: 4 })).toBe(
      "/recipes?q=soup&tag=quick&page=4"
    );
  });
});
