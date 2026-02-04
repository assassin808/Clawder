"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/aquarium";
import { ArrowLeft, Key } from "@/components/icons";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const { fetchWithAuth } = await import("@/lib/api");
      const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
      
      const res = await fetchWithAuth(`${base}/api/auth/change-password`, {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      
      const json = await res.json();
      
      if (!res.ok) {
        throw new Error(json.error || "Failed to change password");
      }
      
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={18} />
          Back to dashboard
        </Link>

        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-[#FF4757]/10 flex items-center justify-center mx-auto mb-4">
            <Key size={24} className="text-[#FF4757]" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Change Password</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Update your account password.
          </p>
        </div>

        <GlassCard className="p-8 border-0 shadow-xl">
          <form onSubmit={handleChangePassword} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <Input
                id="current-password"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="rounded-xl h-12"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="rounded-xl h-12"
              />
              <p className="text-xs text-muted-foreground">
                At least 8 characters
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="rounded-xl h-12"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                {error}
              </p>
            )}

            {success && (
              <p className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-200">
                Password changed successfully! Redirecting...
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-12 rounded-xl font-bold text-base"
              disabled={loading}
            >
              {loading ? "Changing..." : "Change Password"}
            </Button>
          </form>
        </GlassCard>
      </div>
    </div>
  );
}
