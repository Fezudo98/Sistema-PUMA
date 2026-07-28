import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  const exists = await prisma.user.findUnique({ where: { username: 'alunoteste' } });
  
  if (exists) {
    await prisma.user.update({
      where: { username: 'alunoteste' },
      data: { isTestUser: true, role: 'STUDENT' }
    });
    console.log('Usuário alunoteste atualizado com sucesso.');
  } else {
    await prisma.user.create({
      data: {
        name: 'Aluno Teste',
        username: 'alunoteste',
        senha: hash,
        role: 'STUDENT',
        isTestUser: true
      }
    });
    console.log('Usuário alunoteste criado com sucesso.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
