"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { CrimeEmpireSidebar } from "@/components/CrimeEmpireSidebar";
import { Footer } from "@/components/Footer";
import { AgeGate } from "@/components/AgeGate";
import { CookieConsent } from "@/components/CookieConsent";
import { AuthProvider } from "@/lib/auth-context";
import { RaidEscapeProvider } from "@/lib/crime-empire/raid-context";
import { CrimePlayerProvider } from "@/lib/crime-empire/player-context";
import PageViewTracker from "@/components/PageViewTracker";
import { DynamicPageBackground } from "@/components/DynamicPageBackground";
import { CEFloatingMenu } from "@/components/CEFloatingMenu";
import { GlobalRewardLayer } from "@/components/crime-empire/ui/GlobalRewardLayer";
import { LevelUpOverlay } from "@/components/crime-empire/ui/LevelUpOverlay";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Detect if we're in the Crime Empire game
  const isInGame = pathname?.startsWith("/jogos/crime-empire") && pathname !== "/jogos/crime-empire/create-character";

  return (
    <AuthProvider>
      <RaidEscapeProvider>
      <CrimePlayerProvider>
      <div className="min-h-screen flex flex-col">
        <PageViewTracker />
        <DynamicPageBackground />
        <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        
        {/* Conditionally show game sidebar or main sidebar */}
        {isInGame ? (
          <CrimeEmpireSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        ) : (
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        )}

        {/* Floating character menu — game only */}
        {isInGame && <CEFloatingMenu />}

        {/* Reward callout layer — game only */}
        {isInGame && <GlobalRewardLayer />}

        {/* Level-up celebration — game only */}
        {isInGame && <LevelUpOverlay />}

        {/* Push content below navbar + right of sidebar */}
        <main className="relative z-10 flex-1 pt-16 lg:pl-56 flex flex-col">{children}</main>

        <div className="relative z-10 lg:pl-56">
          <Footer />
        </div>

        <AgeGate />
        <CookieConsent />
      </div>
      </CrimePlayerProvider>
      </RaidEscapeProvider>
    </AuthProvider>
  );
}
