import { describe, expect, test } from "bun:test";
import {
  formatMinutes,
  parseDuration,
  resolveTotalMinutes,
  toIsoDuration,
} from "./duration";

describe("durations", () => {
  test("parses ISO 8601 leniently", () => {
    expect(parseDuration("PT1H30M")).toBe(90);
    expect(parseDuration("PT90M")).toBe(90);
    expect(parseDuration("P0DT1H")).toBe(60);
    expect(parseDuration("P1D")).toBe(1440);
  });

  test("zero and junk are unknown", () => {
    expect(parseDuration("PT0M")).toBeNull();
    expect(parseDuration("P")).toBeNull();
    expect(parseDuration("soon")).toBeNull();
    expect(parseDuration(undefined)).toBeNull();
  });

  test("loose text fallback", () => {
    expect(parseDuration("1 hour 20 mins")).toBe(80);
  });

  test("serialises and formats", () => {
    expect(toIsoDuration(90)).toBe("PT1H30M");
    expect(toIsoDuration(45)).toBe("PT45M");
    expect(toIsoDuration(0)).toBeUndefined();
    expect(formatMinutes(125)).toBe("2 hr 5 min");
  });

  test("total falls back to prep + cook", () => {
    expect(resolveTotalMinutes({ cookMinutes: 20, prepMinutes: 10 })).toBe(30);
    expect(resolveTotalMinutes({ cookMinutes: 20, totalMinutes: 45 })).toBe(45);
    expect(resolveTotalMinutes({})).toBeNull();
  });
});
