"use client";

import { useState } from "react";
import AvatarSettingsModal from "./AvatarSettingsModal";
import { useRouter } from "next/navigation";

interface HeaderAvatarProps {
  initials: string;
  avatarUrl: string | null;
}

export default function HeaderAvatar({ initials, avatarUrl }: HeaderAvatarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const handleAvatarUpdate = (newUrl: string) => {
    // Refresh the page to get the updated DB state
    router.refresh();
  };

  return (
    <>
      <div 
        onClick={() => setIsModalOpen(true)}
        className="w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold cursor-pointer overflow-hidden border-2 border-transparent hover:border-blue-500 transition-all shadow-sm"
        title="Alterar foto de perfil"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
        ) : (
          initials
        )}
      </div>

      <AvatarSettingsModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onAvatarUpdate={handleAvatarUpdate}
      />
    </>
  );
}
