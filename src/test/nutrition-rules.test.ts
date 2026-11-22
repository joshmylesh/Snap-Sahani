import { describe, expect, it } from "vitest";

import { isValidAge, isValidGoal, isValidMealQuantity } from "@/lib/nutrition";

describe("NutriTrack input limits", () => {
  it("allows meal quantities above zero through 100 servings", () => {
    expect(isValidMealQuantity(0.25)).toBe(true);
    expect(isValidMealQuantity(100)).toBe(true);
    expect(isValidMealQuantity(0)).toBe(false);
    expect(isValidMealQuantity(100.01)).toBe(false);
  });

  it("accepts profile ages from 13 through 110", () => {
    expect(isValidAge(13)).toBe(true);
    expect(isValidAge(110)).toBe(true);
    expect(isValidAge(12)).toBe(false);
    expect(isValidAge(111)).toBe(false);
  });

  it("keeps daily goals above zero and at or below 10000", () => {
    expect(isValidGoal(1)).toBe(true);
    expect(isValidGoal(10_000)).toBe(true);
    expect(isValidGoal(0)).toBe(false);
    expect(isValidGoal(10_001)).toBe(false);
  });
});