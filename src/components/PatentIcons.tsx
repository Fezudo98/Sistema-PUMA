import React from 'react';

export const RecrutaDotIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <circle cx="12" cy="12" r="4" />
  </svg>
);

export const RecrutaIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 4L3 11L5 14L12 8.5L19 14L21 11L12 4Z" />
  </svg>
);

export const SoldadoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2L2 10L4 13L12 6.5L20 13L22 10L12 2Z" />
    <path d="M12 9L2 17L4 20L12 13.5L20 20L22 17L12 9Z" />
  </svg>
);

export const CaboIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 1L2 8.5L4 11L12 5L20 11L22 8.5L12 1Z" />
    <path d="M12 7.5L2 15L4 17.5L12 11.5L20 17.5L22 15L12 7.5Z" />
    <path d="M12 14L2 21.5L4 24L12 18L20 24L22 21.5L12 14Z" />
  </svg>
);

export const SargentoIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    {/* 3 Chevrons */}
    <path d="M12 0L2 7.5L4 10L12 4L20 10L22 7.5L12 0Z" />
    <path d="M12 6.5L2 14L4 16.5L12 10.5L20 16.5L22 14L12 6.5Z" />
    <path d="M12 13L2 20.5L4 23L12 17L20 23L22 20.5L12 13Z" />
    {/* Bottom Arc */}
    <path d="M22 21.5L20 18.5C18 20.5 15 22 12 22C9 22 6 20.5 4 18.5L2 21.5C5 24 8.5 25.5 12 25.5C15.5 25.5 19 24 22 21.5Z" />
  </svg>
);

export const SubtenenteIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    {/* 3 Chevrons */}
    <path d="M12 0L2 7.5L4 10L12 4L20 10L22 7.5L12 0Z" />
    <path d="M12 6.5L2 14L4 16.5L12 10.5L20 16.5L22 14L12 6.5Z" />
    {/* 2 Arcs */}
    <path d="M12 14C8 14 4.5 16 2 19L4 21C6 19 9 17 12 17C15 17 18 19 20 21L22 19C19.5 16 16 14 12 14Z" />
    <path d="M12 19C8 19 4.5 21 2 24L4 26C6 24 9 22 12 22C15 22 18 24 20 26L22 24C19.5 21 16 19 12 19Z" />
  </svg>
);

export const RaioIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    {/* Diamond */}
    <path d="M12 2L18 8L12 14L6 8L12 2Z" />
    {/* 2 Chevrons Below */}
    <path d="M12 12L2 20L4 22.5L12 16L20 22.5L22 20L12 12Z" />
  </svg>
);

export const BepiEagleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    {/* Cabeça */}
    <path d="M12 2L14.2 5.5L12 8L9.8 5.5L12 2Z" />
    {/* Asa esquerda */}
    <path d="M11 6L0 8.5L1.2 12L11.5 9.5L11 6Z" />
    {/* Asa direita */}
    <path d="M13 6L24 8.5L22.8 12L12.5 9.5L13 6Z" />
    {/* Corpo / cauda */}
    <path d="M12 8.5L15 15L12 22L9 15L12 8.5Z" />
  </svg>
);

export const ChoqueSkullIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    {/* Ossos cruzados */}
    <path d="M2 3L22 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
    <path d="M22 3L2 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
    {/* Caveira (com furos vazados nos olhos e nariz via fillRule evenodd) */}
    <path
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C8.13 2 5 5.13 5 9c0 2.76 1.5 5.15 3.7 6.38V18.5c0 .55.45 1 1 1h.8V21h3v-1.5h.8c.55 0 1-.45 1-1v-3.12C17.5 14.15 19 11.76 19 9c0-3.87-3.13-7-7-7Z
         M11,9.6 a1.6,1.6 0 1,0 -3.2,0 a1.6,1.6 0 1,0 3.2,0 Z
         M16.2,9.6 a1.6,1.6 0 1,0 -3.2,0 a1.6,1.6 0 1,0 3.2,0 Z
         M12,11.2 L13,13 L11,13 Z"
    />
  </svg>
);

export const BopeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    {/* 3 Diamonds */}
    <path d="M12 0L17 5L12 10L7 5L12 0Z" />
    <path d="M5 4L10 9L5 14L0 9L5 4Z" />
    <path d="M19 4L24 9L19 14L14 9L19 4Z" />
    {/* Chevrons Below */}
    <path d="M12 10L2 18L4 21L12 14.5L20 21L22 18L12 10Z" />
  </svg>
);
