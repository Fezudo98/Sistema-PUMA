"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ImagePlus, UploadCloud, Loader2 } from "lucide-react";

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
  const [file, setFile] = useState<File | null>(null);

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

  const handleSaveUpload = async () => {
    if (!file) return;
    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch("/api/user/avatar", { method: "POST", body: formData });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error);
      
      onAvatarUpdate(data.avatarUrl);
      onClose();
    } catch (err: any) {
      alert("Erro no upload: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-slate-800">
            <ImagePlus className="w-5 h-5 text-blue-600" /> Alterar Foto de Perfil
          </DialogTitle>
          <DialogDescription>
            Escolha um avatar oficial ou envie uma foto do seu dispositivo.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="predefined" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="predefined">Avatar</TabsTrigger>
            <TabsTrigger value="upload">Sua Galeria</TabsTrigger>
          </TabsList>

          <TabsContent value="predefined" className="space-y-4 pt-4">
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
          </TabsContent>

          <TabsContent value="upload" className="space-y-4 pt-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                id="avatar-upload"
              />
              <label htmlFor="avatar-upload" className="cursor-pointer flex flex-col items-center">
                {file ? (
                  <>
                    <img src={URL.createObjectURL(file)} alt="Preview" className="w-24 h-24 object-cover rounded-full shadow-md mb-4" />
                    <span className="text-sm font-medium text-slate-700 truncate w-full px-4">{file.name}</span>
                    <span className="text-xs text-blue-600 font-bold mt-2">Trocar Foto</span>
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-12 h-12 text-slate-400 mb-4" />
                    <span className="text-base font-medium text-slate-700">Clique para selecionar uma imagem</span>
                    <span className="text-xs text-slate-500 mt-1">PNG, JPG ou JPEG</span>
                  </>
                )}
              </label>
            </div>
            
            <Button 
              onClick={handleSaveUpload} 
              disabled={!file || loading} 
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Fazer Upload e Salvar"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
