import React from 'react';

interface DubbiOviLogoProps {
  className?: string;
}

export const DubbiOviLogo: React.FC<DubbiOviLogoProps> = ({
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      <img
        src="/dubbiovi-icon-transparent.png"
        alt="DO Emblem"
        className="h-[43px] w-[43px] object-contain drop-shadow-[0_0_12px_rgba(0,200,83,0.45)] transition-transform duration-200 hover:scale-105"
      />
      <img
        src="/dubbiovi-text-transparent.png"
        alt="DubbiOvi"
        className="h-[30px] w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,200,83,0.25)]"
      />
    </div>
  );
};
