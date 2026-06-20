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
      role
    }
  });

  return await loginUser(formData);
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
    secure: process.env.NODE_ENV === "production",
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
