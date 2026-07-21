import React from "react";
import { redirect } from "next/navigation";
import { getMaintenanceStatusAction } from "@/app/actions/maintenance";
import { getUser } from "@/app/actions/auth";

export default async function AlunoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const maintenance = await getMaintenanceStatusAction();

  if (maintenance.enabled) {
    // Verifica se é instrutor logado tentando testar ou ver a área do aluno
    const user = await getUser();
    if (!user || user.role !== "INSTRUCTOR") {
      redirect("/manutencao");
    }
  }

  return <>{children}</>;
}
