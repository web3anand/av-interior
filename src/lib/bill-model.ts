import { formatSq, inrWords, parseNum, round2 } from "@/lib/money";

export type DocKind = "invoice" | "quotation";

export type Line = {
  id: string;
  description: string;
  quantity: string;
  rate: string;
  sqft: string;
  manual: boolean;
  manualAmount: string;
};

export type Bill = {
  id: string;
  kind: DocKind;
  date: string;
  number: string;
  buyer: string;
  phone: string;
  state: string;
  code: string;
  lines: Line[];
  updatedAt: number;
};

export type Profile = {
  name: string;
  address: string;
  gstin: string;
  mobile: string;
  email: string;
  accountName: string;
  accountNo: string;
  ifsc: string;
  branch: string;
  bank: string;
  declarationInvoice: string;
  declarationQuote: string;
  signature: string | null;
};

export const SAMPLE_PROFILE: Profile = {
  name: "AV INTERIOR DECORATION",
  address: "2H/785B ANNAI THERESA NAGAR\nTHOOTHUKUDI - 628002",
  gstin: "33AYTPN6465F1ZY",
  mobile: "9715032513",
  email: "avinterior.info@gmail.com",
  accountName: "AV INTERIOR DECORATION",
  accountNo: "50200074494600",
  ifsc: "HDFC0001104",
  branch: "TUTICORIN",
  bank: "HDFC Bank ( India )",
  declarationInvoice: "We declare that this invoice shows the actual price of the goods",
  declarationQuote: "We declare that this quotation shows the actual price of the goods",
  signature: "/signature.png",
};

export function numberLabel(kind: DocKind): string {
  return kind === "invoice" ? "Invoice No." : "Quote No.";
}

export function docTitle(kind: DocKind): string {
  return kind === "invoice" ? "INVOICE" : "QUOTATION";
}

export function nextBillNumber(docs: Bill[], kind: DocKind): string {
  let max = 0;
  for (const doc of docs) {
    if (doc.kind !== kind) continue;
    const match = /(\d+)\s*$/.exec(doc.number.trim());
    if (match) max = Math.max(max, Number(match[1]));
  }
  return String(max + 1);
}

export function ensureNumbers(docs: Bill[]): Bill[] {
  const seq: Record<DocKind, number> = { invoice: 0, quotation: 0 };
  const used: Record<DocKind, Set<string>> = { invoice: new Set(), quotation: new Set() };
  for (const doc of docs) {
    const n = doc.number.trim();
    if (!n) continue;
    used[doc.kind].add(n);
    const match = /(\d+)\s*$/.exec(n);
    if (match) seq[doc.kind] = Math.max(seq[doc.kind], Number(match[1]));
  }
  return docs.map((doc) => {
    if (doc.number.trim()) return doc;
    let n = "";
    do {
      seq[doc.kind] += 1;
      n = String(seq[doc.kind]);
    } while (used[doc.kind].has(n));
    used[doc.kind].add(n);
    return { ...doc, number: n };
  });
}

export function wordsLabel(kind: DocKind): string {
  return kind === "invoice" ? "Amount chargeable ( in words )" : "Amount quoted ( in words )";
}

export function footerLine(kind: DocKind): string {
  return kind === "invoice"
    ? "This is Computer Generated Invoice"
    : "This is Computer Generated Quotation";
}

export function declarationFor(profile: Profile, kind: DocKind): string {
  return kind === "invoice" ? profile.declarationInvoice : profile.declarationQuote;
}

export function blankLine(): Line {
  return {
    id: crypto.randomUUID(),
    description: "",
    quantity: "1",
    rate: "",
    sqft: "-",
    manual: false,
    manualAmount: "",
  };
}

export function todayISO(): string {
  const d = new Date();
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function sampleBill(
  id = "sample-chair-invoice",
  lineId = "sample-chair-line",
): Bill {
  return {
    id,
    kind: "invoice",
    date: "2026-06-03",
    number: "1",
    buyer: "Medical Officer ,\nUrban primary health center-madathur , thoothukudi",
    phone: "",
    state: "TamilNadu",
    code: "33",
    lines: [
      {
        id: lineId,
        description: "Three Seater Chair",
        quantity: "1",
        rate: "3950",
        sqft: "-",
        manual: false,
        manualAmount: "",
      },
    ],
    updatedAt: 1_780_416_000_000,
  };
}

export function blankBill(kind: DocKind): Bill {
  return {
    id: crypto.randomUUID(),
    kind,
    date: todayISO(),
    number: "",
    buyer: "",
    phone: "",
    state: "TamilNadu",
    code: "33",
    lines: [blankLine()],
    updatedAt: Date.now(),
  };
}

function sqMultiplier(raw: string): number | null {
  const t = raw.trim();
  if (!t || t === "-" || t === "–" || t === "—") return null;
  const n = parseNum(t);
  if (!n) return null;
  return n;
}

export function lineAmount(line: Line): number {
  if (line.manual) return round2(parseNum(line.manualAmount));
  const qty = parseNum(line.quantity);
  const rate = parseNum(line.rate);
  const sq = sqMultiplier(line.sqft);
  if (sq === null) return round2(qty * rate);
  return round2(qty * rate * sq);
}

export function lineFormula(line: Line): string {
  if (line.manual) return "Typed amount";
  if (sqMultiplier(line.sqft) === null) return "Qty × Rate";
  return "Qty × Rate × Sq.ft";
}

export function billTotal(bill: Bill): number {
  return round2(bill.lines.reduce((sum, line) => sum + lineAmount(line), 0));
}

export function billWords(bill: Bill): string {
  return inrWords(billTotal(bill));
}

export function printSq(raw: string): string {
  return formatSq(raw);
}

export const MIN_BODY_ROWS = 6;
