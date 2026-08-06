import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    const { error } = await supabase.functions.invoke("request-login-link", {
      body: { email: email.trim().toLowerCase() },
    });

    setLoading(false);
    if (error) {
      // Keep the response generic so the login form does not reveal which
      // email addresses have accounts.
      toast.error("Unable to send a login link. Please contact an administrator.");
      return;
    }

    setSent(true);
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/brand/seal-green.png" alt="" className="w-14 h-14 mx-auto mb-3" />
          <h1 className="font-heading text-2xl tracking-wide text-gold uppercase">
            Financial Increase
          </h1>
          <p className="text-[10px] tracking-[0.2em] uppercase text-steel mt-2">
            Dashboard Login
          </p>
        </div>

        {sent ? (
          <div className="rounded-md border border-border bg-card p-6 text-center space-y-4">
            <h2 className="font-heading text-base tracking-wider text-foreground uppercase">Check Your Email</h2>
            <p className="text-steel text-sm">
              If this email is authorized, a secure one-time login link is on its way.
            </p>
            <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>
              Use a Different Email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4 rounded-md border border-border bg-card p-6">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-steel mb-1 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="bg-background"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending…" : "Email Me a Login Link"}
            </Button>
            <p className="text-[11px] leading-relaxed text-center text-steel">
              Accounts are created by Financial Increase administrators only.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
