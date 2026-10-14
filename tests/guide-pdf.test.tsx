import { inflateSync } from "node:zlib";
import { renderToBuffer } from "@react-pdf/renderer";
import { beforeAll, describe, expect, it } from "vitest";
import { etfs } from "@/data/etfs";
import { GuideDocument } from "@/lib/guide/GuideDocument";
import { renderGuidePdf } from "@/lib/guide/render";

/** Link targets are stored uncompressed in the PDF's annotation objects. */
function linkTargets(pdf: Buffer): string[] {
  return [...pdf.toString("latin1").matchAll(/\/URI \((.*?)\)/g)].map((match) => match[1]);
}

/** Number of page objects, from the uncompressed page tree. */
function pageCount(pdf: Buffer): number {
  return (pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length;
}

/** Total size of all decompressed content streams: a proxy for "has real content". */
function decompressedSize(pdf: Buffer): number {
  const raw = pdf.toString("latin1");
  let total = 0;
  for (const match of raw.matchAll(/\/Filter \/FlateDecode[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    try {
      total += inflateSync(Buffer.from(match[1], "latin1")).length;
    } catch {
      // Not every stream is plain deflate; ignore those.
    }
  }
  return total;
}

describe("guide PDF", () => {
  let pdf: Buffer;

  beforeAll(async () => {
    pdf = await renderGuidePdf();
  }, 30_000);

  it("is a complete PDF file", () => {
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.subarray(-32).toString("latin1")).toContain("%%EOF");
    expect(pdf.byteLength).toBeGreaterThan(20_000);
  });

  it("has several pages of real content", () => {
    expect(pageCount(pdf)).toBeGreaterThanOrEqual(3);
    expect(decompressedSize(pdf)).toBeGreaterThan(10_000);
  });

  it("embeds a font instead of relying on built-in ones without Czech glyphs", () => {
    expect(pdf.toString("latin1")).toMatch(/NotoSans/);
  });

  it("links to every official source URL in the canonical data, and nothing else", () => {
    const expected = etfs.flatMap((etf) => etf.sources.map((source) => source.url));
    expect(linkTargets(pdf).sort()).toEqual([...expected].sort());
  });

  it("follows the data: fewer funds produce fewer links", async () => {
    const single = await renderToBuffer(<GuideDocument funds={etfs.slice(0, 1)} />);
    expect(linkTargets(single)).toHaveLength(etfs[0].sources.length);
  }, 30_000);
});
