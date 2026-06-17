"use client";

import { useEffect } from "react";

export default function SlideOver({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-stone-50/70" onClick={onClose} />
      <div className="popover relative h-full w-full max-w-lg overflow-y-auto rounded-none border-l p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="section-title text-base">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-stone-500 hover:bg-stone-200 hover:text-stone-800"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
