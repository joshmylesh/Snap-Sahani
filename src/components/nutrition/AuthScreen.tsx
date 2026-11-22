import { useState, type FormEvent } from "react";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import { ArrowRight, Chrome, Leaf, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isValidAge } from "@/lib/nutrition";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

type AuthScreenProps = {
  onNotice: (message: string) => void;
};

export function AuthScreen({ onNotice }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("25");
  const [gender, setGender] = useState("Prefer not to say");
  const [height, setHeight] = useState("170");
  const [weight, setWeight] = useState("70");
  const [activity, setActivity] = useState("moderate");
  const [goal, setGoal] = useState("maintain");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (mode === "register" && !acceptedTerms) {
      setError("Please accept the nutrition terms before creating an account.");
      return;
    }
    if (mode === "register" && !isValidAge(Number(age))) {
      setError("Age must be between 13 and 110.");
      return;
    }

    setBusy(true);
    try {
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
          options: {
            data: {
              name: name.trim(),
              age: Number(age),
              gender,
              height_cm: Number(height),
              weight_kg: Number(weight),
              activity_level: activity,
              goal,
              terms_accepted: true,
            },
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) {
          onNotice("Check your email to verify your account, then sign in.");
        } else {
          onNotice("Your account is ready.");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (signInError) throw signInError;
        onNotice("Welcome back.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function socialSignIn(provider: "google" | "lovable") {
    setError("");
    if (mode === "register" && !acceptedTerms) {
      setError("Please accept the nutrition terms before creating an account.");
      return;
    }
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (result.error) throw result.error;
      if (!result.redirected) onNotice("You’re signed in.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue with that account.");
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-aside" aria-label="NutriTrack">
        <a className="brand-lockup" href="/" aria-label="NutriTrack home">
          <span className="brand-mark"><Leaf size={21} /></span>
          <span>NutriTrack</span>
        </a>
        <div className="auth-aside-copy">
          <span className="eyebrow">A LITTLE MORE MINDFUL</span>
          <h1>Make room for <em>good habits.</em></h1>
          <p>Keep your meals, nutrition, and progress together in one calm place.</p>
          <div className="plate-illustration" aria-hidden="true">
            <div className="plate-ring"><span>🥑</span><span>🥗</span><span>🍊</span><span>🫘</span></div>
            <div className="plate-center"><Leaf size={35} /></div>
            <span className="plate-caption">GOOD FOOD, YOUR WAY</span>
          </div>
        </div>
        <p className="aside-footnote"><ShieldCheck size={15} /> Your personal journal stays private.</p>
      </section>

      <section className="auth-main">
        <div className="auth-mobile-brand">
          <span className="brand-mark"><Leaf size={20} /></span>
          <span>NutriTrack</span>
        </div>
        <div className="auth-panel">
          <span className="eyebrow">{mode === "register" ? "YOUR NEXT CHAPTER" : "MEMBER ACCESS"}</span>
          <h2>{mode === "register" ? "Create your account" : "Welcome back"}</h2>
          <p className="auth-subtitle">
            {mode === "register" ? "Start with the details you’re comfortable sharing." : "Sign in to continue your food journal."}
          </p>

          <div className="social-actions">
            <Button type="button" variant="outline" className="social-button" disabled={busy} onClick={() => socialSignIn("google")}>
              <Chrome aria-hidden="true" /> Continue with Google
            </Button>
            <Button type="button" variant="outline" className="social-button" disabled={busy} onClick={() => socialSignIn("lovable")}>
              <LovableMark /> Continue with Lovable
            </Button>
          </div>

          <div className="form-divider"><span>or use email</span></div>

          <form className="auth-form" onSubmit={submit}>
            {mode === "register" && (
              <>
                <label className="field-label">Full name
                  <Input autoComplete="name" maxLength={100} required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
                </label>
                <div className="field-grid">
                  <label className="field-label">Age
                    <Input type="number" min="13" max="110" required value={age} onChange={(event) => setAge(event.target.value)} />
                  </label>
                  <label className="field-label">Gender
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Non-binary">Non-binary</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="field-label">Height (cm)
                    <Input type="number" min="1" max="300" required value={height} onChange={(event) => setHeight(event.target.value)} />
                  </label>
                  <label className="field-label">Weight (kg)
                    <Input type="number" min="1" max="1000" step="0.1" required value={weight} onChange={(event) => setWeight(event.target.value)} />
                  </label>
                  <label className="field-label">Activity level
                    <Select value={activity} onValueChange={setActivity}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sedentary">Mostly sitting</SelectItem>
                        <SelectItem value="light">Lightly active</SelectItem>
                        <SelectItem value="moderate">Moderately active</SelectItem>
                        <SelectItem value="active">Very active</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label className="field-label">Goal
                    <Select value={goal} onValueChange={setGoal}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lose">Lose weight</SelectItem>
                        <SelectItem value="maintain">Maintain weight</SelectItem>
                        <SelectItem value="gain">Gain weight</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <div className="terms-check">
                  <Checkbox id="nutrition-terms" checked={acceptedTerms} onCheckedChange={(checked) => setAcceptedTerms(checked === true)} />
                  <label htmlFor="nutrition-terms">I understand these estimates are for general nutrition information, not medical advice.</label>
                </div>
                <details className="terms-details">
                  <summary>Nutrition terms and disclaimer</summary>
                  <p>Nutrition values are estimates based on common Kenyan portions and preparation methods. Results may vary by ingredients, recipes, and cooking methods. NutriTrack does not provide medical advice, diagnosis, or treatment. Ask a qualified health professional or registered nutritionist for individual advice.</p>
                </details>
              </>
            )}
            <label className="field-label">Email address
              <Input type="email" autoComplete="email" maxLength={255} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </label>
            <label className="field-label">Password
              <Input type="password" autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
            </label>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <Button type="submit" className="auth-submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "register" ? "Create account" : "Sign in"}
              <ArrowRight aria-hidden="true" />
            </Button>
          </form>

          <p className="auth-switch">
            {mode === "register" ? "Already have an account?" : "New to NutriTrack?"}{" "}
            <Button type="button" variant="link" className="auth-switch-button" onClick={() => { setError(""); setMode(mode === "register" ? "login" : "register"); }}>
              {mode === "register" ? "Sign in" : "Create an account"}
            </Button>
          </p>
          <p className="auth-security"><ShieldCheck size={14} /> Private nutrition records are tied to your account.</p>
        </div>
      </section>
    </main>
  );
}