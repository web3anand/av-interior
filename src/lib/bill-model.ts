import { formatSq, inrWords, parseNum, round2 } from "@/lib/money";

export type DocKind = "invoice" | "quotation";

export type SizePart = {
  id: string;
  size: string;
  quantity: string;
};

export type Line = {
  id: string;
  description: string;
  sizes: SizePart[];
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
  customerId: string;
  customerName: string;
  buyer: string;
  phone: string;
  state: string;
  code: string;
  lines: Line[];
  advance: string;
  updatedAt: number;
};

export type Customer = {
  id: string;
  name: string;
  address: string;
  phone: string;
  state: string;
  code: string;
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

export function pdfFileName(bill: Bill): string {
  const label = bill.kind === "invoice" ? "Invoice" : "Quotation";
  const number = bill.number.trim() || "draft";
  const name = bill.customerName.trim();
  const base = name ? `${label} ${number} - ${name}` : `${label} ${number}`;
  return base.replace(/[\\/:*?"<>|]/g, "-");
}

export function sameCustomer(a: string, b: string): boolean {
  const tidy = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
  return tidy(a) === tidy(b) && tidy(a).length > 0;
}

export function printedBuyer(bill: Bill): string {
  const name = bill.customerName.trim();
  const address = bill.buyer.trim();
  if (name && address) return `${name}\n${address}`;
  return name || address;
}

export function splitBuyer(buyer: string): { name: string; address: string } {
  const lines = buyer.split("\n");
  const name = (lines[0] ?? "").trim();
  const address = lines.slice(1).join("\n").trim();
  return { name, address };
}

export function numberLabel(kind: DocKind): string {
  return kind === "invoice" ? "Invoice No." : "Quote No.";
}

export function docTitle(kind: DocKind): string {
  return kind === "invoice" ? "Invoice" : "Quotation";
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

export function advanceLabel(kind: DocKind): string {
  return kind === "invoice" ? "Advance" : "Booking advance";
}

export function balanceLabel(kind: DocKind): string {
  return kind === "invoice" ? "Remaining" : "Balance";
}

export function footerLine(kind: DocKind): string {
  return kind === "invoice"
    ? "This is Computer Generated Invoice"
    : "This is Computer Generated Quotation";
}

export function declarationFor(profile: Profile, kind: DocKind): string {
  return kind === "invoice" ? profile.declarationInvoice : profile.declarationQuote;
}

export function wordsLabel(kind: DocKind): string {
  return kind === "invoice" ? "Amount Chargeable (in words)" : "Amount Quoted (in words)";
}

export function blankSize(quantity = "1"): SizePart {
  return { id: crypto.randomUUID(), size: "", quantity: quantity.trim() || "1" };
}

export function blankLine(kind?: DocKind): Line {
  return {
    id: crypto.randomUUID(),
    description: "",
    sizes: kind === "quotation" ? [blankSize()] : [],
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
    customerId: "sample-customer-medical",
    customerName: "Medical Officer ,",
    buyer: "Urban primary health center-madathur , thoothukudi",
    phone: "",
    state: "TamilNadu",
    code: "33",
    lines: [
      {
        id: lineId,
        description: "Three Seater Chair",
        sizes: [],
        quantity: "1",
        rate: "3950",
        sqft: "-",
        manual: false,
        manualAmount: "",
      },
    ],
    advance: "",
    updatedAt: 1_780_416_000_000,
  };
}

export function blankBill(kind: DocKind): Bill {
  return {
    id: crypto.randomUUID(),
    kind,
    date: todayISO(),
    number: "",
    customerId: "",
    customerName: "",
    buyer: "",
    phone: "",
    state: "TamilNadu",
    code: "33",
    lines: [blankLine(kind)],
    advance: "",
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

export function parseSize(raw: string): { length: number; width: number } | null {
  const match = raw
    .trim()
    .replace(/×/g, "x")
    .match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet|')?\s*[x*]\s*(\d+(?:\.\d+)?)\s*(?:ft|feet|')?$/i);
  if (!match) return null;
  const length = Number(match[1]);
  const width = Number(match[2]);
  if (!length || !width) return null;
  return { length, width };
}

export function prettySize(raw: string): string {
  const dims = parseSize(raw);
  if (!dims) return raw.trim();
  return `${dims.length} × ${dims.width}`;
}

/** Length × width × qty, rounded to a whole number. Qty is 1 when blank. */
export function roundedSqft(size: string, quantity: string): string | null {
  const dims = parseSize(size);
  if (!dims) return null;
  const qty = parseNum(quantity);
  const pieces = qty > 0 ? qty : 1;
  return String(Math.round(dims.length * dims.width * pieces));
}

export function partSqft(part: SizePart): number | null {
  const text = roundedSqft(part.size, part.quantity);
  return text == null ? null : Number(text);
}

export function sizeLabel(part: SizePart): string {
  const pretty = prettySize(part.size);
  const qty = parseNum(part.quantity);
  if (qty > 0 && qty !== 1) return `${pretty} × ${qty}`;
  return pretty;
}

export function filledSizes(line: Line): SizePart[] {
  return line.sizes.filter((part) => parseSize(part.size));
}

/** Sum of each rounded size. Null when no size can be read. */
export function measuresFromSizes(sizes: SizePart[]): { sqft: string; quantity: string } | null {
  let area = 0;
  let pieces = 0;
  let any = false;
  for (const part of sizes) {
    const sq = partSqft(part);
    if (sq == null) continue;
    any = true;
    area += sq;
    const qty = parseNum(part.quantity);
    pieces += qty > 0 ? qty : 1;
  }
  if (!any) return null;
  return { sqft: String(area), quantity: String(pieces) };
}

export function lineAmount(line: Line): number {
  if (line.manual) return round2(parseNum(line.manualAmount));
  const rate = parseNum(line.rate);
  const sq = sqMultiplier(line.sqft);
  if (sq === null) return round2(rate);
  return round2(sq * rate);
}

export function lineFormula(line: Line): string {
  if (line.manual) return "Typed amount";
  if (sqMultiplier(line.sqft) === null) return "Rate";
  return "Sq.ft × Rate";
}

export function billTotal(bill: Bill): number {
  return round2(bill.lines.reduce((sum, line) => sum + lineAmount(line), 0));
}

export function billAdvance(bill: Bill): number {
  return round2(parseNum(bill.advance));
}

export function billBalance(bill: Bill): number {
  return round2(billTotal(bill) - billAdvance(bill));
}

export function billWords(bill: Bill): string {
  return inrWords(billTotal(bill));
}

export function printSq(raw: string): string {
  return formatSq(raw);
}

export function normalizeCustomer(raw: Partial<Customer> | undefined): Customer | null {
  if (!raw || typeof raw !== "object") return null;
  const name = (raw.name ?? "").trim();
  if (!name) return null;
  return {
    id: raw.id || crypto.randomUUID(),
    name,
    address: raw.address ?? "",
    phone: raw.phone ?? "",
    state: raw.state ?? "",
    code: raw.code ?? "",
  };
}

export function linkCustomers(docs: Bill[], saved: unknown): { docs: Bill[]; customers: Customer[] } {
  const customers: Customer[] = [];
  if (Array.isArray(saved)) {
    for (const item of saved) {
      const customer = normalizeCustomer(item as Partial<Customer>);
      if (customer && !customers.some((existing) => existing.id === customer.id)) customers.push(customer);
    }
  }
  const next = docs.map((doc) => {
    const name = doc.customerName.trim();
    if (!name) return { ...doc, customerId: "" };
    let customer = customers.find((item) => item.id === doc.customerId);
    if (!customer) customer = customers.find((item) => sameCustomer(item.name, name));
    if (!customer) {
      customer = {
        id: doc.customerId || crypto.randomUUID(),
        name,
        address: doc.buyer,
        phone: doc.phone,
        state: doc.state,
        code: doc.code,
      };
      customers.push(customer);
    }
    return { ...doc, customerId: customer.id };
  });
  customers.sort((a, b) => a.name.localeCompare(b.name));
  return { docs: next, customers };
}

export const MIN_BODY_ROWS = 8;
