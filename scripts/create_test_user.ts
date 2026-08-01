import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('123456', 10);
  
  // Clean up any old lowercase ones
  await prisma.user.deleteMany({ where: { username: 'alunoteste' } });

  const exists = await prisma.user.findUnique({ where: { username: 'ALUNOTESTE' } });
  
  if (exists) {
    await prisma.user.update({
      where: { username: 'ALUNOTESTE' },
      data: { isTestUser: true, role: 'STUDENT' }
    });
    console.log('Usuário ALUNOTESTE atualizado com sucesso.');
  } else {
    await prisma.user.create({
      data: {
        name: 'ALUNO TESTE',
        username: 'ALUNOTESTE',
        senha: hash,
        role: 'STUDENT',
        isTestUser: true
      }
    });
    console.log('Usuário ALUNOTESTE criado com sucesso.');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
