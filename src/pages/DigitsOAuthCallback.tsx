import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = "exchanging" | "success" | "error";

export default function DigitsOAuthCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("exchanging");
  const [message, setMessage] = useState("Completing Digits authorization…");
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const code = params.get("code");
    const state = params.get("state");
    const errorParam = params.get("error");

    if (errorParam) {
      setStatus("error");
      setMessage(params.get("error_description") || errorParam);
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setMessage("Missing code or state in callback URL.");
      return;
    }

    const storedState = sessionStorage.getItem("digits_oauth_state");
    const storedRedirect = sessionStorage.getItem("digits_oauth_redirect_uri");
    sessionStorage.removeItem("digits_oauth_state");
    sessionStorage.removeItem("digits_oauth_redirect_uri");

    if (!storedState || storedState !== state) {
      setStatus("error");
      setMessage("State mismatch. Possible CSRF — authorization aborted.");
      return;
    }
    if (!storedRedirect) {
      setStatus("error");
      setMessage("Missing redirect URI in session. Restart the connection from Settings.");
      return;
    }

    (async () => {
      const { data, error } = await supabase.functions.invoke("digits-oauth-exchange", {
        body: { code, redirect_uri: storedRedirect },
      });

      if (error || (data as { error?: string })?.error) {
        const errMsg = (data as { error?: string })?.error || error?.message || "Token exchange failed.";
        setStatus("error");
        setMessage(errMsg);
        toast.error(`Digits connection failed: ${errMsg}`);
        return;
      }

      setStatus("success");
      setMessage("Digits connected successfully.");
      toast.success("Digits connected");
      setTimeout(() => navigate("/settings", { replace: true }), 1200);
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-md border border-border bg-card p-8 text-center space-y-3">
        <h1 className="font-heading text-xl tracking-wider text-gold uppercase">
          Digits Connection
        </h1>
        <p
          className={`text-sm ${
            status === "success"
              ? "text-emerald-700 dark:text-emerald-400"
              : status === "error"
                ? "text-red-700 dark:text-red-400"
                : "text-steel"
          }`}
        >
          {message}
        </p>
        {status === "error" && (
          <button
            onClick={() => navigate("/settings", { replace: true })}
            className="text-xs uppercase tracking-wider text-gold hover:underline mt-2"
          >
            Back to Settings
          </button>
        )}
      </div>
    </div>
  );
}
