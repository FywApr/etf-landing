import { renderToBuffer } from "@react-pdf/renderer";
import { etfs } from "@/data/etfs";
import { GuideDocument } from "@/lib/guide/GuideDocument";

export const GUIDE_FILE_NAME = "pruvodce-americkymi-etf.pdf";

/** Renders the guide from the canonical ETF data. Nothing is cached on disk. */
export function renderGuidePdf(): Promise<Buffer> {
  return renderToBuffer(<GuideDocument funds={etfs} />);
}
