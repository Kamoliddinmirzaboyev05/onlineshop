import { describe, expect, it } from "vitest";
import { isAcceptableOrderStatus, isAdjustableOrderStatus } from "../lib/orderActions";

describe("isAcceptableOrderStatus", () => {
  it("allows couriers to accept fresh and preparation-stage orders", () => {
    expect(isAcceptableOrderStatus("pending")).toBe(true);
    expect(isAcceptableOrderStatus("confirmed")).toBe(true);
    expect(isAcceptableOrderStatus("preparing")).toBe(true);
    expect(isAcceptableOrderStatus("ready")).toBe(true);
  });

  it("does not show accept action after a courier has claimed or finished the order", () => {
    expect(isAcceptableOrderStatus("accepted")).toBe(false);
    expect(isAcceptableOrderStatus("delivering")).toBe(false);
    expect(isAcceptableOrderStatus("delivered")).toBe(false);
    expect(isAcceptableOrderStatus("cancelled")).toBe(false);
  });
});

describe("isAdjustableOrderStatus", () => {
  it("allows quantity edit after accept until delivering", () => {
    expect(isAdjustableOrderStatus("accepted")).toBe(true);
    expect(isAdjustableOrderStatus("preparing")).toBe(true);
    expect(isAdjustableOrderStatus("ready")).toBe(true);
  });

  it("blocks edit before claim and after on the road", () => {
    expect(isAdjustableOrderStatus("pending")).toBe(false);
    expect(isAdjustableOrderStatus("delivering")).toBe(false);
    expect(isAdjustableOrderStatus("delivered")).toBe(false);
  });
});
