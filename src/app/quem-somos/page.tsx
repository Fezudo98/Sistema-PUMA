"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Award, 
  Crosshair, 
  Flame, 
  Users, 
  MapPin, 
  Star, 
  BookOpen, 
  Sun, 
  Layers, 
  ChevronRight,
  UserCheck,
  Sparkles,
  ArrowLeft,
  LogIn
} from "lucide-react";

const QRAS = [
  { num: 1, qra: "Lima" },
  { num: 2, qra: "Martins" },
  { num: 3, qra: "Costa" },
  { num: 4, qra: "Barreto" },
  { num: 5, qra: "Abreu" },
  { num: 6, qra: "Paulo" },
  { num: 7, qra: "S. Santos" },
  { num: 8, qra: "Afonso" },
  { num: 9, qra: "José" },
  { num: 10, qra: "J. Ribeiro" },
  { num: 11, qra: "William" },
  { num: 12, qra: "Tarso" },
  { num: 13, qra: "Souza" },
  { num: 14, qra: "Pereira" },
  { num: 15, qra: "Gadelha" },
  { num: 16, qra: "Cruz" },
  { num: 17, qra: "Almeida" },
  { num: 18, qra: "Victor" },
  { num: 19, qra: "Marcelino" },
  { num: 20, qra: "Ruana" },
  { num: 21, qra: "L. Fernando" },
  { num: 22, qra: "Fonseca" },
  { num: 23, qra: "Batista" },
  { num: 24, qra: "Menezes" },
  { num: 25, qra: "Coelho" },
  { num: 26, qra: "Samara" },
  { num: 27, qra: "Almir" },
  { num: 28, qra: "Alberto" },
  { num: 29, qra: "Morais" },
  { num: 30, qra: "Uchoa" },
  { num: 31, qra: "Lídia" },
  { num: 32, qra: "Stephanie" },
];

const HERALDICA = [
  {
    title: "O Puma (Suçuarana / Onça-parda)",
    category: "Mascote Central",
    icon: Flame,
    color: "from-amber-500 to-orange-600",
    description: "O mascote central é um felino astuto e imponente, nativo de vários biomas brasileiros, em especial da nossa Caatinga. Representa agilidade, furtividade, velocidade extrema, força bruta e o status de caçador no topo da cadeia alimentar — simbolizando o combate implável e caçada incansável contra a criminalidade. Sua expressão feroz denota a agressividade tática e a prontidão ininterrupta exigidas na função policial militar."
  },
  {
    title: "A Boina Preta com Distintivo",
    category: "Identidade & Comando",
    icon: Shield,
    color: "from-slate-700 to-slate-900",
    description: "A boina humaniza o felino e o integra à nobre identidade militar. Ela representa o fardamento sagrado, o orgulho inabalável da tropa e a disciplina de ferro forjada no fogo do Curso de Formação de Soldados (CFSD). O distintivo ostentando a estrela vermelha é o símbolo clássico de autoridade, hierarquia e comando tático."
  },
  {
    title: "Os Fuzis Cruzados (em Aspa)",
    category: "Poder de Fogo & Defesa",
    icon: Crosshair,
    color: "from-red-600 to-amber-600",
    description: "Representam o poder de fogo letal do Estado, a capacidade de pronta resposta e a força armada legitimamente empregada na defesa da sociedade. A clássica disposição cruzada em aspa é o símbolo militar secular que indica bloqueio intransponível, proteção e defesa contra quaisquer investidas inimigas."
  },
  {
    title: "Os Ramos de Louro",
    category: "Honra & Triunfo",
    icon: Award,
    color: "from-emerald-500 to-teal-700",
    description: "Posicionados ao redor da cabeça do puma, os louros compõem o símbolo universal e milenar da vitória, do triunfo e da glória. Representam a consagração, o êxito e a honra imortal daqueles combatentes que concluem com garra o rigoroso e exigente Curso de Formação de Soldados."
  },
  {
    title: "O Círculo com Meandro Grego",
    category: "União & Perfeição",
    icon: Layers,
    color: "from-blue-600 to-indigo-800",
    description: "O anel dourado que envolve o mascote funciona como um escudo visual impenetrável. O padrão geométrico contínuo do meandro grego simboliza o infinito, a união inquebrável e eterna entre os irmãos do pelotão, além do esforço incansável na busca pela perfeição técnica e tática."
  },
  {
    title: "A Textura de 'Terra Rachada'",
    category: "Sertão & Resiliência",
    icon: Sun,
    color: "from-amber-600 to-yellow-700",
    description: "Presente no letreiro PUMA, este é o elemento visual que liga profundamente a bandeira ao sertão nordestino e à Caatinga cearense. O efeito de solo árido e rachado simboliza a resiliência absoluta, a rusticidade e a capacidade do soldado de sobreviver, operar e vencer sob condições extremas de seca, calor e adversidade."
  },
  {
    title: "O Fundo Preto (Campo Escuro)",
    category: "Austeridade & Rigor",
    icon: Shield,
    color: "from-neutral-800 to-black",
    description: "Na tradicional heráldica militar, o preto profundo que serve de base para a bandeira representa a austeridade, a prudência, o rigor absoluto da disciplina militar, o sigilo das operações noturnas e o respeito solene à memória dos companheiros tombados em cumprimento do dever."
  },
  {
    title: "A Faixa Vermelha (Fefa)",
    category: "Sacrifício & Coragem",
    icon: Flame,
    color: "from-red-600 to-rose-800",
    description: "Símbolo máximo de audácia, bravura, valor intrépido e sacrifício. A faixa vermelha horizontal rasga a bandeira lembrando a paixão pela causa pública e representando o sangue que o policial militar está disposto a derramar na linha de frente para defender a paz e a ordem."
  },
  {
    title: "Tons Dourados e Bronze",
    category: "Nobreza & Conhecimento",
    icon: Star,
    color: "from-yellow-500 to-amber-700",
    description: "Os acabamentos em ouro e bronze ao longo dos escudos e estrelas representam a nobreza de caráter, a luz da verdade, o conhecimento intelectual e jurídico adquirido ao longo da formação e a retidão moral inegociável exigida de cada novo soldado policial militar."
  },
  {
    title: "O Listel com Lema Sagrado",
    category: "Código de Honra",
    icon: BookOpen,
    color: "from-amber-700 to-yellow-800",
    description: "A faixa dourada inferior gravada com 'DISCIPLINA • CORAGEM • HONRA' sintetiza o código moral inviolável que rege a conduta, a mente e o espírito de cada um dos 32 alunos combatentes do pelotão PUMA."
  }
];

export default function QuemSomosPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white relative pb-16 selection:bg-amber-500 selection:text-slate-950">
      {/* Background radial visual */}
      <div className="fixed inset-0 opacity-15 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-amber-500/15 via-yellow-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top Navbar com botões de Retornar */}
      <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-md border-b border-slate-800/80 px-4 md:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <Link href="/">
            <Button 
              variant="outline" 
              className="border-amber-500/40 bg-slate-900/80 hover:bg-amber-500/10 text-amber-300 hover:text-amber-200 font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span>Retornar ao Início</span>
            </Button>
          </Link>

          <Link href="/aluno">
            <Button 
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(37,99,235,0.4)]"
            >
              <span>Área do Aluno</span>
              <LogIn className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section Principal */}
      <main className="max-w-6xl mx-auto px-4 md:px-8 pt-8 md:pt-12 relative z-10 space-y-12">
        <div className="bg-gradient-to-b from-slate-900/90 via-slate-900/70 to-slate-950 border border-amber-500/30 rounded-2xl p-6 md:p-10 shadow-[0_0_50px_rgba(245,158,11,0.15)] relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12 text-center md:text-left">
            
            {/* Quadro da Bandeira */}
            <div className="relative group shrink-0">
              <div className="absolute -inset-1.5 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-90 transition duration-500" />
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64 bg-slate-950 rounded-2xl border-2 border-amber-500/60 p-3 shadow-2xl flex items-center justify-center overflow-hidden">
                <img 
                  src="/bandeira_puma.png" 
                  alt="Bandeira do 32º Pelotão PUMA" 
                  className="object-contain w-full h-full transform group-hover:scale-105 transition duration-500" 
                />
              </div>
            </div>

            {/* Texto Hero */}
            <div className="space-y-4 flex-1">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-400 text-xs sm:text-sm font-black uppercase tracking-widest shadow-inner">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>CFSD PMCE • 14º Batalhão • Maracanaú</span>
              </div>
              
              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-white drop-shadow-lg leading-none">
                32º PELOTÃO <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">PUMA</span>
              </h1>

              <p className="text-slate-300 text-base md:text-lg leading-relaxed max-w-3xl">
                Forjados na disciplina de ferro, na resiliência do sertão nordestino e no compromisso inabalável de proteger e servir à sociedade. Conheça a história, a liderança, os combatentes e a rica heráldica que compõe a alma do nosso pelotão.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                <div className="px-4 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm font-bold text-slate-300 flex items-center gap-2 shadow">
                  <UserCheck className="w-4 h-4 text-blue-400" />
                  <span>Coord.: <strong className="text-white">TC Everton</strong></span>
                </div>
                <div className="px-4 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm font-bold text-slate-300 flex items-center gap-2 shadow">
                  <Award className="w-4 h-4 text-amber-400" />
                  <span>Monitor: <strong className="text-white">CB Gomes</strong></span>
                </div>
                <div className="px-4 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs sm:text-sm font-bold text-slate-300 flex items-center gap-2 shadow">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Efetivo: <strong className="text-white">32 Combatentes</strong></span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Seção de Abas Em Tela Cheia */}
        <div className="space-y-6">
          <Tabs defaultValue="heraldica" className="w-full space-y-8">
            <TabsList className="flex flex-wrap md:grid md:grid-cols-3 h-auto w-full bg-slate-900/90 border border-slate-800 p-1.5 rounded-xl gap-2 shadow-lg">
              <TabsTrigger 
                value="heraldica" 
                className="flex-1 min-w-[180px] text-slate-400 hover:text-white hover:bg-slate-800/50 data-[state=active]:!bg-transparent data-[state=active]:!bg-gradient-to-r data-[state=active]:!from-amber-500 data-[state=active]:!to-yellow-500 data-[state=active]:!text-slate-950 font-bold text-sm sm:text-base uppercase tracking-wider rounded-lg py-3.5 transition-all shadow-sm cursor-pointer"
              >
                🛡️ Heráldica da Bandeira
              </TabsTrigger>
              <TabsTrigger 
                value="efetivo" 
                className="flex-1 min-w-[180px] text-slate-400 hover:text-white hover:bg-slate-800/50 data-[state=active]:!bg-transparent data-[state=active]:!bg-gradient-to-r data-[state=active]:!from-amber-500 data-[state=active]:!to-yellow-500 data-[state=active]:!text-slate-950 font-bold text-sm sm:text-base uppercase tracking-wider rounded-lg py-3.5 transition-all shadow-sm cursor-pointer"
              >
                👥 Os 32 Alunos (QRAs)
              </TabsTrigger>
              <TabsTrigger 
                value="lideranca" 
                className="flex-1 min-w-[180px] text-slate-400 hover:text-white hover:bg-slate-800/50 data-[state=active]:!bg-transparent data-[state=active]:!bg-gradient-to-r data-[state=active]:!from-amber-500 data-[state=active]:!to-yellow-500 data-[state=active]:!text-slate-950 font-bold text-sm sm:text-base uppercase tracking-wider rounded-lg py-3.5 transition-all shadow-sm cursor-pointer"
              >
                ⭐ Comando & Origem
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: HERÁLDICA DA BANDEIRA */}
            <TabsContent value="heraldica" className="space-y-8 animate-in fade-in-50 duration-300">
              <div className="text-center bg-slate-900/60 border border-amber-500/20 rounded-2xl p-6 md:p-8 relative overflow-hidden">
                <h3 className="text-xl sm:text-2xl font-black uppercase text-amber-400 tracking-wide">
                  O Significado Sagrado de Nossos Símbolos
                </h3>
                <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-3xl mx-auto">
                  Cada detalhe, cor, animal e armamento estampado em nossa bandeira carrega um lema de vida e uma promessa solene perante a instituição e o povo cearense.
                </p>
                <div className="mt-5 flex justify-center">
                  <div className="inline-block px-6 py-2 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-sm font-black tracking-widest uppercase shadow">
                    LEMA: DISCIPLINA • CORAGEM • HONRA
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {HERALDICA.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div 
                      key={idx}
                      className="bg-slate-900/90 border border-slate-800/80 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-[0_0_30px_rgba(245,158,11,0.12)] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3.5">
                          <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 px-3 py-1 bg-amber-500/10 rounded-md border border-amber-500/25">
                            {item.category}
                          </span>
                          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md shrink-0`}>
                            <Icon className="w-5 h-5 text-white" />
                          </div>
                        </div>
                        <h4 className="text-lg font-bold text-white tracking-tight mb-3 flex items-center gap-2">
                          {item.title}
                        </h4>
                        <p className="text-sm text-slate-300 leading-relaxed text-justify">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ABA 2: OS 32 ALUNOS (QRAS) */}
            <TabsContent value="efetivo" className="space-y-8 animate-in fade-in-50 duration-300">
              <div className="text-center bg-slate-900/60 border border-amber-500/20 rounded-2xl p-6 md:p-8">
                <h3 className="text-xl sm:text-2xl font-black uppercase text-amber-400 tracking-wide">
                  Grade de Combatentes do 32º Pelotão
                </h3>
                <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-2xl mx-auto">
                  A força de um pelotão reside na união inquebrável de seus combatentes. Abaixo, a relação oficial com a numeração tática e o QRA de cada um de nossos irmãos de farda.
                </p>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs sm:text-sm font-bold uppercase tracking-wider">
                  <Users className="w-4 h-4" />
                  <span>Total do Efetivo: 32 Alunos PM</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
                {QRAS.map((aluno) => (
                  <div 
                    key={aluno.num}
                    className="group bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/40 rounded-xl p-4 text-center transition-all duration-300 hover:scale-[1.03] shadow flex flex-col items-center justify-center gap-1.5 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-8 h-8 bg-amber-500/10 rounded-bl-full flex items-start justify-end p-1.5 text-[10px] font-black text-amber-500 opacity-60 group-hover:opacity-100 transition">
                      PM
                    </div>
                    <span className="text-xs font-black tracking-widest text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      #{String(aluno.num).padStart(2, '0')}
                    </span>
                    <span className="text-base sm:text-lg font-bold text-white group-hover:text-amber-300 transition tracking-tight">
                      {aluno.qra}
                    </span>
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-tighter">
                      Aluno CFSD
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ABA 3: COMANDO & ORIGEM */}
            <TabsContent value="lideranca" className="space-y-8 animate-in fade-in-50 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-blue-500/30 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                      <UserCheck className="w-7 h-7" />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-widest text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded">
                        Coordenador de Pelotão
                      </span>
                      <h4 className="text-2xl font-black text-white mt-1">
                        TC Everton
                      </h4>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed text-justify">
                    Responsável pela coordenação geral e supervisão tática e doutrinária dos pelotões do CFSD da PMCE alocados na área. Lidera com rigor, excelência técnica e foco absoluto na formação de policiais valorosos e prontos para a defesa da sociedade cearense.
                  </p>
                </div>

                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-xl">
                  <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl" />
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
                      <Award className="w-7 h-7" />
                    </div>
                    <div>
                      <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded">
                        Monitor de Pelotão
                      </span>
                      <h4 className="text-2xl font-black text-white mt-1">
                        CB Gomes
                      </h4>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed text-justify">
                    O elo diário de comando, disciplina e instrução técnica do 32º Pelotão. Acompanha passo a passo a evolução física, moral e acadêmica dos 32 alunos, cobrando padrão, marcialidade, união inabalável e espírito de corpo da tropa em todas as missões.
                  </p>
                </div>
              </div>

              {/* Informação do Batalhão */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="space-y-2 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-widest">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span>Sede de Formação</span>
                  </div>
                  <h4 className="text-xl sm:text-2xl font-black text-white uppercase">
                    14º Batalhão da PMCE • Maracanaú / CE
                  </h4>
                  <p className="text-sm text-slate-400 max-w-xl">
                    Berço de formação do nosso pelotão, onde a teoria policial e a prática operacional intensa se fundem para criar o combatente moderno do Sistema PUMA.
                  </p>
                </div>
                
                <div className="shrink-0 flex items-center gap-4">
                  <img src="/14bpm.png" alt="14º Batalhão" className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform" />
                  <div className="px-5 py-4 bg-slate-950 rounded-xl border border-slate-800 text-center shadow-inner">
                    <span className="block text-[10px] sm:text-xs uppercase font-extrabold text-slate-500 tracking-widest">
                      Ano de Formação
                    </span>
                    <span className="block text-2xl sm:text-3xl font-black text-amber-400 tracking-tight mt-0.5">
                      CFSD 2026
                    </span>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Botão de Retornar Inferior para facilitar a navegação no final da página */}
        <div className="pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/">
            <Button 
              size="lg"
              variant="outline" 
              className="w-full sm:w-auto border-amber-500/40 bg-slate-900/80 hover:bg-amber-500/10 text-amber-300 hover:text-amber-200 font-bold px-8 py-6 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <ArrowLeft className="w-5 h-5 text-amber-400" />
              <span className="text-base">Retornar ao Início</span>
            </Button>
          </Link>

          <Link href="/aluno">
            <Button 
              size="lg"
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-6 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            >
              <span className="text-base">Acessar Sistema como Aluno</span>
              <LogIn className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
