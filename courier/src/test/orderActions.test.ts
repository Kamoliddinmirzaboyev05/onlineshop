import { describe, expect, it } from "vitest";
import { isAcceptableOrderStatus } from "../lib/orderActions";

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
