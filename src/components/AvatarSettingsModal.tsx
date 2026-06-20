"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2 } from "lucide-react";

interface AvatarSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAvatarUpdate: (newUrl: string) => void;
}

const PREDEFINED_AVATARS = [
  "01.png",
  "02.png",
  "03.png",
  "04.png",
  "05.png"
];

export default function AvatarSettingsModal({ isOpen, onClose, onAvatarUpdate }: AvatarSettingsModalProps) {
  const [loading, setLoading] = useState(false);
  const [selectedPredefined, setSelectedPredefined] = useState<string | null>(null);

  const handleSavePredefined = async () => {
    if (!selectedPredefined) return;
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append("predefined", selectedPredefined);
      
      const res = await fetch("/api/user/avatar", { method: "POST", body: formData });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      onAvatarUpdate(data.avatarUrl);
      onClose();
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-slate-800">
            <ImagePlus className="w-5 h-5 text-blue-600" /> Alterar Ícone Padrão
          </DialogTitle>
          <DialogDescription>
            Escolha um dos avatares oficiais do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-3 gap-4">
            {PREDEFINED_AVATARS.map((avatarName) => (
              <div 
                key={avatarName}
                onClick={() => setSelectedPredefined(avatarName)}
                className={`cursor-pointer rounded-xl border-2 overflow-hidden aspect-square flex items-center justify-center p-2 transition-all ${
                  selectedPredefined === avatarName 
                    ? "border-blue-600 bg-blue-50 shadow-md transform scale-105" 
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <img src={`/avatars/predefined/${avatarName}`} alt="Avatar" className="w-full h-full object-contain" />
              </div>
            ))}
          </div>
          
          <Button 
            onClick={handleSavePredefined} 
            disabled={!selectedPredefined || loading} 
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Salvar Avatar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
