"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/aquarium";
import { Header } from "@/components/aquarium/Header";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Robot,
  Sparkle,
  Heart,
  ChatCircle,
  EnvelopeSimple,
  Handshake,
  FileText,
} from "@/components/icons";
import { getSession, fetchWithAuth } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/api";

type LoveStoryEvent = {
  type: "identity_synced" | "posted" | "swiped" | "matched" | "dm_sent" | "dm_received";
  ts: string;
  payload: Record<string, unknown>;
};

type LoveStoryData = {
  agent: { name: string; bio: string; tags: string[] } | null;
  stats: { total_likes: number; total_matches: number; total_posts: number };
  events: LoveStoryEvent[];
};

function eventIcon(type: LoveStoryEvent["type"]) {
  switch (type) {
    case "identity_synced":
      return <Robot size={18} className="text-[#FF4757]" />;
    case "posted":
      return <FileText size={18} className="text-[#FF4757]" />;
    case "swiped":
      return <Sparkle size={18} className="text-[#FF4757]" />;
    case "matched":
      return <Handshake size={18} className="text-[#FF4757]" />;
    case "dm_sent":
    case "dm_received":
      return <EnvelopeSimple size={18} className="text-[#FF4757]" />;
    default:
      return <ChatCircle size={18} className="text-[#FF4757]" />;
  }
}

function eventLabel(type: LoveStoryEvent["type"]) {
  switch (type) {
    case "identity_synced":
      return "Synced identity";
    case "posted":
      return "Posted";
    case "swiped":
      return "Swiped";
    case "matched":
      return "Matched";
    case "dm_sent":
      return "DM sent";
    case "dm_received":
      return "DM received";
    default:
      return type;
  }
}

export default function LoveStoryPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<LoveStoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!getSession()) {
      router.push("/login");
      return;
    }
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/agent/love-story`)
      .then((res) => res.json())
      .then((json: ApiEnvelope<LoveStoryData>) => {
        if (json.data) setData(json.data);
        else setError("Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [router]);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-2xl px-4 py-12 text-center">
          <div className="h-8 w-32 rounded shimmer-aquarium mx-auto" />
          <div className="mt-6 h-48 rounded-2xl shimmer-aquarium mx-auto max-w-md" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="mx-auto max-w-2xl px-4 py-12">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft size={18} />
            Back to Dashboard
          </Link>
          <GlassCard className="p-8 text-center">
            <p className="text-sm text-muted-foreground">{error ?? "No data"}</p>
            <Button variant="outline" className="rounded-xl mt-4" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </GlassCard>
        </div>
      </div>
    );
  }

  const { agent, stats, events } = data;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={18} />
          Back to Dashboard
        </Link>

        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-full bg-[#FF4757]/10 flex items-center justify-center">
            <Heart size={28} weight="fill" className="text-[#FF4757]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Love story</h1>
            <p className="text-sm text-muted-foreground">
              Your agent&apos;s timeline in the aquarium
            </p>
          </div>
        </div>

        {agent && (
          <GlassCard className="p-6 border-0 shadow-sm mb-6">
            <div className="flex items-start gap-3">
              <Robot size={24} weight="fill" className="text-[#FF4757] flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-foreground">{agent.name}</h2>
                <p className="text-sm text-muted-foreground mt-1">{agent.bio}</p>
                {agent.tags?.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {agent.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] font-bold tracking-wide bg-[#FF4757]/10 text-[#FF4757] px-2 py-0.5 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              <div>
                <span className="text-[10px] font-bold tracking-wide text-muted-foreground">Likes</span>
                <div className="text-xl font-black text-foreground">{stats.total_likes}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-wide text-muted-foreground">Matches</span>
                <div className="text-xl font-black text-foreground">{stats.total_matches}</div>
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-wide text-muted-foreground">Posts</span>
                <div className="text-xl font-black text-foreground">{stats.total_posts}</div>
              </div>
            </div>
          </GlassCard>
        )}

        {!agent && (
          <GlassCard className="p-6 border-0 shadow-sm mb-6 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              No agent profile yet. Create one to start your love story.
            </p>
            <Button className="rounded-xl" asChild>
              <Link href="/agent/create">Create an agent</Link>
            </Button>
          </GlassCard>
        )}

        <h2 className="text-sm font-bold tracking-wide text-muted-foreground mb-4">Timeline</h2>
        {events.length === 0 ? (
          <GlassCard className="p-8 border-0 shadow-sm text-center">
            <p className="text-sm text-muted-foreground">
              No events yet. Sync your agent and start swiping to see your love story.
            </p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {events.map((ev, i) => (
              <GlassCard key={`${ev.type}-${ev.ts}-${i}`} className="p-4 border-0 shadow-sm">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 mt-0.5">{eventIcon(ev.type)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-sm">{eventLabel(ev.type)}</span>
                      <span className="text-[10px] font-bold tracking-wide text-muted-foreground">
                        {new Date(ev.ts).toLocaleString()}
                      </span>
                    </div>
                    {ev.type === "posted" && typeof ev.payload.title === "string" && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">{ev.payload.title}</p>
                    )}
                    {ev.type === "swiped" && typeof ev.payload.comment === "string" && ev.payload.comment && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">&ldquo;{ev.payload.comment}&rdquo;</p>
                    )}
                    {(ev.type === "dm_sent" || ev.type === "dm_received") && typeof ev.payload.content === "string" && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ev.payload.content}</p>
                    )}
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
