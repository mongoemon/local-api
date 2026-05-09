import { describe, it, expect, afterEach } from "vitest";
import { getNumberEnv, getBooleanEnv } from "../../config.js";

describe("getNumberEnv", () => {
  afterEach(() => {
    delete process.env.TEST_NUM_VAR;
  });

  it("returns defaultValue when env var is not set", () => {
    expect(getNumberEnv("TEST_NUM_VAR", 42)).toBe(42);
  });

  it("parses a valid numeric string", () => {
    process.env.TEST_NUM_VAR = "100";
    expect(getNumberEnv("TEST_NUM_VAR", 0)).toBe(100);
  });

  it("returns defaultValue for a non-numeric string", () => {
    process.env.TEST_NUM_VAR = "not-a-number";
    expect(getNumberEnv("TEST_NUM_VAR", 7)).toBe(7);
  });

  it("parses floats", () => {
    process.env.TEST_NUM_VAR = "3.14";
    expect(getNumberEnv("TEST_NUM_VAR", 0)).toBeCloseTo(3.14);
  });
});

describe("getBooleanEnv", () => {
  afterEach(() => {
    delete process.env.TEST_BOOL_VAR;
  });

  it("returns defaultValue when env var is not set", () => {
    expect(getBooleanEnv("TEST_BOOL_VAR", false)).toBe(false);
    expect(getBooleanEnv("TEST_BOOL_VAR", true)).toBe(true);
  });

  it.each(["true", "1", "yes", "on"])('returns true for "%s"', value => {
    process.env.TEST_BOOL_VAR = value;
    expect(getBooleanEnv("TEST_BOOL_VAR", false)).toBe(true);
  });

  it("is case-insensitive", () => {
    process.env.TEST_BOOL_VAR = "TRUE";
    expect(getBooleanEnv("TEST_BOOL_VAR", false)).toBe(true);
  });

  it('returns false for "false"', () => {
    process.env.TEST_BOOL_VAR = "false";
    expect(getBooleanEnv("TEST_BOOL_VAR", true)).toBe(false);
  });

  it('returns false for "0"', () => {
    process.env.TEST_BOOL_VAR = "0";
    expect(getBooleanEnv("TEST_BOOL_VAR", true)).toBe(false);
  });
});
