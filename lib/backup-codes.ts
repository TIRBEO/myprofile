"use client";

/* ═══════════════════════════════════════════════════════════════════
   The backup-codes PDF

   The codes themselves are the account service's business — it hashes them,
   hands out a set once, and never prints them again. What is left for the
   browser to do is put a set it is *already holding* onto paper, because a
   code you cannot open when your phone is dead is no code at all.

   Writes a one-page A4 PDF rather than opening a print window: an
   about:blank document inherits the browser's dark colour scheme, which
   lands as dark text on a dark page. Only ASCII reaches the stream, so
   string offsets double as byte offsets for the xref table.
   ═══════════════════════════════════════════════════════════════════ */

import type { RevealedCodes } from "@/lib/two-factor";

const PAGE = { w: 595, h: 842, x: 56 };

function esc(text: string) {
  return text.replace(/[^\x20-\x7E]/g, "").replace(/([\\()])/g, "\\$1");
}

function drawText(x: number, y: number, size: number, body: string, bold: boolean, gray = 0) {
  return `${gray} ${gray} ${gray} rg BT /${bold ? "F2" : "F1"} ${size} Tf 1 0 0 1 ${x} ${y} Tm (${esc(body)}) Tj ET\n`;
}

function drawBox(x: number, y: number, w: number, h: number) {
  return `0.8 0.83 0.88 RG 1 w ${x} ${y} ${w} ${h} re S\n`;
}

function codesPage(set: RevealedCodes, stamp: string) {
  const top = PAGE.h - 70;
  const colGap = 14;
  const colW = (PAGE.w - PAGE.x * 2 - colGap) / 2;
  const rowH = 34;
  const rowGap = 12;
  const gridTop = top - 76;

  let out = drawText(PAGE.x, top, 19, "Tirbeo backup codes", true);
  out += drawText(PAGE.x, top - 20, 10, "Each code works once, then it is gone.", false, 0.42);
  out += drawText(PAGE.x, top - 36, 10, `Generated ${stamp}`, false, 0.42);

  set.codes.forEach((code, i) => {
    const x = PAGE.x + (i % 2) * (colW + colGap);
    const y = gridTop - Math.floor(i / 2) * (rowH + rowGap);
    out += drawBox(x, y, colW, rowH);
    out += drawText(x + 12, y + 12, 9, String(i + 1), false, 0.55);
    out += drawText(x + 30, y + 11, 12, code, true);
  });

  const rows = Math.ceil(set.codes.length / 2);
  out += drawText(
    PAGE.x,
    gridTop - rows * (rowH + rowGap) - 6,
    9,
    "Keep this file somewhere safe. Generating a new set on Tirbeo invalidates every code above.",
    false,
    0.42,
  );
  return out;
}

function buildPdf(content: string) {
  // /Length counts the stream data only — the newline before `endstream` is
  // the separator the spec asks for, not part of the payload.
  const data = content.trimEnd();
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${data.length} >>\nstream\n${data}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefAt = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    out += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return out;
}

export function downloadCodesPdf(set: RevealedCodes, stamp: string) {
  const blob = new Blob([buildPdf(codesPage(set, stamp))], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tirbeo-backup-codes.pdf";
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
