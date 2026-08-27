import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { getInstructorDuelDebtsAction } from "@/app/actions/duelo";
import DuelDebtsClient from "./DuelDebtsClient";

export default async function InstructorDuelosPage() {
  const user = await getUser();
  if (!user || user.role !== "INSTRUCTOR") {
    redirect("/auth/login");
  }

  const result = await getInstructorDuelDebtsAction();
  const duelos = (result as any).success ? (result as any).duelos : [];

  return <DuelDebtsClient initialDuelos={duelos} />;
}
