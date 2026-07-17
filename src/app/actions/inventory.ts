"use server";

import { PrismaClient } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { getUser } from "./auth";

const prisma = new PrismaClient();

export async function getInventory() {
  try {
    const count = await prisma.inventoryItem.count();
    
    // Se o inventário estiver totalmente vazio, insere os 6 itens iniciais da planilha 32º PEL
    if (count === 0) {
      const initialItems = [
        { codigo: 1, categoria: "Equipamentos", descricao: "Simulacro de Fuzil", quantidade: 1, estado: "Bom", observacoes: "" },
        { codigo: 2, categoria: "Equipamentos", descricao: "Simulacro de Pistola", quantidade: 1, estado: "Bom", observacoes: "" },
        { codigo: 3, categoria: "Equipamentos", descricao: "Capa tática", quantidade: 6, estado: "Bom", observacoes: "" },
        { codigo: 4, categoria: "Equipamentos", descricao: "Cinto de guarnição", quantidade: 1, estado: "Bom", observacoes: "" },
        { codigo: 5, categoria: "Eletrodomésticos", descricao: "Ventilador", quantidade: 4, estado: "Novo", observacoes: "" },
        { codigo: 6, categoria: "Eletrodomésticos", descricao: "Cafeteira Elétrica", quantidade: 1, estado: "Danificado", observacoes: "Jarro danificado" },
      ];

      for (const item of initialItems) {
        const created = await prisma.inventoryItem.create({
          data: item
        });
        await prisma.inventoryHistory.create({
          data: {
            itemId: created.id,
            itemDesc: created.descricao,
            userId: "SYSTEM",
            userName: "SISTEMA PUMA",
            userRole: "SYSTEM",
            actionType: "CREATE",
            changeDetail: `Inicializou carga da planilha 32º PEL: ${created.descricao} (Qtd: ${created.quantidade}, Estado: ${created.estado})`
          }
        });
      }
    }

    const items = await prisma.inventoryItem.findMany({
      orderBy: { codigo: "asc" }
    });

    const histories = await prisma.inventoryHistory.findMany({
      orderBy: { createdAt: "desc" },
      take: 150
    });

    return { success: true, items, histories };
  } catch (error: any) {
    console.error("Erro ao buscar inventário:", error);
    return { success: false, error: "Erro ao buscar itens do inventário." };
  }
}

export async function createInventoryItem(data: {
  categoria: string;
  descricao: string;
  quantidade: number;
  estado: string;
  observacoes?: string;
}) {
  const user = await getUser();
  if (!user) return { success: false, error: "Usuário não autenticado." };

  try {
    const maxItem = await prisma.inventoryItem.findFirst({
      orderBy: { codigo: "desc" }
    });
    const nextCodigo = (maxItem?.codigo || 0) + 1;

    const created = await prisma.inventoryItem.create({
      data: {
        codigo: nextCodigo,
        categoria: data.categoria || "Equipamentos",
        descricao: data.descricao.trim(),
        quantidade: Number(data.quantidade) || 1,
        estado: data.estado || "Bom",
        observacoes: (data.observacoes || "").trim()
      }
    });

    await prisma.inventoryHistory.create({
      data: {
        itemId: created.id,
        itemDesc: created.descricao,
        userId: user.userId,
        userName: user.name || "Combatente",
        userRole: user.role || "STUDENT",
        actionType: "CREATE",
        changeDetail: `Adicionou novo item: ${created.descricao} (Qtd: ${created.quantidade}, Estado: ${created.estado})`
      }
    });

    revalidatePath("/aluno/inventario");
    revalidatePath("/instructor");
    revalidatePath("/instructor/inventario");

    return { success: true, item: created };
  } catch (error: any) {
    console.error("Erro ao criar item do inventário:", error);
    return { success: false, error: "Erro ao criar item no inventário." };
  }
}

export async function updateInventoryItem(
  id: string,
  data: {
    categoria?: string;
    descricao?: string;
    quantidade?: number;
    estado?: string;
    observacoes?: string;
  }
) {
  const user = await getUser();
  if (!user) return { success: false, error: "Usuário não autenticado." };

  try {
    const oldItem = await prisma.inventoryItem.findUnique({
      where: { id }
    });

    if (!oldItem) return { success: false, error: "Item não encontrado no inventário." };

    const changes: string[] = [];

    if (data.categoria !== undefined && data.categoria !== oldItem.categoria) {
      changes.push(`Categoria de [${oldItem.categoria}] para [${data.categoria}]`);
    }
    if (data.descricao !== undefined && data.descricao.trim() !== oldItem.descricao) {
      changes.push(`Descrição de [${oldItem.descricao}] para [${data.descricao.trim()}]`);
    }
    if (data.quantidade !== undefined && Number(data.quantidade) !== oldItem.quantidade) {
      changes.push(`Quantidade de [${oldItem.quantidade}] para [${data.quantidade}]`);
    }
    if (data.estado !== undefined && data.estado !== oldItem.estado) {
      changes.push(`Estado de [${oldItem.estado}] para [${data.estado}]`);
    }
    if (data.observacoes !== undefined && (data.observacoes || "").trim() !== (oldItem.observacoes || "").trim()) {
      const oldObs = oldItem.observacoes ? `"${oldItem.observacoes}"` : "(Vazio)";
      const newObs = data.observacoes.trim() ? `"${data.observacoes.trim()}"` : "(Vazio)";
      changes.push(`Obs de ${oldObs} para ${newObs}`);
    }

    if (changes.length === 0) {
      return { success: true, item: oldItem, noChanges: true };
    }

    const updated = await prisma.inventoryItem.update({
      where: { id },
      data: {
        categoria: data.categoria !== undefined ? data.categoria : oldItem.categoria,
        descricao: data.descricao !== undefined ? data.descricao.trim() : oldItem.descricao,
        quantidade: data.quantidade !== undefined ? Number(data.quantidade) : oldItem.quantidade,
        estado: data.estado !== undefined ? data.estado : oldItem.estado,
        observacoes: data.observacoes !== undefined ? data.observacoes.trim() : oldItem.observacoes
      }
    });

    await prisma.inventoryHistory.create({
      data: {
        itemId: updated.id,
        itemDesc: updated.descricao,
        userId: user.userId,
        userName: user.name || "Combatente",
        userRole: user.role || "STUDENT",
        actionType: "UPDATE",
        changeDetail: `Alterou ${updated.descricao}: ${changes.join("; ")}`
      }
    });

    revalidatePath("/aluno/inventario");
    revalidatePath("/instructor");
    revalidatePath("/instructor/inventario");

    return { success: true, item: updated };
  } catch (error: any) {
    console.error("Erro ao atualizar item do inventário:", error);
    return { success: false, error: "Erro ao atualizar item no inventário." };
  }
}

export async function deleteInventoryItem(id: string) {
  const user = await getUser();
  if (!user) return { success: false, error: "Usuário não autenticado." };

  try {
    const oldItem = await prisma.inventoryItem.findUnique({
      where: { id }
    });

    if (!oldItem) return { success: false, error: "Item não encontrado." };

    await prisma.inventoryHistory.create({
      data: {
        itemId: null,
        itemDesc: oldItem.descricao,
        userId: user.userId,
        userName: user.name || "Combatente",
        userRole: user.role || "STUDENT",
        actionType: "DELETE",
        changeDetail: `Removeu o item da sala: ${oldItem.descricao} (Qtd que existia: ${oldItem.quantidade}, Estado: ${oldItem.estado})`
      }
    });

    await prisma.inventoryItem.delete({
      where: { id }
    });

    revalidatePath("/aluno/inventario");
    revalidatePath("/instructor");
    revalidatePath("/instructor/inventario");

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao remover item do inventário:", error);
    return { success: false, error: "Erro ao remover item do inventário." };
  }
}
