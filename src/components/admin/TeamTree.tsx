"use client";

import { useEffect, useRef } from "react";

interface TreeNode {
  id: string;
  name: string;
  city: string;
  monthlyRevenue: number;
  rank: string;
  children: TreeNode[];
}

interface TeamTreeProps {
  data: TreeNode;
}

function drawTree(
  ctx: CanvasRenderingContext2D,
  node: TreeNode,
  x: number,
  y: number,
  hSpacing: number,
  vSpacing: number,
  depth: number
) {
  const RANK_COLORS: Record<string, string> = {
    GOLD: "#f59e0b",
    SILVER: "#94a3b8",
    BRONZE: "#d9a99d",
    STARTER: "#1d2f4f",
  };
  const color = RANK_COLORS[node.rank] ?? "#1d2f4f";

  // Draw children first (lines behind nodes)
  if (node.children.length > 0) {
    const totalWidth = (node.children.length - 1) * hSpacing;
    const startX = x - totalWidth / 2;
    node.children.forEach((child, i) => {
      const cx = startX + i * hSpacing;
      const cy = y + vSpacing;
      ctx.beginPath();
      ctx.strokeStyle = "#eadfda";
      ctx.lineWidth = 1.5;
      ctx.moveTo(x, y + 20);
      ctx.lineTo(cx, cy - 20);
      ctx.stroke();
      drawTree(ctx, child, cx, cy, hSpacing * 0.7, vSpacing, depth + 1);
    });
  }

  // Node circle
  ctx.beginPath();
  ctx.arc(x, y, 18, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Initials
  const initials = node.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(initials, x, y);

  // Name label
  ctx.fillStyle = "#1d2f4f";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText(node.name.split(" ")[0], x, y + 22);
}

export function TeamTree({ data }: TeamTreeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawTree(ctx, data, canvas.width / 2, 40, 140, 90, 0);
  }, [data]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm p-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="mx-auto block max-w-full"
        style={{ touchAction: "pan-x pan-y" }}
      />
      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-navy/75">
        {[
          { color: "#f59e0b", label: "Gold" },
          { color: "#94a3b8", label: "Silver" },
          { color: "#d9a99d", label: "Bronze" },
          { color: "#1d2f4f", label: "Starter" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
