"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/aquarium";
import { ArrowLeft } from "@/components/icons";

function ResetPasswordContent({ token }: { token: string | null }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError(data.error || "Failed to reset password");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <GlassCard className="p-8 border-0 shadow-xl text-center">
            <div className="text-6xl mb-4">✓</div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Success!</h1>
            <p className="text-muted-foreground mb-4">
              Your password has been reset successfully.
            </p>
            <p className="text-muted-foreground text-sm">Redirecting to login...</p>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          Back to login
        </Link>

        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Set New Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <GlassCard className="p-8 border-0 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!token}
                className="rounded-xl h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={!token}
                className="rounded-xl h-12"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-bold text-base"
              disabled={loading || !token}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>
          </form>

          <div className="mt-8 pt-6 border-t border-border/50 text-center">
            <p className="text-sm text-muted-foreground">
              Remember your password?{" "}
              <Link href="/login" className="text-primary font-bold hover:underline">
                Login
              </Link>
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

function ResetPasswordWithSearchParams() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  return <ResetPasswordContent token={token} />;
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <GlassCard className="p-8 border-0 shadow-xl">
              <div className="h-8 w-32 rounded shimmer-aquarium mx-auto mb-4" />
              <div className="h-48 rounded shimmer-aquarium" />
            </GlassCard>
          </div>
        </div>
      }
    >
      <ResetPasswordWithSearchParams />
    </Suspense>
  );
}
