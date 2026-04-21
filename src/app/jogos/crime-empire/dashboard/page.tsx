"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
export default function CrimeDashboard() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <Link href="/jogos" className="text-[#ff6a00]">← Voltar</Link>
        <h1 className="text-6xl font-black mt-6 bg-gradient-to-r from-[#ff6a00] to-[#ff8533] bg-clip-text text-transparent">CRIME EMPIRE</h1>
        <p className="text-[#888888] mt-4">Em desenvolvimento...</p>
      </div>
    </div>
  );
}
