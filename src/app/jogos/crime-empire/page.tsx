"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function CrimeEmpirePage() {
  const router = useRouter();
  useEffect(() => { router.push("/jogos/crime-empire/dashboard"); }, [router]);
  return <div className="flex-1 flex items-center justify-center"><div className="text-white text-xl">Loading...</div></div>;
}
