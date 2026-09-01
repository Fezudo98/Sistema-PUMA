"use server";

import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { getJwtSecret } from "@/lib/env";
const JWT_SECRET = getJwtSecret();

function sanitizeString(str: string) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

// Limitador simples de tentativas de senha por usu\u00e1rio (login e troca de senha
// padr\u00e3o), em mem\u00f3ria do processo. N\u00e3o precisa ser perfeito (reinicia com o PM2),
// s\u00f3 precisa tornar for\u00e7a bruta impratic\u00e1vel.
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutos
const failedAttempts = new Map<string, { count: number; lockUntil: number }>();

function isLockedOut(username: string): number {
  const entry = failedAttempts.get(username);
  if (!entry) return 0;
  if (entry.lockUntil > Date.now()) return entry.lockUntil - Date.now();
  return 0;
}

function registerFailedAttempt(username: string) {
  const entry = failedAttempts.get(username) || { count: 0, lockUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockUntil = Date.now() + LOCKOUT_MS;
    entry.count = 0;
  }
  failedAttempts.set(username, entry);
}

function clearFailedAttempts(username: string) {
  failedAttempts.delete(username);
}

export async function registerUser(formData: FormData) {
  const name = sanitizeString(formData.get("name") as string);
  const username = sanitizeString(formData.get("username") as string);
  const password = formData.get("password") as string;
  const role = formData.get("role") as string; // 'INSTRUCTOR' | 'STUDENT'

  if (role === "INSTRUCTOR") {
    return { error: "O cadastro público de instrutores está desativado. Novos instrutores devem ser cadastrados por um instrutor existente dentro do painel administrativo." };
  }

  const numeroStr = formData.get("numero") as string;
  let numero = null;

  if (role === "STUDENT") {
    if (!numeroStr) return { error: "O número do combatente é obrigatório." };
    numero = parseInt(numeroStr, 10);
    if (isNaN(numero) || numero < 1 || numero > 35) {
      return { error: "O número deve ser entre 1 e 35." };
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
    where: { role: "STUDENT", numero: { not: null }, isTestUser: false },
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

  const lockedMs = isLockedOut(username);
  if (lockedMs > 0) {
    return { error: `Muitas tentativas incorretas. Tente novamente em ${Math.ceil(lockedMs / 60000)} minuto(s).` };
  }

  if (role === "STUDENT") {
    const maintenance = await prisma.systemSetting.findUnique({
      where: { key: "MAINTENANCE_MODE" }
    });
    if (maintenance?.value === "true") {
      return { error: "🔧 Servidor em Manutenção. Voltamos em breve com o sistema PUMA!" };
    }
  }

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user || user.role !== role) {
    registerFailedAttempt(username);
    return { error: "Credenciais inválidas." };
  }

  const isMatch = await bcrypt.compare(password, user.senha);
  if (!isMatch) {
    registerFailedAttempt(username);
    return { error: "Credenciais inválidas." };
  }

  clearFailedAttempts(username);

  // Generate JWT token
  const token = await new SignJWT({ userId: user.id, role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("14d")
    .sign(JWT_SECRET);

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14 // 14 days
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

  if (newPassword.length < 6) {
    return { error: "A nova senha deve ter no mínimo 6 caracteres." };
  }

  const lockedMs = isLockedOut(username);
  if (lockedMs > 0) {
    return { error: `Muitas tentativas incorretas. Tente novamente em ${Math.ceil(lockedMs / 60000)} minuto(s).` };
  }

  const user = await prisma.user.findUnique({
    where: { username }
  });

  if (!user || user.role !== "STUDENT") {
    registerFailedAttempt(username);
    return { error: "Combatente não encontrado." };
  }

  const isMatch = await bcrypt.compare(currentPassword, user.senha);
  if (!isMatch) {
    registerFailedAttempt(username);
    return { error: "Senha atual incorreta." };
  }

  clearFailedAttempts(username);

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

export async function createInstructorAction(formData: FormData) {
  const currentUser = await getUser();
  if (!currentUser || currentUser.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  const name = sanitizeString(formData.get("name") as string);
  const username = sanitizeString(formData.get("username") as string);
  const password = formData.get("password") as string;

  if (!name || !username || !password) {
    return { error: "Todos os campos são obrigatórios." };
  }

  // Check if exists
  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (existingUser) {
    return { error: "Este nome de usuário já está em uso." };
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  try {
    await prisma.user.create({
      data: {
        name,
        username,
        senha: hashedPassword,
        role: "INSTRUCTOR"
      }
    });
    return { success: true };
  } catch (err: any) {
    console.error("[CREATE INSTRUCTOR ERROR]:", err);
    return { error: err.message || "Erro ao salvar instrutor no banco de dados." };
  }
}

// Cria um aluno de um pelotão convidado (fora do pelotão dono do sistema): não
// entra na numeração 1-35 do contingente principal, e seu Ranking Geral fica
// separado — só compete contra alunos do mesmo pelotão. O resto do sistema
// (simulados, brevês, chat, salas ao vivo) funciona normalmente pra ele.
export async function createGuestStudentAction(formData: FormData) {
  const currentUser = await getUser();
  if (!currentUser || currentUser.role !== "INSTRUCTOR") {
    return { error: "Não autorizado." };
  }

  const name = sanitizeString(formData.get("name") as string);
  const username = sanitizeString(formData.get("username") as string);
  const password = formData.get("password") as string;
  const pelotao = sanitizeString(formData.get("pelotao") as string);

  if (!name || !username || !password || !pelotao) {
    return { error: "Todos os campos são obrigatórios, incluindo o nome do pelotão." };
  }

  const existingUser = await prisma.user.findUnique({
    where: { username }
  });

  if (existingUser) {
    return { error: "O QRA já está em uso." };
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  try {
    const student = await prisma.user.create({
      data: {
        name,
        username,
        senha: hashedPassword,
        role: "STUDENT",
        numero: null,
        pelotao
      }
    });
    return { success: true, studentId: student.id };
  } catch (err: any) {
    console.error("[CREATE GUEST STUDENT ERROR]:", err);
    return { error: err.message || "Erro ao salvar o aluno no banco de dados." };
  }
}
