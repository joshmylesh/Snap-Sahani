import type { Tables } from "@/integrations/supabase/types";

export type Food = Tables<"foods">;
export type Profile = Tables<"profiles">;
export type Goal = Tables<"goals">;
export type MealLog = Tables<"meal_logs">;
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type PlanMeal = "Breakfast" | "Lunch" | "Dinner" | "Snack";

export type PlanItem = {
  food: Food;
  quantity: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fibre: number;
};

export type ProgressDay = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function isValidMealQuantity(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 100;
}

export function isValidAge(value: number): boolean {
  return Number.isInteger(value) && value >= 13 && value <= 110;
}

export function isValidGoal(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 10_000;
}

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localDateBounds(dateKey: string): { from: string; to: string } {
  const start = new Date(`${dateKey}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export function foodEmoji(name = ""): string {
  const value = name.toLowerCase();
  if (value.includes("ugali")) return "🍚";
  if (value.includes("sukuma")) return "🥬";
  if (value.includes("githeri") || value.includes("beans")) return "🫘";
  if (value.includes("chapati") || value.includes("bread")) return "🫓";
  if (value.includes("nyama") || value.includes("beef") || value.includes("chicken")) return "🍗";
  if (value.includes("mandazi")) return "🍩";
  if (value.includes("banana")) return "🍌";
  if (value.includes("apple")) return "🍎";
  if (value.includes("oat")) return "🥣";
  if (value.includes("pilau") || value.includes("rice")) return "🍛";
  if (value.includes("omena") || value.includes("salmon")) return "🐟";
  if (value.includes("avocado")) return "🥑";
  if (value.includes("egg")) return "🥚";
  if (value.includes("salad") || value.includes("kachumbari")) return "🥗";
  return "🍽️";
}

export function sumMeals(meals: MealLog[]) {
  return meals.reduce(
    (totals, meal) => ({
      calories: totals.calories + Number(meal.calories),
      protein: totals.protein + Number(meal.protein),
      carbs: totals.carbs + Number(meal.carbs),
      fat: totals.fat + Number(meal.fat),
      fibre: totals.fibre + Number(meal.fibre),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fibre: 0 },
  );
}