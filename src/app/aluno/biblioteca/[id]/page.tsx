import { PrismaClient } from "@prisma/client";
import { getUser } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import PdfReaderClient from "./PdfReaderClient";

const prisma = new PrismaClient();

export default async function ApostilaReaderPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getUser();
  if (!user || user.role !== "STUDENT") {
    redirect("/");
  }

  const apostila = await prisma.apostila.findUnique({
    where: { id: params.id }
  });

  if (!apostila || !apostila.isActive) {
    redirect("/aluno/biblioteca");
  }

  return (
    <PdfReaderClient 
      apostila={apostila} 
      userId={user.userId} 
    />
  );
}