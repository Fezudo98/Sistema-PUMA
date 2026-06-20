"use client";

import { useState } from "react";
import AvatarSettingsModal from "./AvatarSettingsModal";
import { useRouter } from "next/navigation";

interface HeaderAvatarProps {
  initials: string;
  avatarUrl: string | null;
  disableModal?: boolean;
}

export default function HeaderAvatar({ initials, avatarUrl, disableModal }: HeaderAvatarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  const handleAvatarUpdate = (newUrl: string) => {
    // Refresh the page to get the updated DB state
    router.refresh();
  };

  return (
    <>
      <div 
        onClick={() => !disableModal && setIsModalOpen(true)}
        className={`w-10 h-10 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold overflow-hidden border-2 border-transparent transition-all shadow-sm ${disableModal ? '' : 'cursor-pointer hover:border-blue-500'}`}
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
