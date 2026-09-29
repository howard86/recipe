import { expect, test } from "bun:test";
import { empty, join, render, sql } from "./sql";

test("nested fragments inline and values become numbered parameters", () => {
  const filters = [sql`a = ${1}`, sql`b = ${"x'); DROP TABLE t; --"}`, empty];
  const query = sql`SELECT * FROM t WHERE ${join(filters, " AND ")} LIMIT ${10}`;
  expect(render(query)).toEqual({
    text: "SELECT * FROM t WHERE a = $1 AND b = $2 LIMIT $3",
    values: [1, "x'); DROP TABLE t; --", 10],
  });
});
