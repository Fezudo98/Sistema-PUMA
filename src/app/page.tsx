import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div 
      className="min-h-screen flex text-white relative overflow-hidden bg-slate-950 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/arte_fundo.png')" }}
    >
      {/* Left Side - Empty to let the Jaguar shine */}
      <div className="hidden md:block flex-grow pointer-events-none relative">
        <Image 
          src="/letra.png" 
          alt="Arte Complementar" 
          width={400} 
          height={160} 
          className="absolute top-12 left-12 opacity-80 object-contain invert drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]"
        />
      </div>

      {/* Right Side Panel */}
      <div className="z-10 w-full md:w-[450px] bg-black/80 backdrop-blur-xl border-l border-slate-800 shadow-[-20px_0_50px_rgba(0,0,0,0.8)] flex flex-col justify-center items-center px-12 py-8 relative">
        
        <Image 
          src="/logo.png" 
          alt="PMCE Simula Logo" 
          width={180} 
          height={180} 
          className="mb-6 drop-shadow-[0_0_25px_rgba(245,158,11,0.4)] object-contain transition-transform hover:scale-105 duration-300"
        />
        
        <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter mb-12 drop-shadow-[0_0_15px_rgba(96,165,250,0.3)] text-center">
          SISTEMA <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-cyan-300">PUMA</span>
        </h1>

        <div className="flex flex-col gap-6 w-full">
          <Link href="/aluno" className="w-full">
            <Button size="lg" className="w-full h-16 text-lg font-bold bg-blue-600 hover:bg-blue-500 border border-blue-500/50 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)]">
              Acessar como Aluno
            </Button>
          </Link>
          
          <Link href="/auth/login" className="w-full">
            <Button size="lg" variant="outline" className="w-full h-16 text-lg font-bold border-slate-600 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white transition-all">
              Acessar como Instrutor
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
