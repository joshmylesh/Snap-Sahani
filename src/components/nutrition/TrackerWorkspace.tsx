import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Apple,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Camera,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  Flame,
  GlassWater,
  Home,
  Leaf,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Utensils,
  UserRound,
  Weight,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  foodEmoji,
  isValidAge,
  isValidGoal,
  isValidMealQuantity,
  localDateBounds,
  localDateKey,
  sumMeals,
  type Food,
  type Goal,
  type MealLog,
  type MealType,
  type PlanItem,
  type PlanMeal,
  type Profile,
  type ProgressDay,
} from "@/lib/nutrition";

type Section = "Dashboard" | "Food scanner" | "Meal log" | "Meal plans" | "Progress" | "Profile & goals";
type TrackerWorkspaceProps = {
  user: User;
  onNotice: (message: string) => void;
  onSignOut: () => void;
};

const NAV_ITEMS: { label: Section; icon: typeof Home }[] = [
  { label: "Dashboard", icon: Home },
  { label: "Food scanner", icon: Camera },
  { label: "Meal log", icon: Utensils },
  { label: "Meal plans", icon: ClipboardList },
  { label: "Progress", icon: BarChart3 },
  { label: "Profile & goals", icon: Settings },
];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];
const PLAN_MEALS: PlanMeal[] = ["Breakfast", "Lunch", "Dinner", "Snack"];
const DEFAULT_GOALS = { calories: 2000, protein: 100, carbs: 250, fat: 67, water_ml: 2000 };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFood(value: unknown): value is Food {
  return isRecord(value) && typeof value["id"] === "number" && typeof value["name"] === "string";
}

function parsePlan(value: unknown): Record<PlanMeal, PlanItem> | null {
  if (!isRecord(value)) return null;
  const result: Partial<Record<PlanMeal, PlanItem>> = {};
  for (const meal of PLAN_MEALS) {
    const item = value[meal];
    if (!isRecord(item) || !isFood(item["food"])) return null;
    const quantity = Number(item["quantity"]);
    if (!isValidMealQuantity(quantity)) return null;
    result[meal] = {
      food: item["food"],
      quantity,
      calories: Number(item["calories"]) || 0,
      protein: Number(item["protein"]) || 0,
      carbs: Number(item["carbs"]) || 0,
      fat: Number(item["fat"]) || 0,
      fibre: Number(item["fibre"]) || 0,
    };
  }
  const breakfast = result.Breakfast;
  const lunch = result.Lunch;
  const dinner = result.Dinner;
  const snack = result.Snack;
  if (!breakfast || !lunch || !dinner || !snack) return null;
  return { Breakfast: breakfast, Lunch: lunch, Dinner: dinner, Snack: snack };
}

function mealTypeLabel(value: MealType): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="field-label">{label}{children}</label>;
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function TrackerWorkspace({ user, onNotice, onSignOut }: TrackerWorkspaceProps) {
  const [section, setSection] = useState<Section>("Dashboard");
  const [mobileMenu, setMobileMenu] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileForm, setProfileForm] = useState<Profile | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [goalForm, setGoalForm] = useState<Goal | null>(null);
  const [allFoods, setAllFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [waterGlasses, setWaterGlasses] = useState(0);
  const [mealDate, setMealDate] = useState(localDateKey());
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [logSearch, setLogSearch] = useState("");
  const [logResults, setLogResults] = useState<Food[]>([]);
  const [selectedLogFood, setSelectedLogFood] = useState<Food | null>(null);
  const [logQuantity, setLogQuantity] = useState(1);
  const [logMealType, setLogMealType] = useState<MealType>("lunch");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState(1);
  const [editMealType, setEditMealType] = useState<MealType>("lunch");
  const [scannerSearch, setScannerSearch] = useState("");
  const [scannerResults, setScannerResults] = useState<Food[]>([]);
  const [scannerFood, setScannerFood] = useState<Food | null>(null);
  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const [scannerPreview, setScannerPreview] = useState("");
  const [scannerBusy, setScannerBusy] = useState(false);
  const [scannerMatches, setScannerMatches] = useState<Array<{ food: Food; confidence: number }> | null>(null);
  const [scannerQuantity, setScannerQuantity] = useState(1);
  const [scannerMealType, setScannerMealType] = useState<MealType>("lunch");
  const [plan, setPlan] = useState<Record<PlanMeal, PlanItem> | null>(null);
  const [progressRange, setProgressRange] = useState<"week" | "month">("week");
  const [progressDays, setProgressDays] = useState<ProgressDay[]>([]);
  const [recentHistory, setRecentHistory] = useState<MealLog[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const displayName = profile?.display_name || user.user_metadata["name"] || user.email?.split("@")[0] || "there";
  const firstName = String(displayName).split(" ")[0] || "there";
  const todayMeals = useMemo(() => {
    const todayKey = localDateKey();
    return meals.filter((meal) => localDateKey(new Date(meal.logged_at)) === todayKey);
  }, [meals]);
  const todayTotals = useMemo(() => sumMeals(todayMeals), [todayMeals]);
  const goalCalories = goal?.calories ?? DEFAULT_GOALS.calories;
  const caloriesPercent = Math.min(100, Math.round((todayTotals.calories / Math.max(goalCalories, 1)) * 100));
  const progressAverage = progressDays.length
    ? Math.round(progressDays.reduce((sum, day) => sum + day.calories, 0) / progressDays.length)
    : 0;

  useEffect(() => {
    let active = true;
    async function loadAccount() {
      setLoading(true);
      try {
        const [profileResult, goalResult, foodResult, planResult] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
          supabase.from("goals").select("*").eq("user_id", user.id).maybeSingle(),
          supabase.from("foods").select("*").order("name").limit(200),
          supabase.from("meal_plans").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);
        if (profileResult.error) throw profileResult.error;
        if (goalResult.error) throw goalResult.error;
        if (foodResult.error) throw foodResult.error;
        if (planResult.error) throw planResult.error;
        if (!active) return;

        let loadedProfile = profileResult.data;
        if (!loadedProfile) {
          const metadata = user.user_metadata;
          const { data, error } = await supabase
            .from("profiles")
            .upsert({ id: user.id, display_name: String(metadata["name"] || metadata["full_name"] || "Member") })
            .select()
            .single();
          if (error) throw error;
          loadedProfile = data;
        }
        let loadedGoal = goalResult.data;
        if (!loadedGoal) {
          const { data, error } = await supabase
            .from("goals")
            .upsert({ user_id: user.id, ...DEFAULT_GOALS })
            .select()
            .single();
          if (error) throw error;
          loadedGoal = data;
        }
        setProfile(loadedProfile);
        setProfileForm(loadedProfile);
        setGoal(loadedGoal);
        setGoalForm(loadedGoal);
        setAllFoods(foodResult.data ?? []);
        setPlan(planResult.data ? parsePlan(planResult.data.meals) : null);
      } catch (caught) {
        onNotice(caught instanceof Error ? caught.message : "Your account could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadAccount();
    return () => { active = false; };
  }, [user, onNotice]);

  useEffect(() => {
    let active = true;
    async function loadDay() {
      const { from, to } = localDateBounds(mealDate);
      const { data, error } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("logged_at", from)
        .lt("logged_at", to)
        .order("logged_at", { ascending: false });
      if (error) onNotice(error.message);
      if (active) setMeals(data ?? []);
    }
    void loadDay();
    return () => { active = false; };
  }, [mealDate, user.id, onNotice]);

  useEffect(() => {
    let active = true;
    async function loadProgress() {
      const days = progressRange === "week" ? 7 : 30;
      const start = new Date();
      start.setDate(start.getDate() - (days - 1));
      const { from } = localDateBounds(localDateKey(start));
      const { to } = localDateBounds(localDateKey());
      const [mealResult, historyResult] = await Promise.all([
        supabase.from("meal_logs").select("*").eq("user_id", user.id).gte("logged_at", from).lt("logged_at", to),
        supabase.from("meal_logs").select("*").eq("user_id", user.id).order("logged_at", { ascending: false }).limit(1000),
      ]);
      if (mealResult.error) onNotice(mealResult.error.message);
      if (historyResult.error) onNotice(historyResult.error.message);
      if (!active) return;
      const byDate = new Map<string, ProgressDay>();
      for (let offset = days - 1; offset >= 0; offset -= 1) {
        const day = new Date();
        day.setDate(day.getDate() - offset);
        const key = localDateKey(day);
        byDate.set(key, { date: key, calories: 0, protein: 0, carbs: 0, fat: 0 });
      }
      for (const entry of mealResult.data ?? []) {
        const key = localDateKey(new Date(entry.logged_at));
        const day = byDate.get(key);
        if (day) {
          day.calories += Number(entry.calories);
          day.protein += Number(entry.protein);
          day.carbs += Number(entry.carbs);
          day.fat += Number(entry.fat);
        }
      }
      setProgressDays(Array.from(byDate.values()));
      setRecentHistory(historyResult.data ?? []);
    }
    void loadProgress();
    return () => { active = false; };
  }, [progressRange, user.id, meals.length, onNotice]);

  useEffect(() => {
    if (!scannerPreview) return;
    return () => URL.revokeObjectURL(scannerPreview);
  }, [scannerPreview]);

  useEffect(() => {
    let active = true;
    const query = logSearch.trim();
    if (query.length < 1) {
      setLogResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void supabase.from("foods").select("*").ilike("name", `%${query}%`).order("name").limit(20).then(({ data, error }) => {
        if (error) onNotice(error.message);
        if (active) setLogResults(data ?? []);
      });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [logSearch, onNotice]);

  useEffect(() => {
    let active = true;
    const query = scannerSearch.trim();
    if (query.length < 1) {
      setScannerResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      void supabase.from("foods").select("*").ilike("name", `%${query}%`).order("name").limit(20).then(({ data, error }) => {
        if (error) onNotice(error.message);
        if (active) setScannerResults(data ?? []);
      });
    }, 180);
    return () => { active = false; window.clearTimeout(timer); };
  }, [scannerSearch, onNotice]);

  async function refreshSelectedDay() {
    const { from, to } = localDateBounds(mealDate);
    const { data, error } = await supabase
      .from("meal_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", from)
      .lt("logged_at", to)
      .order("logged_at", { ascending: false });
    if (error) throw error;
    setMeals(data ?? []);
  }

  async function saveMeal(food: Food, quantity: number, mealType: MealType, date = mealDate) {
    if (!isValidMealQuantity(quantity)) {
      onNotice("Portion size must be greater than 0 and no more than 100.");
      return;
    }
    const { error } = await supabase.from("meal_logs").insert({
      user_id: user.id,
      food_id: food.id,
      food_name: food.name,
      meal_type: mealType,
      quantity,
      calories: Number(food.calories) * quantity,
      protein: Number(food.protein) * quantity,
      carbs: Number(food.carbs) * quantity,
      fat: Number(food.fat) * quantity,
      fibre: Number(food.fibre) * quantity,
      logged_at: new Date(`${date}T12:00:00`).toISOString(),
    });
    if (error) throw error;
    if (date === mealDate) await refreshSelectedDay();
    onNotice(`${food.name} added to your meal log.`);
  }

  async function addSelectedFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedLogFood) return;
    try {
      await saveMeal(selectedLogFood, logQuantity, logMealType);
      setSelectedLogFood(null);
      setLogSearch("");
      setLogQuantity(1);
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "The meal could not be saved.");
    }
  }

  async function deleteMeal(id: string) {
    const { error } = await supabase.from("meal_logs").delete().eq("id", id).eq("user_id", user.id);
    if (error) onNotice(error.message);
    else {
      await refreshSelectedDay();
      onNotice("Meal removed.");
    }
  }

  async function updateMeal(meal: MealLog) {
    if (!isValidMealQuantity(editQuantity)) {
      onNotice("Portion size must be greater than 0 and no more than 100.");
      return;
    }
    const ratio = editQuantity / Math.max(Number(meal.quantity), 0.0001);
    const { error } = await supabase.from("meal_logs").update({
      quantity: editQuantity,
      meal_type: editMealType,
      calories: Number(meal.calories) * ratio,
      protein: Number(meal.protein) * ratio,
      carbs: Number(meal.carbs) * ratio,
      fat: Number(meal.fat) * ratio,
      fibre: Number(meal.fibre) * ratio,
    }).eq("id", meal.id).eq("user_id", user.id);
    if (error) onNotice(error.message);
    else {
      setEditingId(null);
      await refreshSelectedDay();
      onNotice("Meal updated.");
    }
  }

  async function recognizeImage() {
    if (!scannerFile) return;
    setScannerBusy(true);
    setScannerMatches(null);
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) throw new Error("Please sign in again before analyzing a photo.");
      const form = new FormData();
      form.append("image", scannerFile);
      const response = await fetch("/api/recognize", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
        body: form,
      });
      const result = await response.json() as {
        error?: string;
        matches?: Array<{ name: string; confidence: number }>;
        notice?: string;
      };
      if (!response.ok) throw new Error(result.error || "Photo recognition is unavailable.");
      const matchNames = (result.matches ?? []).map((match) => match.name);
      const { data, error } = await supabase.from("foods").select("*").in("name", matchNames);
      if (error) throw error;
      const matchingFoods = result.matches?.flatMap((match) => {
        const food = data?.find((candidate) => candidate.name === match.name);
        return food ? [{ food, confidence: match.confidence }] : [];
      }) ?? [];
      if (matchingFoods.length === 0) throw new Error("No matching food was found. Search the catalog instead.");
      setScannerMatches(matchingFoods);
      setScannerFood(matchingFoods[0]?.food ?? null);
      setScannerQuantity(1);
      onNotice(result.notice || "Review the estimate before saving.");
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "Photo recognition is unavailable.");
    } finally {
      setScannerBusy(false);
    }
  }

  async function addScannedFood() {
    if (!scannerFood) return;
    try {
      await saveMeal(scannerFood, scannerQuantity, scannerMealType, localDateKey());
      setSection("Meal log");
      setMealDate(localDateKey());
      setScannerFile(null);
      setScannerPreview("");
      setScannerFood(null);
      setScannerMatches(null);
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "The meal could not be saved.");
    }
  }

  async function generatePlan() {
    if (allFoods.length === 0) {
      onNotice("The food catalog is not available yet.");
      return;
    }
    setSaving(true);
    const options: Record<PlanMeal, string[]> = {
      Breakfast: ["Oatmeal", "Boiled egg", "Banana", "Greek yogurt"],
      Lunch: ["Ugali", "Sukuma wiki", "Githeri", "Rice and beans"],
      Dinner: ["Nyama choma", "Pilau", "Omena", "Sweet potato, boiled"],
      Snack: ["Apple", "Avocado", "Mandazi"],
    };
    const result = {} as Record<PlanMeal, PlanItem>;
    for (const meal of PLAN_MEALS) {
      const choices = allFoods.filter((food) => options[meal].includes(food.name));
      const food = choices[Math.floor(Math.random() * choices.length)] ?? allFoods[0];
      if (!food) continue;
      result[meal] = {
        food,
        quantity: 1,
        calories: Number(food.calories),
        protein: Number(food.protein),
        carbs: Number(food.carbs),
        fat: Number(food.fat),
        fibre: Number(food.fibre),
      };
    }
    try {
      const mealsJson = JSON.parse(JSON.stringify(result)) as import("@/integrations/supabase/types").Json;
      const { data, error } = await supabase.from("meal_plans").insert({
        user_id: user.id,
        title: "Your daily nutrition plan",
        meals: mealsJson,
      }).select().single();
      if (error) throw error;
      setPlan(parsePlan(data.meals));
      onNotice("Your meal plan is ready.");
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "The plan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function addPlannedMeal(meal: PlanMeal) {
    const item = plan?.[meal];
    if (!item) return;
    const lowerType = meal.toLowerCase() as MealType;
    try {
      await saveMeal(item.food, item.quantity, lowerType, localDateKey());
      setSection("Meal log");
      setMealDate(localDateKey());
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "The meal could not be added.");
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileForm || !goalForm) return;
    if (!isValidAge(Number(profileForm.age))) {
      onNotice("Age must be between 13 and 110.");
      return;
    }
    const goalValues = [goalForm.calories, goalForm.protein, goalForm.carbs, goalForm.fat, goalForm.water_ml];
    if (!goalValues.every((value) => isValidGoal(Number(value)))) {
      onNotice("Each daily target must be between 1 and 10000.");
      return;
    }
    setSaving(true);
    try {
      const profileUpdate = {
        display_name: profileForm.display_name.trim(),
        age: Number(profileForm.age),
        gender: profileForm.gender,
        height_cm: Number(profileForm.height_cm),
        weight_kg: Number(profileForm.weight_kg),
        activity_level: profileForm.activity_level,
        goal: profileForm.goal,
        preferences: profileForm.preferences,
        restrictions: profileForm.restrictions,
        updated_at: new Date().toISOString(),
      };
      const { error: profileError } = await supabase.from("profiles").update(profileUpdate).eq("id", user.id);
      if (profileError) throw profileError;
      const { error: goalError } = await supabase.from("goals").upsert({
        user_id: user.id,
        calories: Number(goalForm.calories),
        protein: Number(goalForm.protein),
        carbs: Number(goalForm.carbs),
        fat: Number(goalForm.fat),
        water_ml: Number(goalForm.water_ml),
        updated_at: new Date().toISOString(),
      });
      if (goalError) throw goalError;
      if (profile && Number(profile.weight_kg) !== Number(profileUpdate.weight_kg)) {
        const { error: weightError } = await supabase.from("weight_logs").insert({
          user_id: user.id,
          weight_kg: Number(profileUpdate.weight_kg),
        });
        if (weightError) throw weightError;
      }
      const updatedProfile = { ...profileForm, ...profileUpdate };
      const updatedGoal = { ...goalForm, ...goalValues };
      setProfile(updatedProfile);
      setProfileForm(updatedProfile);
      setGoal(updatedGoal);
      setGoalForm(updatedGoal);
      onNotice("Profile and daily targets saved.");
    } catch (caught) {
      onNotice(caught instanceof Error ? caught.message : "Your changes could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function exportHistory() {
    const { data, error } = await supabase.from("meal_logs").select("*").eq("user_id", user.id).order("logged_at", { ascending: false }).limit(1000);
    if (error) {
      onNotice(error.message);
      return;
    }
    const rows = data ?? [];
    const quote = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ["date", "food", "meal type", "quantity", "calories", "protein", "carbs", "fat"].map(quote).join(","),
      ...rows.map((meal) => [meal.logged_at, meal.food_name, meal.meal_type, meal.quantity, meal.calories, meal.protein, meal.carbs, meal.fat].map(quote).join(",")),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "nutritrack-history.csv";
    link.click();
    URL.revokeObjectURL(url);
    onNotice("Your meal history was exported.");
  }

  function changeSection(next: Section) {
    setSection(next);
    setMobileMenu(false);
  }

  const topMeals = meals.filter((meal) => localDateKey(new Date(meal.logged_at)) === localDateKey());

  if (loading) {
    return <div className="app-loading"><span className="loading-mark"><Leaf size={22} /></span><p>Opening your journal…</p></div>;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
        <a className="brand-lockup" href="/" aria-label="NutriTrack home">
          <span className="brand-mark"><Leaf size={21} /></span><span>NutriTrack</span>
          <Button type="button" variant="ghost" size="icon" className="sidebar-close" aria-label="Close menu" onClick={() => setMobileMenu(false)}><X /></Button>
        </a>
        <span className="sidebar-label">YOUR JOURNAL</span>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ label, icon: Icon }) => (
            <Button
              type="button"
              key={label}
              variant="ghost"
              className={`nav-button ${section === label ? "nav-button-active" : ""}`}
              onClick={() => changeSection(label)}
            >
              <Icon aria-hidden="true" /><span>{label}</span>
            </Button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-note"><Sparkles size={17} /><b>One meal at a time</b><span>Progress is personal. Keep it simple.</span></div>
          <Button type="button" variant="ghost" className="nav-button signout-button" onClick={onSignOut}><LogOut aria-hidden="true" /><span>Sign out</span></Button>
          <div className="account-chip">
            <span className="account-avatar">{firstName.slice(0, 1).toUpperCase()}</span>
            <span><b>{firstName}</b><small>Personal account</small></span>
            <Button type="button" variant="ghost" size="icon" aria-label="Open profile and goals" onClick={() => changeSection("Profile & goals")}><Settings /></Button>
          </div>
        </div>
      </aside>

      {mobileMenu && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileMenu(false)} />}
      <main className="main-area">
        <header className="topbar">
          <Button type="button" variant="ghost" size="icon" className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu /></Button>
          <div className="breadcrumb"><span>Journal</span><ChevronRight size={14} /><b>{section}</b></div>
          <div className="topbar-actions">
            <span className="date-chip"><CalendarDays size={15} />{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</span>
            <Button type="button" variant="ghost" size="icon" aria-label="Open profile and goals" onClick={() => changeSection("Profile & goals")}><UserRound /></Button>
          </div>
        </header>

        <div className="page-content">
          {section === "Dashboard" && (
            <>
              <PageHeading
                eyebrow={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
                title={`Good day, ${firstName}`}
                description="A look at today’s food and nutrition."
                action={<Button onClick={() => changeSection("Food scanner")}><Camera /> Scan a meal</Button>}
              />
              <div className="dashboard-grid">
                <section className="surface-panel calorie-panel">
                  <div className="panel-heading"><div><span className="eyebrow">DAILY INTAKE</span><h2>Calories</h2></div><span className="icon-well"><Flame /></span></div>
                  <div className="calorie-content">
                    <div className="calorie-ring-wrap">
                      <svg className="calorie-ring" viewBox="0 0 180 180" role="img" aria-label={`${caloriesPercent}% of calorie target`}>
                        <circle cx="90" cy="90" r="74" className="ring-track" />
                        <circle cx="90" cy="90" r="74" className="ring-progress" strokeDasharray={`${(caloriesPercent / 100) * 465} 465`} />
                      </svg>
                      <div className="ring-label"><strong>{Math.round(todayTotals.calories).toLocaleString()}</strong><span>kcal eaten</span></div>
                    </div>
                    <div className="calorie-stats">
                      <div><span className="stat-dot stat-dot-green" /><span>Daily target</span><b>{goalCalories.toLocaleString()} <small>kcal</small></b></div>
                      <div><span className="stat-dot stat-dot-muted" /><span>Remaining</span><b>{Math.max(0, goalCalories - Math.round(todayTotals.calories)).toLocaleString()} <small>kcal</small></b></div>
                      <div className="progress-track"><span style={{ width: `${caloriesPercent}%` }} /></div>
                      <p className="tiny-copy">{caloriesPercent}% of your daily target</p>
                    </div>
                  </div>
                  <Button type="button" variant="link" className="text-action" onClick={() => changeSection("Profile & goals")}>Adjust daily targets <ArrowRight /></Button>
                </section>

                <section className="surface-panel macro-panel">
                  <div className="panel-heading"><div><span className="eyebrow">NUTRIENT BALANCE</span><h2>Macros today</h2></div><span className="icon-well"><Target /></span></div>
                  <div className="macro-list">
                    {([["Protein", todayTotals.protein, goal?.protein ?? DEFAULT_GOALS.protein, "macro-protein"], ["Carbs", todayTotals.carbs, goal?.carbs ?? DEFAULT_GOALS.carbs, "macro-carbs"], ["Fat", todayTotals.fat, goal?.fat ?? DEFAULT_GOALS.fat, "macro-fat"]] as const).map(([label, value, target, color]) => (
                      <div className="macro-row" key={label}>
                        <div className="macro-meta"><span>{label}</span><b>{Math.round(value)} <small>/ {target}g</small></b></div>
                        <div className="progress-track"><span className={color} style={{ width: `${Math.min(100, (value / Math.max(Number(target), 1)) * 100)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                  <div className="macro-legend"><span><i className="legend-protein" />Protein</span><span><i className="legend-carbs" />Carbs</span><span><i className="legend-fat" />Fat</span></div>
                </section>

                <section className="surface-panel weekly-panel">
                  <div className="panel-heading"><div><span className="eyebrow">YOUR WEEK</span><h2>Calorie pattern</h2></div><Button type="button" variant="ghost" size="icon" aria-label="View progress" onClick={() => changeSection("Progress")}><ArrowRight /></Button></div>
                  <div className="chart-box chart-box-small">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={progressDays.slice(-7)}>
                        <defs><linearGradient id="weekly-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs>
                        <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={(value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" })} tickLine={false} axisLine={false} fontSize={11} />
                        <YAxis hide />
                        <Tooltip />
                        <Area type="monotone" dataKey="calories" stroke="var(--chart-1)" fill="url(#weekly-fill)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="chart-footer"><span><TrendingUp /> Logged calories</span><Button type="button" variant="link" className="text-action" onClick={() => changeSection("Progress")}>View progress <ArrowRight /></Button></div>
                </section>

                <section className="surface-panel water-panel">
                  <div className="panel-heading"><div><span className="eyebrow">STAY REFRESHED</span><h2>Water intake</h2></div><span className="icon-well icon-well-water"><GlassWater /></span></div>
                  <div className="water-amount"><strong>{(waterGlasses * 0.25).toFixed(2).replace(/0$/, "")}</strong><span> / {((goal?.water_ml ?? DEFAULT_GOALS.water_ml) / 1000).toFixed(1)} L</span></div>
                  <div className="water-glasses" role="group" aria-label="Water glasses">
                    {Array.from({ length: 8 }, (_, index) => (
                      <Button key={index} type="button" variant="ghost" size="icon" className={index < waterGlasses ? "glass-filled" : ""} aria-label={`Set water glasses to ${index + 1}`} onClick={() => setWaterGlasses(index + 1)}><GlassWater /></Button>
                    ))}
                  </div>
                  <div className="water-footer"><span>{waterGlasses} of 8 glasses</span><Button type="button" variant="outline" size="sm" onClick={() => setWaterGlasses((value) => Math.min(8, value + 1))}><Plus /> Add glass</Button></div>
                </section>
              </div>

              <div className="section-heading-row"><div><span className="eyebrow">FOOD JOURNAL</span><h2>Today’s meals</h2></div><Button type="button" variant="outline" onClick={() => changeSection("Meal log")}>View meal log <ArrowRight /></Button></div>
              <section className="surface-panel meal-preview">
                {topMeals.length === 0 ? (
                  <div className="empty-state"><span className="empty-icon"><Apple /></span><b>No meals logged today</b><p>Your meals will appear here after you add them.</p><Button onClick={() => changeSection("Meal log")}><Plus /> Add a meal</Button></div>
                ) : MEAL_TYPES.map((type) => {
                  const entries = topMeals.filter((meal) => meal.meal_type === type);
                  if (entries.length === 0) return null;
                  return (
                    <div className="meal-group" key={type}>
                      <div className="meal-group-heading"><span className={`meal-type-mark ${type}`}><Utensils /></span><div><b>{mealTypeLabel(type)}</b><small>{entries.length} item{entries.length === 1 ? "" : "s"}</small></div><strong>{Math.round(entries.reduce((total, meal) => total + Number(meal.calories), 0))} <small>kcal</small></strong></div>
                      {entries.map((meal) => <MealLine key={meal.id} meal={meal} onEdit={() => changeSection("Meal log")} onDelete={() => void deleteMeal(meal.id)} />)}
                    </div>
                  );
                })}
              </section>
              <div className="quick-actions">
                <QuickAction icon={<Camera />} title="Scan food" detail="Identify a meal photo" onClick={() => changeSection("Food scanner")} />
                <QuickAction icon={<Plus />} title="Add manually" detail="Search the food catalog" onClick={() => changeSection("Meal log")} />
                <QuickAction icon={<ClipboardList />} title="Meal plan" detail="See today’s suggestions" onClick={() => changeSection("Meal plans")} />
              </div>
            </>
          )}

          {section === "Food scanner" && (
            <>
              <PageHeading eyebrow="PHOTO JOURNAL" title="Scan your plate" description="Review an estimate, then adjust the portion before saving." />
              <div className="scanner-grid">
                <section className="surface-panel upload-panel">
                  <div className="panel-heading"><div><span className="eyebrow">MEAL PHOTO</span><h2>Choose a photo</h2></div><span className="icon-well"><Camera /></span></div>
                  <input ref={fileInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Choose meal photo" onChange={(event) => {
                    const file = event.target.files?.item(0);
                    if (!file) return;
                    setScannerFile(file);
                    setScannerPreview(URL.createObjectURL(file));
                    setScannerMatches(null);
                    setScannerFood(null);
                  }} />
                  <button type="button" className={`dropzone ${scannerPreview ? "dropzone-preview" : ""}`} onClick={() => fileInput.current?.click()}>
                    {scannerPreview ? <img src={scannerPreview} alt="Selected meal" /> : <span className="dropzone-empty"><span className="upload-icon"><Camera /></span><b>Choose a meal photo</b><small>JPG, PNG, or WEBP · up to 10 MB</small><span className="browse-label">Browse photos</span></span>}
                  </button>
                  {scannerFile && <div className="photo-actions"><Button type="button" variant="outline" onClick={() => { setScannerFile(null); setScannerPreview(""); setScannerFood(null); setScannerMatches(null); if (fileInput.current) fileInput.current.value = ""; }}><X /> Remove photo</Button><Button type="button" disabled={scannerBusy} onClick={() => void recognizeImage()}>{scannerBusy ? "Analyzing…" : <><Sparkles /> Analyze photo</>}</Button></div>}
                  <p className="privacy-note"><ShieldCheck /> Photos are used only for food recognition and are not saved to your journal.</p>
                </section>
                <section className="surface-panel recognition-panel">
                  <div className="panel-heading"><div><span className="eyebrow">NUTRITION BREAKDOWN</span><h2>{scannerFood?.name ?? "Food estimate"}</h2></div>{scannerFood && <span className="food-emoji-large">{foodEmoji(scannerFood.name)}</span>}</div>
                  {scannerMatches && scannerFood ? (
                    <>
                      <p className="estimate-note">Estimated from a Kenyan-food image model. Confirm the dish before logging.</p>
                      {scannerMatches.length > 1 && <div className="match-list"><span className="field-caption">Other matches</span>{scannerMatches.filter((match) => match.food.id !== scannerFood.id).map((match) => <Button key={match.food.id} type="button" variant="outline" onClick={() => setScannerFood(match.food)}>{foodEmoji(match.food.name)} {match.food.name} · {Math.round(match.confidence * 100)}%</Button>)}</div>}
                      <div className="portion-row"><label htmlFor="scan-portion">Portion</label><div className="stepper"><Button type="button" variant="ghost" size="icon" aria-label="Reduce portion" onClick={() => setScannerQuantity((value) => Math.max(0.25, value - 0.25))}>−</Button><span>{scannerQuantity.toFixed(2).replace(/0$/, "").replace(/\.0$/, "")}×</span><Button type="button" variant="ghost" size="icon" aria-label="Increase portion" onClick={() => setScannerQuantity((value) => Math.min(10, value + 0.25))}>+</Button></div></div>
                      <NutritionTiles food={scannerFood} quantity={scannerQuantity} />
                      <Field label="Meal type"><Select value={scannerMealType} onValueChange={(value) => setScannerMealType(value as MealType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MEAL_TYPES.map((type) => <SelectItem key={type} value={type}>{mealTypeLabel(type)}</SelectItem>)}</SelectContent></Select></Field>
                      <Button type="button" className="wide-action" onClick={() => void addScannedFood()}><Plus /> Add to meal log</Button>
                    </>
                  ) : (
                    <div className="scanner-empty"><span className="empty-icon"><Utensils /></span><b>Your estimate will appear here</b><p>Or find a food in the catalog below.</p></div>
                  )}
                  <div className="manual-search">
                    <label className="field-label" htmlFor="scanner-search">Search foods instead</label>
                    <div className="search-field"><Search /><Input id="scanner-search" value={scannerSearch} onChange={(event) => setScannerSearch(event.target.value)} placeholder="Try ugali, githeri, chapati…" /></div>
                    {scannerResults.length > 0 && <div className="food-results">{scannerResults.map((food) => <button type="button" key={food.id} className="food-result" onClick={() => { setScannerFood(food); setScannerMatches(null); setScannerQuantity(1); }}><span>{foodEmoji(food.name)} {food.name}</span><small>{food.calories} kcal · {food.serving_size}</small></button>)}</div>}
                    {scannerFood && !scannerMatches && <><div className="portion-row"><label htmlFor="manual-scan-portion">Portion</label><Input id="manual-scan-portion" className="short-input" type="number" min="0.25" max="10" step="0.25" value={scannerQuantity} onChange={(event) => setScannerQuantity(Number(event.target.value))} /></div><NutritionTiles food={scannerFood} quantity={scannerQuantity} /><Field label="Meal type"><Select value={scannerMealType} onValueChange={(value) => setScannerMealType(value as MealType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MEAL_TYPES.map((type) => <SelectItem key={type} value={type}>{mealTypeLabel(type)}</SelectItem>)}</SelectContent></Select></Field><Button type="button" className="wide-action" onClick={() => void addScannedFood()}><Plus /> Add to meal log</Button></>}
                  </div>
                </section>
              </div>
            </>
          )}

          {section === "Meal log" && (
            <>
              <PageHeading eyebrow="FOOD JOURNAL" title="Meal log" description="Meals and nutrition for the selected day." action={<Button type="button" variant="outline" onClick={() => void exportHistory()}><Download /> Export CSV</Button>} />
              <div className="log-grid">
                <section className="surface-panel add-food-panel">
                  <div className="panel-heading"><div><span className="eyebrow">FOOD CATALOG</span><h2>Add a food</h2></div><span className="icon-well"><Search /></span></div>
                  <div className="search-field"><Search /><Input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} placeholder="Search Kenyan and international foods" /></div>
                  {logResults.length > 0 ? <div className="food-picker">{logResults.map((food) => <button type="button" key={food.id} className={`food-pick ${selectedLogFood?.id === food.id ? "food-pick-active" : ""}`} onClick={() => setSelectedLogFood(food)}><span className="food-emoji">{foodEmoji(food.name)}</span><span><b>{food.name}</b><small>{food.serving_size} · P {food.protein}g · C {food.carbs}g</small></span><strong>{food.calories}<small> kcal</small></strong></button>)}</div> : logSearch.length > 0 ? <p className="muted-copy">No foods found for “{logSearch}”.</p> : <div className="popular-foods"><b>Popular foods</b><div>{["Ugali", "Sukuma wiki", "Githeri", "Chapati", "Nyama choma", "Mandazi", "Omena", "Pilau"].map((name) => <Button key={name} type="button" variant="outline" size="sm" onClick={() => setLogSearch(name)}>{foodEmoji(name)} {name}</Button>)}</div></div>}
                  {selectedLogFood && <form className="add-meal-form" onSubmit={addSelectedFood}><div className="selected-food"><span className="food-emoji">{foodEmoji(selectedLogFood.name)}</span><div><b>{selectedLogFood.name}</b><small>{selectedLogFood.calories} kcal per listed serving</small></div></div><div className="field-grid compact-grid"><Field label="Portion"><Input type="number" min="0.25" max="10" step="0.25" value={logQuantity} onChange={(event) => setLogQuantity(Number(event.target.value))} /></Field><Field label="Meal type"><Select value={logMealType} onValueChange={(value) => setLogMealType(value as MealType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{MEAL_TYPES.map((type) => <SelectItem key={type} value={type}>{mealTypeLabel(type)}</SelectItem>)}</SelectContent></Select></Field></div><Button type="submit" className="wide-action"><Plus /> Add to {mealDate === localDateKey() ? "today" : "selected day"}</Button></form>}
                </section>

                <section className="surface-panel daily-journal-panel">
                  <div className="panel-heading"><div><span className="eyebrow">DAILY SUMMARY</span><h2>Your journal</h2></div><span className="icon-well"><CalendarDays /></span></div>
                  <Field label="Select date"><Input type="date" value={mealDate} onChange={(event) => setMealDate(event.target.value)} /></Field>
                  <div className="daily-total"><strong>{Math.round(sumMeals(meals).calories).toLocaleString()}</strong><span>kcal logged</span></div>
                  <div className="progress-track"><span style={{ width: `${Math.min(100, (sumMeals(meals).calories / Math.max(goalCalories, 1)) * 100)}%` }} /></div>
                  <div className="log-list">{MEAL_TYPES.map((type) => {
                    const entries = meals.filter((meal) => meal.meal_type === type);
                    return <div className="log-meal-group" key={type}><div className="log-meal-heading"><b>{mealTypeLabel(type)}</b><small>{Math.round(entries.reduce((sum, meal) => sum + Number(meal.calories), 0))} kcal</small></div>{entries.length === 0 ? <p className="empty-meal">Nothing logged yet</p> : entries.map((meal) => (
                      <div className="log-entry" key={meal.id}>
                        {editingId === meal.id ? (
                          <div className="edit-meal-row"><span className="food-emoji">{foodEmoji(meal.food_name)}</span><div><b>{meal.food_name}</b><div className="edit-fields"><Input aria-label="Updated portion" type="number" min="0.25" max="10" step="0.25" value={editQuantity} onChange={(event) => setEditQuantity(Number(event.target.value))} /><Select value={editMealType} onValueChange={(value) => setEditMealType(value as MealType)}><SelectTrigger aria-label="Updated meal type"><SelectValue /></SelectTrigger><SelectContent>{MEAL_TYPES.map((item) => <SelectItem key={item} value={item}>{mealTypeLabel(item)}</SelectItem>)}</SelectContent></Select></div></div><Button type="button" variant="ghost" size="icon" aria-label="Save meal changes" onClick={() => void updateMeal(meal)}><Check /></Button></div>
                        ) : (
                          <><span className="food-emoji">{foodEmoji(meal.food_name)}</span><div className="log-entry-name"><b>{meal.food_name}</b><small>{meal.quantity} serving{Number(meal.quantity) === 1 ? "" : "s"}</small></div><strong>{Math.round(Number(meal.calories))} kcal</strong><Button type="button" variant="ghost" size="icon" aria-label={`Edit ${meal.food_name}`} onClick={() => { setEditingId(meal.id); setEditQuantity(Number(meal.quantity)); setEditMealType(meal.meal_type as MealType); }}><Settings /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${meal.food_name}`} onClick={() => void deleteMeal(meal.id)}><Trash2 /></Button></>
                        )}
                      </div>
                    ))}</div>;
                  })}</div>
                </section>
              </div>
            </>
          )}

          {section === "Meal plans" && (
            <>
              <PageHeading eyebrow="PLANNING AHEAD" title="Your meal plan" description="A flexible day of ideas built from familiar foods." action={<Button type="button" disabled={saving} onClick={() => void generatePlan()}>{saving ? "Building plan…" : <><Sparkles /> {plan ? "Refresh plan" : "Generate plan"}</>}</Button>} />
              <section className="plan-banner">
                <div><span className="eyebrow">MADE FOR YOUR ROUTINE</span><h2>Good food. Less guesswork.</h2><p>Suggestions are flexible—swap or skip anything that doesn’t suit you.</p><Button type="button" variant="outline" disabled={saving} onClick={() => void generatePlan()}><Sparkles /> {plan ? "Refresh suggestions" : "Create my plan"}</Button></div>
                <div className="plan-food-art" aria-hidden="true"><span>🥑</span><span>🥗</span><span>🍊</span></div>
              </section>
              {!plan ? <div className="surface-panel empty-plan"><span className="empty-icon"><ClipboardList /></span><h2>No saved plan</h2><p>Build a simple day of meal ideas from the food catalog.</p><Button type="button" disabled={saving} onClick={() => void generatePlan()}><Sparkles /> Generate a plan</Button></div> : <><div className="plan-summary"><div><span className="eyebrow">CURRENT PLAN</span><h2>Your daily nutrition plan</h2></div><span className="plan-date"><CalendarDays />{localDateKey()}</span></div><div className="plan-grid">{PLAN_MEALS.map((meal) => {
                const item = plan[meal];
                if (!item) return null;
                return <article className="planned-meal" key={meal}><div className={`planned-image ${meal.toLowerCase()}`}><span>{foodEmoji(item.food.name)}</span><b>{meal}</b></div><div className="planned-body"><h3>{item.food.name}</h3><p>{item.food.serving_size}</p><div className="planned-kcal"><Flame />{Math.round(item.calories)} kcal</div><div className="planned-macros"><span>P <b>{item.protein}g</b></span><span>C <b>{item.carbs}g</b></span><span>F <b>{item.fat}g</b></span></div><Button type="button" variant="outline" className="wide-action" onClick={() => void addPlannedMeal(meal)}><Plus /> Add to meal log</Button></div></article>;
              })}</div></>}
              <p className="disclaimer-note">Meal ideas are general wellness suggestions, not medical or dietetic advice.</p>
            </>
          )}

          {section === "Progress" && (
            <>
              <PageHeading eyebrow="YOUR JOURNEY" title="Progress & insights" description="Patterns from the meals you’ve logged." action={<Button type="button" variant="outline" onClick={() => void exportHistory()}><Download /> Export history</Button>} />
              <div className="range-switch" role="group" aria-label="Progress range"><Button type="button" variant={progressRange === "week" ? "secondary" : "ghost"} onClick={() => setProgressRange("week")}>Last 7 days</Button><Button type="button" variant={progressRange === "month" ? "secondary" : "ghost"} onClick={() => setProgressRange("month")}>Last 30 days</Button></div>
              <div className="insight-grid"><Insight icon={<Flame />} label="Average calories" value={progressAverage.toLocaleString()} detail="kcal per day" /><Insight icon={<Utensils />} label="Meals logged" value={recentHistory.length.toLocaleString()} detail="recent entries" /><Insight icon={<Target />} label="Days tracked" value={String(progressDays.filter((day) => day.calories > 0).length)} detail={`of ${progressDays.length} days`} /></div>
              <section className="surface-panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">CALORIE TREND</span><h2>Daily energy intake</h2></div><span className="chart-legend"><i /> Calories</span></div><div className="chart-box chart-box-large"><ResponsiveContainer width="100%" height="100%"><AreaChart data={progressDays}><defs><linearGradient id="progress-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} tickLine={false} axisLine={false} fontSize={11} /><YAxis tickLine={false} axisLine={false} fontSize={11} /><Tooltip /><Area type="monotone" dataKey="calories" stroke="var(--chart-1)" fill="url(#progress-fill)" strokeWidth={2.5} /></AreaChart></ResponsiveContainer></div></section>
              <section className="surface-panel chart-panel"><div className="panel-heading"><div><span className="eyebrow">MACRONUTRIENTS</span><h2>Macro trends</h2></div></div><div className="chart-box chart-box-large"><ResponsiveContainer width="100%" height="100%"><LineChart data={progressDays}><CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} tickLine={false} axisLine={false} fontSize={11} /><YAxis tickLine={false} axisLine={false} fontSize={11} /><Tooltip /><Line type="monotone" dataKey="protein" stroke="var(--chart-1)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="carbs" stroke="var(--chart-2)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="fat" stroke="var(--chart-3)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div><div className="macro-legend"><span><i className="legend-protein" />Protein (g)</span><span><i className="legend-carbs" />Carbs (g)</span><span><i className="legend-fat" />Fat (g)</span></div></section>
              <section className="surface-panel history-panel"><div className="panel-heading"><div><span className="eyebrow">RECENT ENTRIES</span><h2>Food history</h2></div></div>{recentHistory.length ? recentHistory.slice(0, 8).map((meal) => <MealLine key={meal.id} meal={meal} onEdit={() => { setMealDate(localDateKey(new Date(meal.logged_at))); changeSection("Meal log"); }} onDelete={() => void deleteMeal(meal.id)} />) : <p className="muted-copy">Your logged meals will appear here.</p>}</section>
              <p className="disclaimer-note">A day without entries means no meals were recorded, not zero nutrition.</p>
            </>
          )}

          {section === "Profile & goals" && profileForm && goalForm && (
            <>
              <PageHeading eyebrow="YOUR ACCOUNT" title="Profile & goals" description="Personal details and daily nutrition targets." />
              <form className="profile-layout" onSubmit={saveProfile}>
                <div className="profile-main">
                  <section className="surface-panel profile-section"><div className="profile-section-heading"><span className="icon-well"><UserRound /></span><div><h2>Personal details</h2><p>These details stay private to your account.</p></div></div><div className="field-grid"><Field label="Full name"><Input required maxLength={100} value={profileForm.display_name} onChange={(event) => setProfileForm({ ...profileForm, display_name: event.target.value })} /></Field><Field label="Email address"><Input value={user.email ?? ""} disabled /></Field><Field label="Age"><Input type="number" min="13" max="110" value={profileForm.age} onChange={(event) => setProfileForm({ ...profileForm, age: Number(event.target.value) })} /></Field><Field label="Gender"><Select value={profileForm.gender} onValueChange={(value) => setProfileForm({ ...profileForm, gender: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Prefer not to say">Prefer not to say</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Male">Male</SelectItem><SelectItem value="Non-binary">Non-binary</SelectItem></SelectContent></Select></Field><Field label="Height (cm)"><Input type="number" min="1" max="300" value={profileForm.height_cm} onChange={(event) => setProfileForm({ ...profileForm, height_cm: Number(event.target.value) })} /></Field><Field label="Weight (kg)"><Input type="number" min="1" max="1000" step="0.1" value={profileForm.weight_kg} onChange={(event) => setProfileForm({ ...profileForm, weight_kg: Number(event.target.value) })} /></Field><Field label="Activity level"><Select value={profileForm.activity_level} onValueChange={(value) => setProfileForm({ ...profileForm, activity_level: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sedentary">Mostly sitting</SelectItem><SelectItem value="light">Lightly active</SelectItem><SelectItem value="moderate">Moderately active</SelectItem><SelectItem value="active">Very active</SelectItem></SelectContent></Select></Field><Field label="Goal"><Select value={profileForm.goal} onValueChange={(value) => setProfileForm({ ...profileForm, goal: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="lose">Lose weight</SelectItem><SelectItem value="maintain">Maintain weight</SelectItem><SelectItem value="gain">Gain weight</SelectItem></SelectContent></Select></Field></div></section>
                  <section className="surface-panel profile-section"><div className="profile-section-heading"><span className="icon-well"><Target /></span><div><h2>Daily nutrition targets</h2><p>Starting points you can change at any time.</p></div></div><div className="field-grid">{([["calories", "Calories (kcal)"], ["protein", "Protein (g)"], ["carbs", "Carbohydrates (g)"], ["fat", "Fat (g)"], ["water_ml", "Water (ml)"]] as const).map(([key, label]) => <Field key={key} label={label}><Input type="number" min="1" max="10000" value={goalForm[key]} onChange={(event) => setGoalForm({ ...goalForm, [key]: Number(event.target.value) })} /></Field>)}</div></section>
                  <section className="surface-panel profile-section"><div className="profile-section-heading"><span className="icon-well"><Apple /></span><div><h2>Food preferences</h2><p>Separate items with commas.</p></div></div><Field label="Preferences"><Input value={profileForm.preferences.join(", ")} onChange={(event) => setProfileForm({ ...profileForm, preferences: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Kenyan food, vegetarian" /></Field><Field label="Allergies and restrictions"><Input value={profileForm.restrictions.join(", ")} onChange={(event) => setProfileForm({ ...profileForm, restrictions: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="Peanuts, lactose" /></Field></section>
                  <Button type="submit" className="save-profile" disabled={saving}>{saving ? "Saving…" : <><Check /> Save changes</>}</Button>
                </div>
                <aside className="profile-aside"><section className="surface-panel privacy-card"><span className="privacy-icon"><ShieldCheck /></span><h2>Your privacy matters</h2><p>Profile and meal records are private to your account.</p><div><Check /> Owner-only records</div><div><Check /> Secure account sign-in</div></section><section className="surface-panel profile-note"><span className="icon-well"><Weight /></span><b>Nutrition estimates</b><p>Food values are approximate and are not a medical prescription. Consult a qualified professional for individual advice.</p></section></aside>
              </form>
            </>
          )}
        </div>
        <footer className="footer-note">NutriTrack is for general nutrition information, not medical advice.</footer>
        <nav className="mobile-dock" aria-label="Quick navigation">{NAV_ITEMS.slice(0, 5).map(({ label, icon: Icon }) => <Button type="button" key={label} variant="ghost" className={section === label ? "dock-active" : ""} onClick={() => changeSection(label)}><Icon /><small>{label === "Food scanner" ? "Scan" : label === "Meal plans" ? "Plans" : label === "Dashboard" ? "Home" : label === "Meal log" ? "Meals" : "Stats"}</small></Button>)}</nav>
      </main>
    </div>
  );
}

function MealLine({ meal, onEdit, onDelete }: { meal: MealLog; onEdit: () => void; onDelete: () => void }) {
  return <div className="meal-entry"><span className="food-emoji">{foodEmoji(meal.food_name)}</span><div className="meal-entry-name"><b>{meal.food_name}</b><small>{meal.quantity} serving{Number(meal.quantity) === 1 ? "" : "s"}</small></div><strong>{Math.round(Number(meal.calories))} <small>kcal</small></strong><Button type="button" variant="ghost" size="icon" aria-label={`Open ${meal.food_name} in meal log`} onClick={onEdit}><ArrowRight /></Button><Button type="button" variant="ghost" size="icon" aria-label={`Delete ${meal.food_name}`} onClick={onDelete}><Trash2 /></Button></div>;
}

function QuickAction({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void }) {
  return <Button type="button" variant="outline" className="quick-action" onClick={onClick}><span className="quick-icon">{icon}</span><span><b>{title}</b><small>{detail}</small></span><ArrowRight /></Button>;
}

function Insight({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) {
  return <section className="surface-panel insight-card"><span className="icon-well">{icon}</span><small>{label}</small><strong>{value}</strong><span className="muted-copy">{detail}</span></section>;
}

function NutritionTiles({ food, quantity }: { food: Food; quantity: number }) {
  const values: [string, number, string][] = [
    ["Calories", Number(food.calories) * quantity, "kcal"],
    ["Protein", Number(food.protein) * quantity, "g"],
    ["Carbs", Number(food.carbs) * quantity, "g"],
    ["Fat", Number(food.fat) * quantity, "g"],
    ["Fibre", Number(food.fibre) * quantity, "g"],
  ];
  return <div className="nutrition-tiles">{values.map(([label, value, unit]) => <div className="nutrition-tile" key={label}><small>{label}</small><strong>{Math.round(value * 10) / 10}</strong><span>{unit}</span></div>)}</div>;
}