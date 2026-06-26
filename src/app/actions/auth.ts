"use server";

import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const prisma = new PrismaClient();
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "simula_pmce_secret_local");

function sanitizeString(str: string) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

export async function registerUser(formData: FormData) {
  const name = sanitizeString(formData.get("name") as string);
  const username = sanitizeString(formData.get("username") as string);
  const password = formData.get("password") as string;
  const role = formData.get("role") as string; // 'INSTRUCTOR' | 'STUDENT'

  const numeroStr = formData.get("numero") as string;
  let numero = null;

  if (role === "STUDENT") {
    if (!numeroStr) return { error: "O número do combatente é obrigatório." };
    numero = parseInt(numeroStr, 10);
    if (isNaN(numero) || numero < 1 || numero > 31) {
      return { error: "O número deve ser entre 1 e 31." };
    }

    // Check if number is taken
    const numberTaken = await prisma.user.findFirst({
      where: { role: "STUDENT", numero }
    });
    if (numberTaken) {
      return { error: `O número ${numero} já está sendo utilizado por outro combatente.` };
    }
  }

  if (!name || !username || !password || !role) {
    return { error: "Todos os campos são obrigatórios." };
  }

  // Check if exists
  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (existingUser) {
    return { error: `O ${role === 'INSTRUCTOR' ? 'nome' : 'QRA'} já está em uso.` };
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await prisma.user.create({
    data: {
      name,
      username,
      senha: hashedPassword,
      role,
      numero
    }
  });

  return await loginUser(formData);
}

export async function getTakenNumbers() {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT", numero: { not: null } },
    select: { numero: true }
  });
  return students.map(s => s.numero as number);
}

export async function loginUser(formData: FormData) {
  const username = sanitizeString(formData.get("username") as string);
  const password = formData.get("password") as string;
  const role = formData.get("role") as string;

  if (!username || !password) {
    return { error: "Todos os campos são obrigatórios." };
  }

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user || user.role !== role) {
    return { error: "Credenciais inválidas." };
  }

  const isMatch = await bcrypt.compare(password, user.senha);
  if (!isMatch) {
    return { error: "Credenciais inválidas." };
  }

  // Generate JWT token
  const token = await new SignJWT({ userId: user.id, role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(JWT_SECRET);

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30 // 30 days
  });

  return { success: true, role: user.role };
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("token");
}

export async function changeDefaultPasswordAction(formData: FormData) {
  const username = sanitizeString(formData.get("username") as string);
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!username || !currentPassword || !newPassword) {
    return { error: "Todos os campos são obrigatórios." };
  }

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user || user.role !== "STUDENT") {
    return { error: "Combatente não encontrado." };
  }

  const isMatch = await bcrypt.compare(currentPassword, user.senha);
  if (!isMatch) {
    return { error: "Senha atual incorreta." };
  }

  // Hash new password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({
    where: { id: user.id },
    data: { senha: hashedPassword }
  });

  return { success: true };
}

import { jwtVerify } from "jose";

export async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload as { userId: string, role: string, name: string };
  } catch (err) {
    return null;
  }
}
