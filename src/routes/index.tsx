import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createFileRoute } from "@tanstack/react-router";
import { Leaf } from "lucide-react";

import { AuthScreen } from "@/components/nutrition/AuthScreen";
import { TrackerWorkspace } from "@/components/nutrition/TrackerWorkspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NutriTrack | Your food journal" },
      {
        name: "description",
        content: "Track meals, nutrition, and everyday progress in your private NutriTrack journal.",
      },
      { property: "og:title", content: "NutriTrack | Your food journal" },
      {
        property: "og:description",
        content: "Track meals, nutrition, and everyday progress in your private NutriTrack journal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const showNotice = useCallback((message: string) => setNotice(message), []);

  useEffect(() => {
    let active = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setUser(session?.user ?? null);
      }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) showNotice(error.message);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });
    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [showNotice]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) showNotice(error.message);
    else showNotice("You have signed out.");
  }

  return (
    <>
      {authLoading ? (
        <div className="app-loading"><span className="loading-mark"><Leaf size={22} /></span><p>Opening NutriTrack…</p></div>
      ) : user ? (
        <TrackerWorkspace user={user} onNotice={showNotice} onSignOut={() => void signOut()} />
      ) : (
        <AuthScreen onNotice={showNotice} />
      )}
      {notice && <div className="app-notice" role="status">{notice}</div>}
    </>
  );
}
