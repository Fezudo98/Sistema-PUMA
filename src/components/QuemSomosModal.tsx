"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Sparkles
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
    description: "O mascote central é um felino astuto e imponente, nativo de vários biomas brasileiros, em especial da nossa Caatinga. Representa agilidade, furtividade, velocidade extrema, força bruta e o status de caçador no topo da cadeia alimentar — simbolizando o combate implacável e caçada incansável contra a criminalidade. Sua expressão feroz denota a agressividade tática e a prontidão ininterrupta exigidas na função policial militar."
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
    title: "O Fundo Preto (Campo)",
    category: "Austeridade & Respeito",
    icon: Shield,
    color: "from-zinc-800 to-black",
    description: "Na heráldica militar, o preto profundo do fundo representa a austeridade, o rigor absoluto, a sabedoria tática, o sigilo das operações noturnas e, acima de tudo, o respeito solene e luto eterno pelos companheiros tombados no cumprimento do dever."
  },
  {
    title: "A Faixa Vermelha (Fefa)",
    category: "Coragem & Sacrifício",
    icon: Flame,
    color: "from-red-600 to-rose-800",
    description: "A faixa horizontal vermelha cortando o fundo preto é o símbolo máximo de coragem indomável, audácia, espírito de sacrifício e a representação viva do sangue que o policial militar está disposto a derramar para proteger a sociedade e seus irmãos de farda."
  },
  {
    title: "Tons em Dourado e Bronze",
    category: "Nobreza & Conhecimento",
    icon: Star,
    color: "from-yellow-500 to-amber-700",
    description: "Representam a nobreza da missão policial militar, a luz radiante da verdade, o valioso conhecimento teórico e prático adquirido durante o CFSD e a retidão moral e pureza de caráter exigidas dos novos defensores da lei."
  },
  {
    title: "O Listel com o Lema",
    category: "Código de Conduta",
    icon: BookOpen,
    color: "from-amber-500 via-yellow-500 to-amber-600",
    description: "A faixa inferior gravada com 'DISCIPLINA • CORAGEM • HONRA' sintetiza o código de conduta moral e ético inviolável do 32º Pelotão. A Disciplina inabalável para obedecer e cumprir missões, a Coragem frontal para enfrentar o perigo e a Honra imaculada para zelar pela integridade da Polícia Militar do Ceará."
  }
];

export function QuemSomosModal({ triggerButton }: { triggerButton?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          triggerButton ? (triggerButton as any) : (
            <Button 
              variant="outline" 
              className="w-full bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 hover:from-amber-500/20 hover:to-yellow-500/20 border-amber-500/40 text-amber-300 hover:text-amber-200 font-bold tracking-wider uppercase py-6 shadow-[0_0_20px_rgba(245,158,11,0.15)] hover:shadow-[0_0_30px_rgba(245,158,11,0.3)] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Shield className="w-5 h-5 text-amber-400 animate-pulse" />
              <span>Quem Somos Nós • 32º Pelotão</span>
            </Button>
          )
        }
      />

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950/95 border-amber-500/40 text-white shadow-[0_0_60px_rgba(245,158,11,0.2)] p-0">
        {/* Banner com Efeito Visual de Fundo */}
        <div className="relative p-6 md:p-8 bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-b border-amber-500/20 overflow-hidden">
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
          
          <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 text-center md:text-left">
            <div className="relative group shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-2xl blur-md opacity-40 group-hover:opacity-75 transition duration-500" />
              <div className="relative w-36 h-36 md:w-44 md:h-44 bg-slate-950 rounded-2xl border-2 border-amber-500/50 p-2 shadow-2xl flex items-center justify-center overflow-hidden">
                <Image 
                  src="/bandeira_puma.png" 
                  alt="Bandeira do 32º Pelotão PUMA" 
                  width={200} 
                  height={200}
                  className="object-contain w-full h-full transform group-hover:scale-105 transition duration-500" 
                />
              </div>
            </div>

            <div className="space-y-2 flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-black uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>CFSD PMCE • 14º Batalhão • Maracanaú</span>
              </div>
              
              <DialogTitle className="text-2xl md:text-4xl font-black uppercase tracking-tight text-white drop-shadow-md">
                32º PELOTÃO <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-200">PUMA</span>
              </DialogTitle>

              <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-2xl">
                Forjados na disciplina, na resiliência do sertão e no compromisso inabalável de proteger a sociedade. Conheça a história, a liderança, os combatentes e a rica heráldica que compõe a alma do nosso pelotão.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                  Coord.: <strong className="text-white">TC Everton</strong>
                </span>
                <span className="px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Monitor: <strong className="text-white">CB Gomes</strong>
                </span>
                <span className="px-3 py-1 bg-slate-800/80 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" />
                  Efetivo: <strong className="text-white">32 Combatentes</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Abas de Navegação */}
        <div className="p-4 md:p-6">
          <Tabs defaultValue="heraldica" className="w-full space-y-6">
            <TabsList className="grid grid-cols-3 w-full bg-slate-900 border border-slate-800 p-1 rounded-xl">
              <TabsTrigger 
                value="heraldica" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-yellow-600 data-[state=active]:text-slate-950 font-bold text-xs md:text-sm uppercase tracking-wider rounded-lg py-2.5 transition-all"
              >
                🛡️ Heráldica da Bandeira
              </TabsTrigger>
              <TabsTrigger 
                value="efetivo" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-yellow-600 data-[state=active]:text-slate-950 font-bold text-xs md:text-sm uppercase tracking-wider rounded-lg py-2.5 transition-all"
              >
                👥 Os 32 Alunos (QRAs)
              </TabsTrigger>
              <TabsTrigger 
                value="lideranca" 
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-600 data-[state=active]:to-yellow-600 data-[state=active]:text-slate-950 font-bold text-xs md:text-sm uppercase tracking-wider rounded-lg py-2.5 transition-all"
              >
                ⭐ Comando & Origem
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: HERÁLDICA DA BANDEIRA */}
            <TabsContent value="heraldica" className="space-y-6 animate-in fade-in-50 duration-300">
              <div className="text-center bg-slate-900/60 border border-amber-500/20 rounded-xl p-4 md:p-6 relative overflow-hidden">
                <h3 className="text-lg font-black uppercase text-amber-400 tracking-wide">
                  O Significado Sagrado de Nossos Símbolos
                </h3>
                <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl mx-auto">
                  Cada detalhe, cor, animal e armamento estampado em nossa bandeira carrega um lema de vida e uma promessa solene perante a instituição e o povo cearense.
                </p>
                <div className="mt-4 flex justify-center">
                  <div className="inline-block px-4 py-1.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 text-xs font-black tracking-widest uppercase">
                    LEMA: DISCIPLINA • CORAGEM • HONRA
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {HERALDICA.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div 
                      key={idx}
                      className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/40 rounded-xl p-4.5 transition-all duration-300 hover:shadow-[0_0_25px_rgba(245,158,11,0.1)] flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400/80 px-2 py-0.5 bg-amber-500/10 rounded border border-amber-500/20">
                            {item.category}
                          </span>
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center shadow-md shrink-0`}>
                            <Icon className="w-4 h-4 text-white" />
                          </div>
                        </div>
                        <h4 className="text-base font-bold text-white tracking-tight mb-2 flex items-center gap-1.5">
                          {item.title}
                        </h4>
                        <p className="text-xs text-slate-300 leading-relaxed text-justify">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ABA 2: OS 32 ALUNOS (QRAS) */}
            <TabsContent value="efetivo" className="space-y-6 animate-in fade-in-50 duration-300">
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center">
                <h3 className="text-base font-bold text-white uppercase tracking-wider">
                  Efetivo Oficial do 32º Pelotão PUMA
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Os 32 combatentes numerados do Curso de Formação de Soldados — 14º Batalhão PMCE
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {QRAS.map((aluno) => (
                  <div 
                    key={aluno.num}
                    className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 hover:border-amber-500/50 rounded-xl p-3 flex items-center gap-3 transition-all duration-200 group hover:scale-[1.02] shadow-sm hover:shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 font-black text-sm flex items-center justify-center shrink-0 shadow-md group-hover:from-amber-400 group-hover:to-yellow-500">
                      {aluno.num < 10 ? `0${aluno.num}` : aluno.num}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Aluno(a)</p>
                      <p className="text-sm font-black text-white uppercase tracking-tight truncate group-hover:text-amber-400 transition-colors">
                        {aluno.qra}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ABA 3: LIDERANÇA & ORIGEM */}
            <TabsContent value="lideranca" className="space-y-6 animate-in fade-in-50 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/30 border border-amber-500/30 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-3 text-amber-400">
                      <Star className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 px-2.5 py-1 bg-amber-500/10 rounded-md border border-amber-500/20">
                      Coordenador do Pelotão
                    </span>
                    <h4 className="text-2xl font-black text-white tracking-tight uppercase">
                      TC EVERTON
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Responsável pela coordenação geral e diretrizes estratégicas de instrução e disciplina do 32º Pelotão do Curso de Formação de Soldados.
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/30 border border-blue-500/30 rounded-xl p-6 relative overflow-hidden flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-3 text-blue-400">
                      <Shield className="w-6 h-6" />
                    </div>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-blue-400 px-2.5 py-1 bg-blue-500/10 rounded-md border border-blue-500/20">
                      Monitor do Pelotão
                    </span>
                    <h4 className="text-2xl font-black text-white tracking-tight uppercase">
                      CB GOMES
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Responsável pela condução diária, alinhamento tático, acompanhamento disciplinar e cobrança técnica operacional junto aos 32 combatentes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <MapPin className="w-6 h-6 text-amber-400 shrink-0" />
                  <div>
                    <h4 className="text-lg font-bold text-white uppercase tracking-tight">
                      14º Batalhão da PMCE • Maracanaú
                    </h4>
                    <p className="text-xs text-slate-400">
                      Berço de nossa formação e quartel-escola do Curso de Formação de Soldados
                    </p>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-4 text-xs text-slate-300 space-y-2 leading-relaxed">
                  <p>
                    O Curso de Formação de Soldados (CFSD) da Polícia Militar do Ceará molda cidadãos civis em autênticos operadores de segurança pública. No 14º Batalhão, em Maracanaú, o 32º Pelotão se consolida sob o signo do <strong className="text-amber-400">PUMA</strong> — símbolo de velocidade, acerto precisado e prontidão ininterrupta na defesa e honra da gloriosa PMCE.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
