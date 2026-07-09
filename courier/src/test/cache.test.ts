import { describe, expect, it, beforeEach } from "vitest";
import { clearCache } from "../lib/cache";

describe("clearCache", () => {
  it("handles empty localStorage without error", () => {
    expect(() => clearCache()).not.toThrow();
  });

  it("is a function", () => {
    expect(typeof clearCache).toBe("function");
  });
});