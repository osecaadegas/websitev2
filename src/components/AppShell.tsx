"use client";

import { useState } from "react";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Footer } from "@/components/Footer";
import { AgeGate } from "@/components/AgeGate";
import { CookieConsent } from "@/components/CookieConsent";
import { AuthProvider } from "@/lib/auth-context";
import PageViewTracker from "@/components/PageViewTracker";
import { DynamicPageBackground } from "@/components/DynamicPageBackground";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <PageViewTracker />
        <DynamicPageBackground />
        <Navbar onMenuToggle={() => setSidebarOpen((v) => !v)} />
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Push content below navbar + right of sidebar */}
        <main className="relative z-10 flex-1 pt-16 lg:pl-56 flex flex-col">{children}</main>

        <div className="relative z-10 lg:pl-56">
          <Footer />
        </div>

        <AgeGate />
        <CookieConsent />
      </div>
    </AuthProvider>
  );
}
