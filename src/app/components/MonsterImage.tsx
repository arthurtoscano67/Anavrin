import { useState } from "react";

import { monsterPng, monsterSvg } from "../lib/format";

export function MonsterImage({ objectId, className = "" }: { objectId: string; className?: string }) {
  const [src, setSrc] = useState(monsterSvg(objectId));

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black/30 ${className}`}>
      <img
        src={src}
        alt={`Monster ${objectId}`}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => {
          if (src.endsWith(".svg")) setSrc(monsterPng(objectId));
        }}
      />
    </div>
  );
}
