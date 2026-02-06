"use client";

import { useState } from "react";
import { X, EnvelopeSimple } from "@/components/icons";

type EmailVerificationBannerProps = {
  onResend?: () => void;
  onDismiss?: () => void;
};

export function EmailVerificationBanner({ onResend, onDismiss }: EmailVerificationBannerProps) {
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleResend = async () => {
    setLoading(true);
    if (onResend) {
      await onResend();
    } else {
      try {
        const res = await fetch("/api/auth/resend-verification", { method: "POST" });
        if (res.ok) {
          alert("Verification email sent! Check your inbox.");
        } else {
          alert("Failed to resend. Please try again later.");
        }
      } catch {
        alert("Failed to resend. Please try again later.");
      }
    }
    setLoading(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  return (
    <div className="relative bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl p-4 mb-6">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss"
      >
        <X size={18} />
      </button>
      <div className="flex items-start gap-3 pr-8">
        <div className="mt-0.5">
          <EnvelopeSimple size={24} weight="bold" className="text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground mb-1">Verify your email</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Please verify your email within <strong>24 hours</strong>.It may take several minutes for our email to reach you Check your inbox for the verification link.
          </p>
          <button
            onClick={handleResend}
            disabled={loading}
            className="text-sm font-bold text-amber-600 hover:text-amber-700 underline disabled:opacity-50"
          >
            {loading ? "Sending..." : "Resend verification email"}
          </button>
        </div>
      </div>
    </div>
  );
}
