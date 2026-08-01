import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { getJwtSecret } from '@/lib/env';

const JWT_SECRET = getJwtSecret();

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

  // Se for uma rota pública de login, tenta redirecionar pro painel se já estiver logado
  if (path === '/aluno' || path === '/auth/login' || path === '/') {
    if (token) {
      try {
        const verified = await jwtVerify(token, JWT_SECRET);
        const role = verified.payload.role as string;
        if (role === 'STUDENT' && path !== '/') return NextResponse.redirect(new URL('/aluno/painel', request.url));
        if (role === 'INSTRUCTOR' && path !== '/') return NextResponse.redirect(new URL('/instructor', request.url));
      } catch (error) {
        // Token inválido, ignora e deixa a pessoa ver a tela de login
      }
    }
    return NextResponse.next();
  }

  // Se não tem token nas rotas protegidas, bloqueia
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

// O Middleware intercepta APENAS as rotas declaradas.
export const config = {
  matcher: [
    '/',
    '/auth/login',
    '/aluno',
    '/instructor/:path*', 
    '/instructor', 
    '/aluno/painel/:path*', 
    '/aluno/sala/:path*', 
    '/aluno/simulado/:path*',
    '/aluno/biblioteca/:path*'
  ],
};
