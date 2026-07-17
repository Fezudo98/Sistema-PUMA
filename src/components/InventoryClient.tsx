"use client";

import React, { useState, useEffect } from "react";
import { 
  Package, PlusCircle, History, Edit, Trash2, Filter, Search, 
  AlertTriangle, CheckCircle2, Clock, Check, X, Layers, Box, 
  RefreshCw, ShieldAlert, FileText, ArrowLeft, UserCheck
} from "lucide-react";
import { getInventory, createInventoryItem, updateInventoryItem, deleteInventoryItem } from "@/app/actions/inventory";

interface InventoryItem {
  id: string;
  codigo: number;
  categoria: string;
  descricao: string;
  quantidade: number;
  estado: string;
  observacoes?: string | null;
  updatedAt: string | Date;
}

interface InventoryHistory {
  id: string;
  itemDesc: string;
  userName: string;
  userRole: string;
  actionType: string;
  changeDetail: string;
  createdAt: string | Date;
}

interface InventoryClientProps {
  role: "INSTRUCTOR" | "STUDENT";
  user: { id: string; name: string; role: string };
  onBack?: () => void;
}

export default function InventoryClient({ role, user, onBack }: InventoryClientProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [histories, setHistories] = useState<InventoryHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"table" | "history">("table");

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modais e edição
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Form de Adição / Edição
  const [formData, setFormData] = useState({
    categoria: "Equipamentos",
    descricao: "",
    quantidade: 1,
    estado: "Bom",
    observacoes: ""
  });

  const fetchAll = async () => {
    setLoading(true);
    const res = await getInventory();
    if (res.success && res.items) {
      setItems(res.items as any);
      setHistories((res.histories || []) as any);
    } else {
      alert("Erro ao carregar inventário: " + (res.error || "Desconhecido"));
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const totalItens = items.reduce((acc, item) => acc + (item.quantidade || 0), 0);
  const itensDanificados = items.reduce((acc, item) => {
    if (item.estado === "Danificado" || item.estado === "Em Manutenção") {
      return acc + (item.quantidade || 0);
    }
    return acc;
  }, 0);

  const categoriasUnicas = Array.from(new Set(items.map(i => i.categoria))).filter(Boolean);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.descricao.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.observacoes && item.observacoes.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          item.codigo.toString().includes(searchQuery);
    const matchesCategory = categoryFilter === "ALL" || item.categoria === categoryFilter;
    const matchesStatus = statusFilter === "ALL" || item.estado === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleOpenAdd = () => {
    setFormData({
      categoria: "Equipamentos",
      descricao: "",
      quantidade: 1,
      estado: "Bom",
      observacoes: ""
    });
    setEditingItem(null);
    setIsAdding(true);
  };

  const handleOpenEdit = (item: InventoryItem) => {
    setFormData({
      categoria: item.categoria || "Equipamentos",
      descricao: item.descricao || "",
      quantidade: item.quantidade || 1,
      estado: item.estado || "Bom",
      observacoes: item.observacoes || ""
    });
    setIsAdding(false);
    setEditingItem(item);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.descricao.trim()) {
      alert("Por favor, preencha a descrição do item.");
      return;
    }
    setSaving(true);
    const res = await createInventoryItem(formData);
    setSaving(false);
    if (res.success) {
      setIsAdding(false);
      fetchAll();
    } else {
      alert("Erro ao adicionar item: " + (res.error || "Tente novamente."));
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!formData.descricao.trim()) {
      alert("Por favor, preencha a descrição do item.");
      return;
    }
    setSaving(true);
    const res = await updateInventoryItem(editingItem.id, formData);
    setSaving(false);
    if (res.success) {
      setEditingItem(null);
      fetchAll();
    } else {
      alert("Erro ao atualizar item: " + (res.error || "Tente novamente."));
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!confirm(`Tem certeza que deseja excluir o item [${item.codigo}] ${item.descricao} da sala?`)) {
      return;
    }
    const res = await deleteInventoryItem(item.id);
    if (res.success) {
      fetchAll();
    } else {
      alert("Erro ao excluir item: " + (res.error || "Desconhecido"));
    }
  };

  const handleQuickStatusChange = async (item: InventoryItem, newStatus: string) => {
    if (item.estado === newStatus) return;
    const res = await updateInventoryItem(item.id, { estado: newStatus });
    if (res.success) {
      fetchAll();
    } else {
      alert("Erro ao alterar estado: " + (res.error || "Desconhecido"));
    }
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "Novo":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold";
      case "Bom":
        return "bg-teal-500/20 text-teal-300 border-teal-500/30 font-medium";
      case "Regular":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30 font-medium";
      case "Danificado":
        return "bg-red-500/20 text-red-400 border-red-500/30 font-black animate-pulse";
      case "Em Manutenção":
        return "bg-purple-500/20 text-purple-300 border-purple-500/30 font-medium";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Topo com Botão Voltar se for página dedicada e cabeçalho */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-6 bg-slate-900 border border-slate-800 p-5 sm:p-6 rounded-2xl shadow-[0_0_30px_rgba(0,0,0,0.5)]">
        <div className="w-full md:w-auto">
          <div className="flex items-start sm:items-center gap-3">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors shrink-0 mt-0.5 sm:mt-0"
                title="Voltar ao Painel"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] shrink-0">
              <Package className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-white tracking-wide uppercase leading-tight break-words">
                  Inventário da Sala <span className="text-blue-400 block sm:inline">32º Pelotão</span>
                </h1>
                <span className={`text-[9px] sm:text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider shrink-0 ${role === 'INSTRUCTOR' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'}`}>
                  {role === 'INSTRUCTOR' ? 'Instrutor' : 'Combatente'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1 leading-snug">
                Controle militar e auditoria em tempo real
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto shrink-0">
          <button
            onClick={fetchAll}
            disabled={loading}
            className="w-full sm:w-auto px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 shrink-0 ${loading ? 'animate-spin' : ''}`} />
            <span>Sincronizar</span>
          </button>
          <button
            onClick={handleOpenAdd}
            className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>Adicionar Item</span>
          </button>
        </div>
      </div>

      {/* Cards de Estatísticas Inspirados na Planilha (Total e Danificados) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Total de Itens
            </span>
            <span className="text-4xl font-black text-white tracking-tight">
              {totalItens}
            </span>
            <span className="text-xs text-emerald-400 font-bold block mt-1">
              {items.length} cadastros distintos
            </span>
          </div>
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
            <Layers className="w-8 h-8 text-emerald-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Itens Danificados / Manutenção
            </span>
            <span className={`text-4xl font-black tracking-tight ${itensDanificados > 0 ? 'text-red-400 animate-pulse' : 'text-slate-200'}`}>
              {itensDanificados}
            </span>
            <span className="text-xs text-slate-400 font-medium block mt-1">
              {itensDanificados === 0 ? "Sala 100% operacional" : "Requer atenção ou reparo"}
            </span>
          </div>
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-6 rounded-2xl shadow-xl flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">
              Auditoria PUMA
            </span>
            <span className="text-3xl font-black text-blue-400 tracking-tight">
              {histories.length}
            </span>
            <span className="text-xs text-slate-400 font-medium block mt-1">
              Registros de edições salvas
            </span>
          </div>
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
            <History className="w-8 h-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Abas e Barra de Filtros */}
      <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-2xl space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 bg-slate-950 p-1.5 rounded-xl border border-slate-800 gap-1.5">
            <button
              onClick={() => setActiveTab("table")}
              className={`px-4 py-2.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === "table" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>Tabela do Inventário</span>
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2.5 rounded-lg font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                activeTab === "history" ? "bg-blue-600 text-white shadow-lg" : "text-slate-400 hover:text-white"
              }`}
            >
              <History className="w-4 h-4 shrink-0" />
              <span>Histórico de Alterações ({histories.length})</span>
            </button>
          </div>

          {activeTab === "table" && (
            <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
              <div className="relative w-full sm:flex-1 sm:min-w-[220px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar item ou código..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto">
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-500 w-full"
                >
                  <option value="ALL">Todas Categorias</option>
                  {categoriasUnicas.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-500 w-full"
                >
                  <option value="ALL">Todos Estados</option>
                  <option value="Novo">Novo</option>
                  <option value="Bom">Bom</option>
                  <option value="Regular">Regular</option>
                  <option value="Danificado">Danificado</option>
                  <option value="Em Manutenção">Em Manutenção</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Modal / Formulário Inserido na Tela para Adicionar ou Editar Item */}
        {(isAdding || editingItem) && (
          <form onSubmit={isAdding ? handleSaveAdd : handleSaveEdit} className="bg-slate-950 border-2 border-blue-500/50 p-6 rounded-2xl shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                {isAdding ? <PlusCircle className="w-5 h-5 text-blue-400" /> : <Edit className="w-5 h-5 text-amber-400" />}
                {isAdding ? "Cadastrar Novo Item na Sala" : `Editar Item [${editingItem?.codigo}] - ${editingItem?.descricao}`}
              </h3>
              <button
                type="button"
                onClick={() => { setIsAdding(false); setEditingItem(null); }}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Categoria</label>
                <input
                  type="text"
                  list="categorias-list"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                  placeholder="Ex: Equipamentos"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
                />
                <datalist id="categorias-list">
                  <option value="Equipamentos" />
                  <option value="Eletrodomésticos" />
                  <option value="Móveis" />
                  <option value="Material de Limpeza" />
                  <option value="Outros" />
                </datalist>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Descrição do Item</label>
                <input
                  type="text"
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Ex: Simulacro de Fuzil, Capa tática, Ventilador..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantidade}
                  onChange={(e) => setFormData({ ...formData, quantidade: parseInt(e.target.value) || 1 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Estado</label>
                <select
                  value={formData.estado}
                  onChange={(e) => setFormData({ ...formData, estado: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-blue-500"
                >
                  <option value="Novo">Novo</option>
                  <option value="Bom">Bom</option>
                  <option value="Regular">Regular</option>
                  <option value="Danificado">Danificado</option>
                  <option value="Em Manutenção">Em Manutenção</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Observações / Detalhes</label>
                <input
                  type="text"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Ex: Jarro danificado, Faltando parafuso, Na estante superior..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => { setIsAdding(false); setEditingItem(null); }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-7 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? "Salvando..." : isAdding ? "Confirmar Cadastro" : "Salvar Alterações"}
              </button>
            </div>
          </form>
        )}

        {/* Conteúdo da Aba 1: Tabela para Desktop/Tablet e Cards para Celular */}
        {activeTab === "table" && (
          <div className="space-y-4">
            {/* Visualização em TABELA para TABLET/DESKTOP (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="py-3.5 px-4 text-center w-16">Cód</th>
                    <th className="py-3.5 px-4 w-40">Categoria</th>
                    <th className="py-3.5 px-4">Descrição do Item</th>
                    <th className="py-3.5 px-4 text-center w-24">Qtd</th>
                    <th className="py-3.5 px-4 w-44">Estado</th>
                    <th className="py-3.5 px-4">Observações</th>
                    <th className="py-3.5 px-4 text-right w-28">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                        <span className="font-bold text-xs uppercase tracking-widest">Carregando Itens da Sala...</span>
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-16 text-center text-slate-500">
                        <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <span className="font-bold text-xs uppercase tracking-widest block">Nenhum item encontrado no filtro</span>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map(item => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4 text-center font-black text-slate-400 bg-slate-950/40">
                          {item.codigo}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-xs px-2.5 py-1 bg-slate-800/80 border border-slate-700 rounded-lg text-slate-300 font-bold">
                            {item.categoria}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white">
                          {item.descricao}
                        </td>
                        <td className="py-3.5 px-4 text-center font-black text-base text-blue-400">
                          {item.quantidade}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="relative inline-block">
                            <select
                              value={item.estado}
                              onChange={(e) => handleQuickStatusChange(item, e.target.value)}
                              className={`text-xs px-3 py-1.5 rounded-lg border appearance-none pr-7 font-bold cursor-pointer transition-all focus:outline-none ${getStatusBadge(item.estado)}`}
                              title="Clique para alterar rapidamente o estado"
                            >
                              <option value="Novo" className="bg-slate-900 text-emerald-400 font-bold">Novo</option>
                              <option value="Bom" className="bg-slate-900 text-teal-300 font-bold">Bom</option>
                              <option value="Regular" className="bg-slate-900 text-amber-300 font-bold">Regular</option>
                              <option value="Danificado" className="bg-slate-900 text-red-400 font-bold">Danificado</option>
                              <option value="Em Manutenção" className="bg-slate-900 text-purple-300 font-bold">Em Manutenção</option>
                            </select>
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none opacity-60">▼</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-300 italic">
                          {item.observacoes ? (
                            <span className="flex items-center gap-1.5 text-amber-300/90 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                              {item.observacoes}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-2 bg-slate-800/80 hover:bg-blue-600 text-slate-300 hover:text-white rounded-lg transition-all"
                              title="Editar Item Completo"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="p-2 bg-slate-800/80 hover:bg-red-600 text-slate-300 hover:text-white rounded-lg transition-all"
                              title="Excluir Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Visualização em CARDS para CELULAR (md:hidden) */}
            <div className="grid grid-cols-1 gap-3.5 md:hidden">
              {loading ? (
                <div className="py-16 text-center text-slate-400 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
                  <span className="font-bold text-xs uppercase tracking-widest">Carregando Itens da Sala...</span>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="py-16 text-center text-slate-500 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <span className="font-bold text-xs uppercase tracking-widest block">Nenhum item encontrado no filtro</span>
                </div>
              ) : (
                filteredItems.map(item => (
                  <div key={item.id} className="bg-slate-950 border border-slate-800/80 rounded-2xl p-4 space-y-3.5 shadow-lg">
                    {/* Linha Superior: Código e Categoria + Estado dropdown */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 font-black text-xs text-blue-400 shrink-0">
                          #{item.codigo}
                        </span>
                        <span className="text-xs px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg text-slate-300 font-bold truncate max-w-[130px]">
                          {item.categoria}
                        </span>
                      </div>
                      <div className="relative inline-block shrink-0">
                        <select
                          value={item.estado}
                          onChange={(e) => handleQuickStatusChange(item, e.target.value)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg border appearance-none pr-6 font-bold cursor-pointer transition-all focus:outline-none ${getStatusBadge(item.estado)}`}
                          title="Clique para alterar o estado"
                        >
                          <option value="Novo" className="bg-slate-900 text-emerald-400 font-bold">Novo</option>
                          <option value="Bom" className="bg-slate-900 text-teal-300 font-bold">Bom</option>
                          <option value="Regular" className="bg-slate-900 text-amber-300 font-bold">Regular</option>
                          <option value="Danificado" className="bg-slate-900 text-red-400 font-bold">Danificado</option>
                          <option value="Em Manutenção" className="bg-slate-900 text-purple-300 font-bold">Em Manutenção</option>
                        </select>
                        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] pointer-events-none opacity-60">▼</span>
                      </div>
                    </div>

                    {/* Linha do Meio: Descrição e Quantidade */}
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-base font-black text-white tracking-wide leading-snug break-words">
                        {item.descricao}
                      </h4>
                      <div className="flex items-center gap-1.5 bg-blue-600/15 border border-blue-500/30 px-3 py-1.5 rounded-xl shrink-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Qtd:</span>
                        <span className="text-base font-black text-blue-400">{item.quantidade}</span>
                      </div>
                    </div>

                    {/* Observações (se houver) */}
                    {item.observacoes && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-2.5 flex items-start gap-2 text-xs text-amber-300/90 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                        <span className="leading-relaxed">{item.observacoes}</span>
                      </div>
                    )}

                    {/* Linha Inferior: Botões de Ação */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-900">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="flex-1 px-3 py-2.5 bg-slate-900 hover:bg-blue-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-800"
                      >
                        <Edit className="w-3.5 h-3.5 text-blue-400" />
                        Editar Item
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="px-3.5 py-2.5 bg-slate-900 hover:bg-red-600 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 border border-slate-800"
                        title="Excluir Item"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Conteúdo da Aba 2: Histórico de Auditoria */}
        {activeTab === "history" && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-blue-400" />
                Registros de auditoria invioláveis gerados automaticamente por ações de Instrutores e Combatentes.
              </span>
              <span className="font-bold text-slate-300">
                Total registrado: {histories.length} eventos
              </span>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
              {histories.length === 0 ? (
                <div className="py-16 text-center text-slate-500 bg-slate-950/50 border border-slate-800/60 rounded-xl">
                  <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <span className="font-bold text-xs uppercase tracking-widest block">Nenhuma alteração registrada ainda</span>
                </div>
              ) : (
                histories.map(h => {
                  const dateFormatted = new Date(h.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit"
                  });

                  let actionColor = "bg-blue-500/10 border-blue-500/20 text-blue-300";
                  let actionLabel = "EDIÇÃO";
                  if (h.actionType === "CREATE") {
                    actionColor = "bg-emerald-500/10 border-emerald-500/20 text-emerald-300";
                    actionLabel = "CADASTRO";
                  } else if (h.actionType === "DELETE") {
                    actionColor = "bg-red-500/10 border-red-500/20 text-red-300";
                    actionLabel = "REMOÇÃO";
                  }

                  return (
                    <div key={h.id} className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors">
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className={`px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider shrink-0 ${actionColor}`}>
                          {actionLabel}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">
                              {h.userName}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                              h.userRole === 'INSTRUCTOR' ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' : 
                              h.userRole === 'SYSTEM' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/30' : 
                              'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                            }`}>
                              {h.userRole === 'INSTRUCTOR' ? 'Instrutor' : h.userRole === 'SYSTEM' ? 'Sistema' : 'Combatente'}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              • Item: <strong className="text-slate-200">{h.itemDesc}</strong>
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 mt-1 font-medium bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
                            {h.changeDetail}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold shrink-0 self-end sm:self-center">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        {dateFormatted}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
