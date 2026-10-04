"use client";

import { useEffect, useRef, useState } from "react";
import { Button, IconButton, Sheet, SheetActions, cn } from "@/components/ig-ui";
import { RotateCcw, RotateCw } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════
   The face you sign up with

   A provider hands back a square thumbnail at best; a picked file is any
   shape. So the picture goes through the same adjust step the settings
   editor uses — drag to move, slide to zoom, turn to straighten — and
   comes out a centred 512×512 JPEG, which is what an avatar is stored as
   everywhere (a data URL in the account row's photoUrl).
   ═══════════════════════════════════════════════════════════════════ */

const OUT = 512;

export function AvatarEditor({
  src,
  onCancel,
  onApply,
}: {
  /** A data URL of the file the reader just picked. */
  src: string;
  onCancel: () => void;
  onApply: (dataUrl: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // Keep the picture covering the square frame — no empty corners ever.
  function coverBox(z: number, r: number) {
    const frame = frameRef.current;
    if (!frame) return null;
    const fw = frame.clientWidth;
    const fh = frame.clientHeight;
    if (!fw || !fh) return null;
    let W = fw * z;
    let H = fh * z;
    if (r % 180 !== 0) [W, H] = [H, W];
    return { fw, fh, W, H };
  }

  function clamp(p: { x: number; y: number }, z = zoom, r = rot) {
    const box = coverBox(z, r);
    if (!box) return { x: 0, y: 0 };
    const mx = Math.max(0, (box.W - box.fw) / 2);
    const my = Math.max(0, (box.H - box.fh) / 2);
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) };
  }

  useEffect(() => {
    // A rotate swaps the cover box — zoom in enough to re-cover, then re-clamp.
    setZoom((z) => {
      const box = coverBox(z, rot);
      if (!box) return z;
      const need = Math.max(box.fw / box.W, box.fh / box.H, 1);
      return Math.min(4, z * need);
    });
    setPan((p) => clamp(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rot]);

  useEffect(() => {
    setPan((p) => clamp(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y };
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    setPan(
      clamp({
        x: drag.current.ox + (e.clientX - drag.current.px),
        y: drag.current.oy + (e.clientY - drag.current.py),
      }),
    );
  }
  function onPointerUp() {
    drag.current = null;
  }

  function apply() {
    const frame = frameRef.current;
    const img = new window.Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = OUT;
      c.height = OUT;
      const ctx = c.getContext("2d");
      if (!ctx || !frame) {
        onCancel();
        return;
      }
      const fw = frame.clientWidth || OUT;
      const fh = frame.clientHeight || OUT;
      const k = OUT / fw;
      const base = Math.max(fw / img.naturalWidth, fh / img.naturalHeight);
      const s = base * zoom * k;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, OUT, OUT);
      ctx.clip();
      ctx.translate(OUT / 2 + pan.x * k, OUT / 2 + pan.y * k);
      ctx.rotate((rot * Math.PI) / 180);
      ctx.drawImage(
        img,
        (-img.naturalWidth * s) / 2,
        (-img.naturalHeight * s) / 2,
        img.naturalWidth * s,
        img.naturalHeight * s,
      );
      ctx.restore();
      onApply(c.toDataURL("image/jpeg", 0.9));
    };
    img.onerror = () => onCancel();
    img.src = src;
  }

  return (
    <Sheet
      title="Adjust your photo"
      description="Drag to move · slide to zoom · turn to straighten."
      onClose={onCancel}
      footer={
        <SheetActions
          cancelLabel="Cancel"
          onCancel={onCancel}
          confirmLabel="Use this photo"
          onConfirm={apply}
        />
      }
    >
      <div className="-mx-4 px-4 pt-1 pb-5 sm:-mx-5 sm:px-5">
        <div
          ref={frameRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative mx-auto aspect-square w-full max-w-[300px] touch-none overflow-hidden rounded-full bg-surface-2 select-none"
          style={{ cursor: drag.current ? "grabbing" : "grab" }}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute inset-0 size-full object-cover"
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rot}deg)` }}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="text-[11.5px] font-semibold tracking-[0.08em] text-muted uppercase">
            Zoom
          </span>
          <input
            type="range"
            aria-label="Zoom"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-7 flex-1 cursor-pointer appearance-none accent-accent"
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <IconButton
            label="Rotate left"
            onClick={() => setRot((r) => (r + 270) % 360)}
            className="bg-surface-2 hover:bg-surface-3"
            icon={<RotateCcw className="size-[18px]" />}
          />
          <IconButton
            label="Rotate right"
            onClick={() => setRot((r) => (r + 90) % 360)}
            className="bg-surface-2 hover:bg-surface-3"
            icon={<RotateCw className="size-[18px]" />}
          />
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto"
            onClick={() => {
              setZoom(1);
              setRot(0);
              setPan({ x: 0, y: 0 });
            }}
          >
            Reset
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
