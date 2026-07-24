import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    (async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (res.ok && data.valid) setStatus("valid");
        else if (data.reason === "already_unsubscribed") setStatus("already");
        else setStatus("invalid");
      } catch {
        setStatus("invalid");
      }
    })();
  }, [token]);

  const handleUnsubscribe = async () => {
    try {
      const { error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setStatus("success");
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-lg border border-border bg-card p-8 text-center space-y-4">
        <h1 className="text-xl font-heading text-gold tracking-wide">
          Email Preferences
        </h1>

        {status === "loading" && (
          <p className="text-steel text-sm">Verifying…</p>
        )}

        {status === "valid" && (
          <>
            <p className="text-foreground text-sm">
              Click below to unsubscribe from notification emails.
            </p>
            <button
              onClick={handleUnsubscribe}
              className="px-6 py-2 rounded-lg bg-gold text-accent-foreground font-semibold text-sm hover:opacity-90 transition"
            >
              Confirm Unsubscribe
            </button>
          </>
        )}

        {status === "already" && (
          <p className="text-steel text-sm">You're already unsubscribed.</p>
        )}

        {status === "success" && (
          <p className="text-emerald text-sm">
            You've been unsubscribed. You won't receive notification emails anymore.
          </p>
        )}

        {status === "invalid" && (
          <p className="text-destructive text-sm">
            This unsubscribe link is invalid or has expired.
          </p>
        )}

        {status === "error" && (
          <p className="text-destructive text-sm">
            Something went wrong. Please try again later.
          </p>
        )}
      </div>
    </div>
  );
}
