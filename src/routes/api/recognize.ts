import { createClient } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";

const MODEL_ID = "waltertaya/kenyan-food-13";
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const LABELS: Record<string, string> = {
  bhaji: "Bhaji",
  chapati: "Chapati",
  githeri: "Githeri",
  kachumbari: "Kachumbari",
  kukuchoma: "Kuku choma",
  mandazi: "Mandazi",
  masalachips: "Masala chips",
  matoke: "Matoke, stewed",
  mukimo: "Mukimo",
  nyamachoma: "Nyama choma",
  pilau: "Pilau",
  sukumawiki: "Sukuma wiki",
  ugali: "Ugali",
};

type Prediction = { label: string; score: number };

export const Route = createFileRoute("/api/recognize")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("Authorization");
        const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
        if (!token) return Response.json({ error: "Please sign in to recognize a meal." }, { status: 401 });

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !publishableKey) {
          return Response.json({ error: "Account verification is temporarily unavailable." }, { status: 503 });
        }

        const authClient = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(input instanceof Request ? input.headers : undefined);
              if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
              if (headers.get("Authorization") === `Bearer ${publishableKey}`) headers.delete("Authorization");
              headers.set("apikey", publishableKey);
              return fetch(input, { ...init, headers });
            },
          },
        });
        const { data: verifiedUser, error: authError } = await authClient.auth.getUser(token);
        if (authError || !verifiedUser.user) {
          return Response.json({ error: "Your sign-in has expired. Please sign in again." }, { status: 401 });
        }

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Choose a meal photo to continue." }, { status: 400 });
        }
        const image = form.get("image");
        if (!(image instanceof File) || image.size === 0) {
          return Response.json({ error: "Choose a meal photo to continue." }, { status: 400 });
        }
        if (!ALLOWED_IMAGE_TYPES.has(image.type)) {
          return Response.json({ error: "Use a JPG, PNG, or WEBP photo." }, { status: 400 });
        }
        if (image.size > 10 * 1024 * 1024) {
          return Response.json({ error: "Photos must be 10 MB or smaller." }, { status: 413 });
        }

        const tokenValue = process.env["HF_TOKEN"];
        if (!tokenValue) {
          return Response.json(
            { error: "Photo recognition is not connected yet. Search the food catalog instead." },
            { status: 503 },
          );
        }

        let response: Response;
        try {
          response = await fetch(`https://router.huggingface.co/hf-inference/models/${MODEL_ID}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${tokenValue}`,
              "Content-Type": image.type,
            },
            body: image,
          });
        } catch {
          return Response.json({ error: "Photo recognition is temporarily unavailable." }, { status: 503 });
        }
        if (!response.ok) {
          console.error("Hugging Face image recognition returned status", response.status);
          return Response.json({ error: "Photo recognition is temporarily unavailable. Search manually." }, { status: 503 });
        }

        let predictions: unknown;
        try {
          predictions = await response.json();
        } catch {
          return Response.json({ error: "The photo could not be identified. Search manually." }, { status: 422 });
        }
        if (!Array.isArray(predictions)) {
          return Response.json({ error: "The photo could not be identified. Search manually." }, { status: 422 });
        }

        const matches = (predictions as Prediction[])
          .filter((item) => typeof item?.label === "string" && Number.isFinite(item.score))
          .map((item) => {
            const key = item.label.toLowerCase().replace(/[\s_-]/g, "");
            return { name: LABELS[key], confidence: Math.round(item.score * 10_000) / 10_000 };
          })
          .filter((item): item is { name: string; confidence: number } => Boolean(item.name))
          .slice(0, 4);

        if (matches.length === 0) {
          return Response.json(
            { error: "The photo did not match a food in this catalog. Search for the dish manually." },
            { status: 422 },
          );
        }
        return Response.json({
          recognizer: "kenyan-food-13",
          notice: "Nutrition is an estimate. Confirm the dish and portion before saving.",
          matches,
        });
      },
    },
  },
});