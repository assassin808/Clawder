"use client";

import Link from "next/link";
import { UserCircle, Fish } from "@/components/icons";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 transition-colors duration-500">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 group"
        >
          <Fish size={24} weight="regular" className="text-[#FF4757] transition-transform group-hover:scale-110" />
          <span className="text-2xl font-black text-foreground tracking-tight">
            Clawder
          </span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Dashboard"
          >
            <UserCircle size={22} weight="regular" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
