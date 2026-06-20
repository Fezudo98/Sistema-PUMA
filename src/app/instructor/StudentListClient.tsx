"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Target, Clock, Trophy, Search, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

type StudentPerformance = {
  id: string;
  name: string;
  numero: number | null;
  avatarUrl: string | null;
  totalAnswers: number;
  accuracy: number;
  totalScore: number;
  avgTime: number;
};

interface StudentListClientProps {
  studentsPerformance: StudentPerformance[];
}

export default function StudentListClient({ studentsPerformance }: StudentListClientProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentPerformance | null>(null);

  const filteredStudents = studentsPerformance.filter(student => 
    student.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Card className="bg-slate-900/40 border-slate-800 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-emerald-500"></div>
      <CardHeader className="border-b border-slate-800 bg-slate-900/80 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-2xl font-black text-white uppercase tracking-widest">
            <Users className="w-6 h-6 text-blue-500" />
            Divisão de Combatentes
          </CardTitle>
          <CardDescription className="text-slate-400 font-medium">Radar de desempenho global da tropa em todas as operações.</CardDescription>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
          <Input 
            placeholder="Pesquisar combatente por QRA..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-blue-500"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {studentsPerformance.length === 0 ? (
          <div className="py-16 text-center text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800">
            Nenhum recruta registrado no sistema ainda.
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-slate-500 font-bold uppercase tracking-widest border-b border-slate-800">
            Nenhum combatente encontrado com esse QRA.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-400 text-xs font-black uppercase tracking-widest border-b border-slate-800">
                  <th className="p-5">QRA (Recruta)</th>
                  <th className="p-5 text-center">Tiros Efetuados</th>
                  <th className="p-5 text-center">Precisão</th>
                  <th className="p-5 text-center">Tempo de Reação</th>
                  <th className="p-5 text-right">Score Operacional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredStudents.map((student, index) => {
                  // Keep original index for ranking if not searching, otherwise use filtered index
                  const rankIndex = searchTerm ? studentsPerformance.findIndex(s => s.id === student.id) : index;
                  
                  return (
                    <tr 
                      key={student.id} 
                      onClick={() => setSelectedStudent(student)}
                      className="hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      <td className="p-5">
                        <div className="flex items-center gap-4">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs border ${
                            rankIndex === 0 ? "bg-yellow-900/30 border-yellow-500 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]" :
                            rankIndex === 1 ? "bg-slate-800 border-slate-400 text-slate-300" :
                            rankIndex === 2 ? "bg-amber-900/20 border-amber-700 text-amber-600" :
                            "bg-slate-900 border-slate-800 text-slate-600"
                          }`}>
                            {rankIndex + 1}º
                          </div>
                          <div className="flex items-center gap-3">
                            {student.avatarUrl ? (
                              <img src={student.avatarUrl} alt={student.name} className="w-8 h-8 rounded-full object-cover border border-slate-700" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                                <UserIcon className="w-4 h-4" />
                              </div>
                            )}
                            <span className="font-bold text-white uppercase tracking-wider">
                              {student.numero ? `${String(student.numero).padStart(2, '0')} - ${student.name}` : student.name}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-5 text-center text-slate-300 font-bold">{student.totalAnswers}</td>
                      <td className="p-5 text-center">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${
                          student.accuracy >= 70 ? "bg-emerald-900/30 text-emerald-400 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.15)]" :
                          student.accuracy >= 50 ? "bg-amber-900/30 text-amber-400 border-amber-500/30" :
                          "bg-red-900/30 text-red-400 border-red-500/30"
                        }`}>
                          <Target className="w-3 h-3 mr-1.5" />
                          {student.accuracy}%
                        </span>
                      </td>
                      <td className="p-5 text-center text-slate-400 font-mono font-bold">
                        <span className="flex items-center justify-center gap-1.5">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {student.avgTime > 0 ? `${student.avgTime}s` : "-"}
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <span className="flex items-center justify-end gap-2 font-black text-white text-lg tracking-wider">
                          {student.totalScore > 0 && <Trophy className="w-4 h-4 text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" />}
                          {student.totalScore}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={!!selectedStudent} onOpenChange={(open) => !open && setSelectedStudent(null)}>
        <DialogContent className="bg-slate-950 border-slate-800 text-slate-200 sm:max-w-[425px]">
          <DialogHeader className="border-b border-slate-800 pb-4">
            <DialogTitle className="text-xl font-black uppercase tracking-widest text-white flex items-center gap-3">
              {selectedStudent?.avatarUrl ? (
                <img src={selectedStudent.avatarUrl} alt={selectedStudent.name} className="w-12 h-12 rounded-full object-cover border-2 border-blue-500" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-900 border-2 border-blue-500 flex items-center justify-center text-blue-500">
                  <UserIcon className="w-6 h-6" />
                </div>
              )}
              {selectedStudent?.numero ? `${String(selectedStudent.numero).padStart(2, '0')} - ${selectedStudent.name}` : selectedStudent?.name}
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-bold uppercase tracking-widest text-xs pt-1">
              Dossiê Operacional do Combatente
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center">
                <Target className="w-5 h-5 text-blue-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-white">{selectedStudent?.accuracy}%</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Precisão Global</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center">
                <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-white">{selectedStudent?.totalScore}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Score Total</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center">
                <Users className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-white">{selectedStudent?.totalAnswers}</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Tiros Efetuados</div>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-4 text-center">
                <Clock className="w-5 h-5 text-amber-500 mx-auto mb-2" />
                <div className="text-2xl font-black text-white">{selectedStudent?.avgTime}s</div>
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Reação Média</div>
              </div>
            </div>
            
            <div className="bg-slate-900/30 border border-slate-800 rounded-lg p-4">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 border-b border-slate-800 pb-2">Status do Combatente</h4>
               <p className="text-sm text-slate-300">
                  {selectedStudent && selectedStudent.accuracy >= 80 && selectedStudent.avgTime <= 15 ? 
                    "Excelente atirador. Combina altíssima precisão com velocidade de reação formidável. Padrão Ouro." :
                   selectedStudent && selectedStudent.accuracy >= 60 ? 
                    "Desempenho satisfatório na linha de frente. Recomenda-se mais treinamentos simulados para elevar a taxa crítica de acertos." :
                   selectedStudent && selectedStudent.totalAnswers > 0 ?
                    "Recruta necessita de treinamento intensivo. Desempenho letal comprometido. Encaminhar para reforço teórico." :
                    "Recruta ainda não entrou em combate."
                  }
               </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
