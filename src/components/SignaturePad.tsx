"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser } from "lucide-react";

/**
 * Cadre de signature au doigt ou à la souris. Renvoie une image PNG (data URL) dès qu'un trait
 * suffisant est tracé, null quand le cadre est vide.
 */
export function SignaturePad({ onChange, label = "Votre signature" }: { onChange: (png: string | null) => void; label?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const length = useRef(0);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#14213b";
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function down(e: React.PointerEvent) {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  }
  function move(e: React.PointerEvent) {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = canvas.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    length.current += Math.hypot(p.x - last.current.x, p.y - last.current.y);
    last.current = p;
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    // Un vrai tracé : au moins 60 px de trait (évite un simple point ou un clic).
    const ok = length.current >= 60;
    setEmpty(!ok);
    onChange(ok ? canvas.current!.toDataURL("image/png") : null);
  }
  function clear() {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    length.current = 0;
    setEmpty(true);
    onChange(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-navy/60">{label} *</span>
        <button type="button" onClick={clear} className="inline-flex items-center gap-1 text-xs font-semibold text-navy/70 hover:text-navy"><Eraser size={13} /> Effacer</button>
      </div>
      <canvas
        ref={canvas}
        aria-label="Cadre de signature : signez au doigt ou à la souris"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        className="mt-1.5 h-40 w-full touch-none rounded-xl border-2 border-dashed border-line bg-white"
      />
      <p className="mt-1 text-xs text-navy/60">{empty ? "Signez dans le cadre ci-dessus." : "Signature enregistrée. « Effacer » pour recommencer."}</p>
    </div>
  );
}
