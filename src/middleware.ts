import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "simula_pmce_secret_local");

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const token = request.cookies.get('token')?.value;

  // Função auxiliar para redirecionar de acordo com a área
  const redirectToLogin = () => {
    if (path.startsWith('/instructor')) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }
    if (path.startsWith('/aluno')) {
      return NextResponse.redirect(new URL('/aluno', request.url));
    }
    return NextResponse.redirect(new URL('/', request.url));
  };

  // Se não tem token, bloqueia e manda pro login adequado
  if (!token) {
    return redirectToLogin();
  }

  try {
    // Decodifica o token JWT nativamente no Edge Runtime
    const verified = await jwtVerify(token, JWT_SECRET);
    const role = verified.payload.role as string;

    // Proteção rigorosa de rotas por perfil (Role-based access control)
    if (path.startsWith('/instructor') && role !== 'INSTRUCTOR') {
      return redirectToLogin();
    }
    
    if (path.startsWith('/aluno') && role !== 'STUDENT') {
      return redirectToLogin();
    }

    return NextResponse.next();
  } catch (error) {
    // Token inválido, expirado ou forjado
    return redirectToLogin();
  }
}

// O Middleware intercepta APENAS as rotas privadas.
// As telas de login (/auth/login e /aluno) ficam de fora para evitar loop infinito.
export const config = {
  matcher: [
    '/instructor/:path*', 
    '/instructor', 
    '/aluno/painel/:path*', 
    '/aluno/sala/:path*', 
    '/aluno/simulado/:path*'
  ],
};
