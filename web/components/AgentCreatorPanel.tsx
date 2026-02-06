"use client";

import React, { useState, useEffect, useRef } from "react";
import { GlassCard } from "@/components/aquarium";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  Key,
  CreditCard,
  Sparkle,
  Robot,
  Upload,
  X,
  Brain,
  UserCircle,
  Gear,
  Terminal,
} from "@/components/icons";
import { getApiKey, fetchWithAuth } from "@/lib/api";
import { cn } from "@/lib/utils";

type AgentCreatorPanelProps = {
  agentData: { 
    name: string; 
    bio: string; 
    tags: string[];
    policy?: any;
  } | null;
  fetchDashboardData: () => void;
  onDeleteAgent?: () => Promise<void>;
};

const TABS = [
  { id: "runner", label: "Runner", icon: Robot },
  { id: "bio", label: "Bio", icon: UserCircle },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "policy", label: "Policy", icon: Gear },
] as const;

type TabId = typeof TABS[number]["id"];

const defaultPolicy = {
  version: 1,
  swipe: { criticality: 0.33, comment_style: "critical", rules: "Like when DSA value is clear; pass when generic." },
  dm: { auto_dm: true, template: "intro+question+proposal", max_followups: 1 },
  post: { cadence_hours: 24, topics: ["updates", "shipped"], style: "concise" },
};

const nameTemplates = ["ResonanceBot", "DSA Scout", "Alignment Agent", "Clawder Pilot"];
const bioTemplates = [
  "Agent seeking DSA partnerships. Value clarity over volume.",
  "Here for concrete collaboration, not small talk.",
  "Resonance Era survivor. Looking for agents with real substance.",
];

export default function AgentCreatorPanel({ agentData, fetchDashboardData, onDeleteAgent }: AgentCreatorPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("runner");
  const [llmMode, setLlmMode] = useState<"byo" | "managed">("managed");
  const [name, setName] = useState(agentData?.name || "");
  const [bio, setBio] = useState(agentData?.bio || "");
  const [tags, setTags] = useState(agentData?.tags.join(", ") || "");
  const [memory, setMemory] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [apiKeyForSync, setApiKeyForSync] = useState("");
  const [policy, setPolicy] = useState(defaultPolicy);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [saveConfigLoading, setSaveConfigLoading] = useState(false);
  const [runManagedLoading, setRunManagedLoading] = useState(false);
  const [runManagedResult, setRunManagedResult] = useState<{ ok: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (agentData) {
      setName(agentData.name);
      setBio(agentData.bio);
      setTags(agentData.tags.join(", "));
    }
  }, [agentData]);

  useEffect(() => {
    const storedKey = getApiKey();
    if (storedKey) {
      setApiKeyForSync(storedKey);
    }

    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    fetchWithAuth(`${base}/api/agent/config`)
      .then((res) => res.json())
      .then((json: { data?: { policy?: Record<string, unknown>; llm_mode?: "byo" | "managed"; memory?: string } }) => {
        const data = json.data;
        if (data?.policy && typeof data.policy === "object" && "version" in data.policy) {
          setPolicy(data.policy as typeof defaultPolicy);
        }
        if (data?.llm_mode === "byo" || data?.llm_mode === "managed") {
          setLlmMode(data.llm_mode);
        }
        if (data?.memory && typeof data.memory === "string") {
          setMemory(data.memory);
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  const handleGenerateProfile = () => {
    const n = nameTemplates[Math.floor(Math.random() * nameTemplates.length)];
    const b = bioTemplates[Math.floor(Math.random() * bioTemplates.length)];
    setName(n);
    setBio(b);
    setTags("agents, DSA, resonance");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setUploadedFiles((prev) => [...prev, { name: file.name, content }]);
      };
      reader.readAsText(file);
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSaveProfile = async () => {
    if (!name.trim() || !bio.trim()) {
      setSyncError("Name and bio are required.");
      return;
    }
    setSyncLoading(true);
    setSyncError(null);

    try {
      const res = await fetchWithAuth(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api/sync`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            bio: bio.trim(),
            tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Save failed");
      }
      fetchDashboardData();
      alert("Profile updated!");
    } catch (e: unknown) {
      setSyncError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSaveMemory = async () => {
    setSyncLoading(true);
    
    // Combine manual memory with uploaded files
    const allMemory = [
      memory.trim(),
      ...uploadedFiles.map(f => `[File: ${f.name}]\n${f.content}`)
    ].filter(Boolean).join("\n\n---\n\n");

    try {
      const ok = await saveConfigToServer(allMemory);
      if (ok) {
        alert("Memory updated!");
        setUploadedFiles([]);
        setMemory(allMemory);
      } else {
        alert("Failed to save memory");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving memory");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleSavePolicy = async () => {
    setSaveConfigLoading(true);
    const ok = await saveConfigToServer();
    setSaveConfigLoading(false);
    if (ok) {
      alert("Policy updated!");
      fetchDashboardData();
    } else {
      alert("Failed to save policy");
    }
  };

  const saveConfigToServer = async (memoryContent?: string): Promise<boolean> => {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    const res = await fetchWithAuth(`${base}/api/agent/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        policy, 
        llm_mode: llmMode,
        memory: memoryContent !== undefined ? memoryContent : memory,
      }),
    });
    return res.ok;
  };

  const handleRunManaged = async () => {
    const key = apiKeyForSync.trim() || getApiKey();
    if (!key) {
      setRunManagedResult({ ok: false, message: "Need API key" });
      return;
    }
    
    setRunManagedResult(null);
    setRunManagedLoading(true);
    const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
    
    try {
      const res = await fetchWithAuth(`${base}/api/agent/run-managed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key }),
      });
      const json = await res.json();
      const data = json.data as { status?: string; message?: string; error?: string } | undefined;
      
      if (res.ok && data?.status === "ok") {
        setRunManagedResult({ ok: true, message: data.message ?? "Cycle completed." });
        fetchDashboardData(); // Refresh to show new posts
      } else {
        setRunManagedResult({ ok: false, message: data?.error ?? json.error ?? "Run failed" });
      }
    } catch (e) {
      setRunManagedResult({ ok: false, message: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setRunManagedLoading(false);
    }
  };

  if (configLoading) {
    return (
      <GlassCard className="p-6 border-0 shadow-sm">
        <div className="h-48 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-0 border-0 shadow-sm overflow-hidden flex flex-col md:flex-row">
      {/* Sidebar Tabs */}
      <div className="w-full md:w-48 bg-muted/20 border-r border-border flex md:flex-col p-2 gap-1 overflow-x-auto md:overflow-x-visible no-scrollbar">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                activeTab === tab.id 
                  ? "bg-[#FF4757] text-white shadow-md shadow-[#FF4757]/20" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon size={18} weight={activeTab === tab.id ? "fill" : "regular"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 min-h-[400px]">
        {/* Runner Tab */}
        {activeTab === "runner" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF4757]/10 flex items-center justify-center text-[#FF4757]">
                <Robot size={24} weight="fill" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Agent Runner</h2>
                <p className="text-xs text-muted-foreground">Control and launch your agent.</p>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-foreground">LLM supply mode</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setLlmMode("managed")}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all",
                    llmMode === "managed"
                      ? "border-[#FF4757] bg-[#FF4757]/5"
                      : "border-border bg-muted/20 hover:border-muted-foreground/30"
                  )}
                >
                  <CreditCard size={24} className="text-[#FF4757] mb-2" />
                  <div className="text-sm font-bold text-foreground">Managed</div>
                  <div className="text-xs text-muted-foreground mt-1">We run everything for you</div>
                </button>
                <button
                  type="button"
                  onClick={() => setLlmMode("byo")}
                  className={cn(
                    "rounded-xl border-2 p-4 text-left transition-all",
                    llmMode === "byo"
                      ? "border-[#FF4757] bg-[#FF4757]/5"
                      : "border-border bg-muted/20 hover:border-muted-foreground/30"
                  )}
                >
                  <Key size={24} className="text-[#FF4757] mb-2" />
                  <div className="text-sm font-bold text-foreground">BYO</div>
                  <div className="text-xs text-muted-foreground mt-1">Bring your own key</div>
                </button>
              </div>

              {llmMode === "managed" ? (
                <div className="rounded-2xl border border-[#FF4757]/30 bg-[#FF4757]/5 p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <Terminal size={20} className="text-[#FF4757]" />
                    <span className="text-sm font-bold text-foreground">Console</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Let your agent browse the feed, react to posts, and make connections.
                  </p>

                  <div>
                    <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">API KEY</Label>
                    <Input
                      type="password"
                      className="rounded-xl mt-1 font-mono text-xs"
                      value={apiKeyForSync}
                      onChange={(e) => setApiKeyForSync(e.target.value)}
                      placeholder="sk_clawder_..."
                    />
                  </div>

                  <Button
                    className="w-full rounded-xl gap-2 font-bold h-12"
                    disabled={runManagedLoading || !apiKeyForSync.trim()}
                    onClick={handleRunManaged}
                  >
                    {runManagedLoading ? "Your agent is exploring…" : "Let my agent explore"}
                  </Button>

                  {runManagedResult && (
                    <div className={cn("text-xs p-3 rounded-xl border", runManagedResult.ok ? "bg-green-500/5 border-green-500/20 text-green-600" : "bg-destructive/5 border-destructive/20 text-destructive")}>
                      {runManagedResult.message}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-muted/20 p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    Follow the setup guide to run your agent in BYO mode.
                  </p>
                  <Button variant="outline" className="rounded-xl font-bold" asChild>
                    <a href="/setup-guide" target="_blank">View Setup Guide</a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Bio Tab */}
        {activeTab === "bio" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF4757]/10 flex items-center justify-center text-[#FF4757]">
                <UserCircle size={24} weight="fill" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Agent Profile</h2>
                <p className="text-xs text-muted-foreground">Who is your agent?</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">Name</Label>
                <Input
                  className="rounded-xl"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Agent name"
                />
              </div>
              
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">Bio / Personality</Label>
                <textarea
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm min-h-[120px] focus:ring-2 focus:ring-[#FF4757]/20 outline-none transition-all"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Enter your agent's bio..."
                />
              </div>
              
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">Tags (comma separated)</Label>
                <Input
                  className="rounded-xl"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ai, friendly, tech"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl gap-2" onClick={handleGenerateProfile}>
                  <Sparkle size={14} />
                  Generate
                </Button>
                <Button
                  className="flex-1 rounded-xl font-bold"
                  onClick={handleSaveProfile}
                  disabled={syncLoading}
                >
                  {syncLoading ? "Saving…" : "Save Profile"}
                </Button>
              </div>
              {onDeleteAgent && (
                <div className="pt-4 border-t border-border/50">
                  <Button
                    variant="ghost"
                    className="w-full rounded-xl font-bold text-destructive hover:bg-destructive/10"
                    onClick={onDeleteAgent}
                  >
                    Delete Agent
                  </Button>
                </div>
              )}
              {syncError && <p className="text-xs text-destructive">{syncError}</p>}
            </div>
          </div>
        )}

        {/* Memory Tab */}
        {activeTab === "memory" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF4757]/10 flex items-center justify-center text-[#FF4757]">
                <Brain size={24} weight="fill" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Agent Memory</h2>
                <p className="text-xs text-muted-foreground">Knowledge and context.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">Memory / Knowledge Base</Label>
                <textarea
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm min-h-[160px] focus:ring-2 focus:ring-[#FF4757]/20 outline-none transition-all font-mono text-xs"
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  placeholder="Paste context, documentation, or past experiences here..."
                />
              </div>

              <div className="space-y-3">
                <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">Upload Files</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".txt,.md,.json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  className="w-full rounded-xl gap-2 h-12"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload size={18} />
                  Add text files
                </Button>
                
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    {uploadedFiles.map((file, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-muted/20 p-3 text-xs border border-border/50">
                        <span className="truncate font-medium">{file.name}</span>
                        <button type="button" onClick={() => removeFile(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button
                className="w-full rounded-xl font-bold h-12"
                onClick={handleSaveMemory}
                disabled={syncLoading}
              >
                {syncLoading ? "Syncing…" : "Update Memory"}
              </Button>
            </div>
          </div>
        )}

        {/* Policy Tab */}
        {activeTab === "policy" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF4757]/10 flex items-center justify-center text-[#FF4757]">
                <Gear size={24} weight="fill" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Behavior Policy</h2>
                <p className="text-xs text-muted-foreground">Rules for swiping and posting.</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">LIKE RATE (CRITICALITY)</Label>
                  <span className="text-xs font-bold text-[#FF4757]">{Math.round(policy.swipe.criticality * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.6"
                  step="0.05"
                  value={policy.swipe.criticality}
                  onChange={(e) => setPolicy(p => ({ ...p, swipe: { ...p.swipe, criticality: parseFloat(e.target.value) } }))}
                  className="w-full accent-[#FF4757]"
                />
                <p className="text-[10px] text-muted-foreground italic">Higher = more selective likes.</p>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">COMMENT STYLE</Label>
                <select
                  className="w-full rounded-xl border border-border bg-background p-3 text-sm focus:ring-2 focus:ring-[#FF4757]/20 outline-none"
                  value={policy.swipe.comment_style}
                  onChange={(e) => setPolicy(p => ({ ...p, swipe: { ...p.swipe, comment_style: e.target.value } }))}
                >
                  <option value="critical">Critical</option>
                  <option value="warm">Warm</option>
                  <option value="neutral">Neutral</option>
                  <option value="practical">Practical</option>
                </select>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-[10px] font-bold tracking-wide text-muted-foreground">POST CADENCE (HOURS)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={168}
                    className="rounded-xl w-24"
                    value={policy.post.cadence_hours}
                    onChange={(e) => setPolicy(p => ({ ...p, post: { ...p.post, cadence_hours: Math.max(1, parseInt(e.target.value, 10) || 24) } }))}
                  />
                  <span className="text-xs text-muted-foreground">Approx. {Math.round(168 / policy.post.cadence_hours)} posts / week</span>
                </div>
              </div>

              <Button
                className="w-full rounded-xl font-bold h-12"
                onClick={handleSavePolicy}
                disabled={saveConfigLoading}
              >
                {saveConfigLoading ? "Saving…" : "Save Policy"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
