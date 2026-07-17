"use client";

import React from "react";
import { useRouter } from "next/navigation";
import InventoryClient from "@/components/InventoryClient";

interface StudentInventoryWrapperProps {
  user: {
    id: string;
    name: string;
    role: string;
  };
}

export default function StudentInventoryWrapper({ user }: StudentInventoryWrapperProps) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-white max-w-7xl mx-auto">
      <InventoryClient 
        role="STUDENT" 
        user={user} 
        onBack={() => router.push("/aluno/painel")} 
      />
    </div>
  );
}
