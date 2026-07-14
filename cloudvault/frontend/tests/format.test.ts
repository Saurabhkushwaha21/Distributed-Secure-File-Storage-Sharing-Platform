import { describe, it, expect } from "vitest";
import { formatBytes, formatSpeed, formatEta } from "@/utils/format";

describe("formatBytes", () => {
  it("formats zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });
  it("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("formats gigabytes", () => {
    expect(formatBytes(5 * 1024 ** 3)).toBe("5.0 GB");
  });
});

describe("formatSpeed", () => {
  it("shows a dash for zero speed", () => {
    expect(formatSpeed(0)).toBe("—");
  });
  it("formats bytes/sec with unit", () => {
    expect(formatSpeed(1024 * 1024)).toBe("1.0 MB/s");
  });
});

describe("formatEta", () => {
  it("shows a dash for null", () => {
    expect(formatEta(null)).toBe("—");
  });
  it("formats seconds under a minute", () => {
    expect(formatEta(42)).toBe("42s");
  });
  it("formats minutes and seconds", () => {
    expect(formatEta(125)).toBe("2m 5s");
  });
  it("formats hours and minutes", () => {
    expect(formatEta(3900)).toBe("1h 5m");
  });
});
