import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type Bill,
  type Customer,
  type DocKind,
  type Line,
  type Profile,
  type SizePart,
  SAMPLE_PROFILE,
  blankBill,
  blankLine,
  ensureNumbers,
  linkCustomers,
  nextBillNumber,
  sameCustomer,
  sampleBill,
  splitBuyer,
  todayISO,
} from "@/lib/bill-model";

export type BackupFile = {
  app: "av-interior";
  version: 1;
  savedAt: string;
  profile: Profile;
  customers: Customer[];
  docs: Bill[];
  activeId: string;
};

type BillsState = {
  profile: Profile;
  customers: Customer[];
  docs: Bill[];
  activeId: string;
  setProfile: (patch: Partial<Profile>) => void;
  restoreLetterhead: () => void;
  patchBill: (patch: Partial<Omit<Bill, "id" | "lines">>) => void;
  pickCustomer: (id: string) => void;
  patchLine: (lineId: string, patch: Partial<Omit<Line, "id">>) => void;
  addLine: () => void;
  removeLine: (lineId: string) => void;
  newBill: (kind: DocKind) => void;
  newFromPrevious: () => void;
  duplicateBill: () => void;
  deleteBill: (id: string) => void;
  selectBill: (id: string) => void;
  loadSample: () => void;
  importBackup: (raw: BackupFile) => void;
};

function touch(bill: Bill, patch: Partial<Bill>): Bill {
  return { ...bill, ...patch, updatedAt: Date.now() };
}

function normalizeSize(raw: Partial<SizePart> | undefined): SizePart {
  return {
    id: raw?.id || crypto.randomUUID(),
    size: typeof raw?.size === "string" ? raw.size : "",
    quantity: raw?.quantity?.trim() ? raw.quantity : "1",
  };
}

function normalizeLine(raw: (Partial<Line> & { size?: string }) | undefined): Line {
  const legacySize = typeof raw?.size === "string" ? raw.size : "";
  const sizes = Array.isArray(raw?.sizes)
    ? raw.sizes.map((part) => normalizeSize(part))
    : legacySize.trim()
      ? [normalizeSize({ size: legacySize, quantity: raw?.quantity })]
      : [];
  return {
    id: raw?.id || crypto.randomUUID(),
    description: raw?.description ?? "",
    sizes,
    quantity: raw?.quantity ?? "",
    rate: raw?.rate ?? "",
    sqft: raw?.sqft ?? "-",
    manual: Boolean(raw?.manual),
    manualAmount: raw?.manualAmount ?? "",
  };
}

function cloneLines(lines: Line[]): Line[] {
  return lines.map((line) => ({
    ...line,
    id: crypto.randomUUID(),
    sizes: line.sizes.map((part) => ({ ...part, id: crypto.randomUUID() })),
  }));
}

function normalizeBill(raw: Partial<Bill> | undefined, fallback: Bill): Bill {
  if (!raw || typeof raw !== "object") return fallback;
  const lines = Array.isArray(raw.lines) ? raw.lines.map((line) => normalizeLine(line)) : fallback.lines;
  const kind = raw.kind === "quotation" ? "quotation" : raw.kind === "invoice" ? "invoice" : fallback.kind;
  let customerName = typeof raw.customerName === "string" ? raw.customerName : "";
  let buyer = raw.buyer ?? "";
  if (!customerName.trim() && buyer.trim()) {
    const split = splitBuyer(buyer);
    customerName = split.name;
    buyer = split.address;
  }
  return {
    id: raw.id || fallback.id,
    kind,
    date: raw.date || fallback.date,
    number: raw.number ?? "",
    customerId: typeof raw.customerId === "string" ? raw.customerId : "",
    customerName,
    buyer,
    phone: raw.phone ?? "",
    state: raw.state ?? "TamilNadu",
    code: raw.code ?? "33",
    lines: lines.length ? lines : [blankLine(kind)],
    advance: typeof raw.advance === "string" ? raw.advance : "",
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

function rememberCustomer(customers: Customer[], docs: Bill[], bill: Bill): { customers: Customer[]; bill: Bill } {
  const name = bill.customerName.trim();
  if (!name) return { customers, bill: { ...bill, customerId: "" } };
  const current = customers.find((customer) => customer.id === bill.customerId);
  const exact = customers.find((customer) => sameCustomer(customer.name, name));
  const details = { name, address: bill.buyer, phone: bill.phone, state: bill.state, code: bill.code };
  if (current) {
    const shared = docs.some((doc) => doc.id !== bill.id && doc.customerId === current.id);
    if (shared && !sameCustomer(current.name, name)) {
      const created: Customer = { id: crypto.randomUUID(), ...details };
      return { customers: [...customers, created], bill: { ...bill, customerId: created.id } };
    }
    if (exact && exact.id !== current.id) {
      return { customers, bill: { ...bill, customerId: exact.id } };
    }
    return {
      customers: customers.map((customer) => (customer.id === current.id ? { ...customer, ...details } : customer)),
      bill,
    };
  }
  if (exact) return { customers, bill: { ...bill, customerId: exact.id } };
  const created: Customer = { id: crypto.randomUUID(), ...details };
  return { customers: [...customers, created], bill: { ...bill, customerId: created.id } };
}

const initialBill = sampleBill();
const initialCustomers: Customer[] = [
  {
    id: initialBill.customerId,
    name: initialBill.customerName,
    address: initialBill.buyer,
    phone: initialBill.phone,
    state: initialBill.state,
    code: initialBill.code,
  },
];

export const useBills = create<BillsState>()(
  persist(
    (set, get) => ({
      profile: SAMPLE_PROFILE,
      customers: initialCustomers,
      docs: [initialBill],
      activeId: initialBill.id,
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      restoreLetterhead: () => set({ profile: { ...SAMPLE_PROFILE } }),
      patchBill: (patch) =>
        set((s) => {
          let customers = s.customers;
          const docs = s.docs.map((doc) => {
            if (doc.id !== s.activeId) return doc;
            const next = touch(doc, patch);
            const synced = rememberCustomer(customers, s.docs, next);
            customers = synced.customers;
            return synced.bill;
          });
          return { docs, customers };
        }),
      pickCustomer: (id) => {
        const customer = get().customers.find((item) => item.id === id);
        if (!customer) return;
        set((s) => ({
          docs: s.docs.map((doc) =>
            doc.id === s.activeId
              ? touch(doc, {
                  customerId: customer.id,
                  customerName: customer.name,
                  buyer: customer.address,
                  phone: customer.phone,
                  state: customer.state,
                  code: customer.code,
                })
              : doc,
          ),
        }));
      },
      patchLine: (lineId, patch) =>
        set((s) => ({
          docs: s.docs.map((doc) =>
            doc.id === s.activeId
              ? touch(doc, {
                  lines: doc.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
                })
              : doc,
          ),
        })),
      addLine: () =>
        set((s) => {
          const kind = s.docs.find((doc) => doc.id === s.activeId)?.kind;
          return {
            docs: s.docs.map((doc) =>
              doc.id === s.activeId ? touch(doc, { lines: [...doc.lines, blankLine(kind)] }) : doc,
            ),
          };
        }),
      removeLine: (lineId) =>
        set((s) => ({
          docs: s.docs.map((doc) => {
            if (doc.id !== s.activeId) return doc;
            const lines = doc.lines.filter((line) => line.id !== lineId);
            return touch(doc, { lines: lines.length ? lines : [blankLine(doc.kind)] });
          }),
        })),
      newBill: (kind) => {
        const bill = blankBill(kind);
        bill.number = nextBillNumber(get().docs, kind);
        set((s) => ({ docs: [bill, ...s.docs], activeId: bill.id }));
      },
      newFromPrevious: () => {
        const current = get().docs.find((doc) => doc.id === get().activeId);
        if (!current) return;
        const previous = get()
          .docs.filter(
            (doc) =>
              doc.id !== current.id &&
              ((current.customerId && doc.customerId === current.customerId) ||
                sameCustomer(doc.customerName, current.customerName)),
          )
          .sort((a, b) => {
            if (a.kind === current.kind && b.kind !== current.kind) return -1;
            if (b.kind === current.kind && a.kind !== current.kind) return 1;
            return b.updatedAt - a.updatedAt;
          })[0];
        if (!previous) return;
        const bill: Bill = {
          ...previous,
          id: crypto.randomUUID(),
          kind: current.kind,
          date: todayISO(),
          number: nextBillNumber(get().docs, current.kind),
          lines: cloneLines(previous.lines),
          advance: "",
          updatedAt: Date.now(),
        };
        set((s) => ({ docs: [bill, ...s.docs], activeId: bill.id }));
      },
      duplicateBill: () => {
        const current = get().docs.find((doc) => doc.id === get().activeId);
        if (!current) return;
        const copy: Bill = {
          ...current,
          id: crypto.randomUUID(),
          number: nextBillNumber(get().docs, current.kind),
          lines: cloneLines(current.lines),
          updatedAt: Date.now(),
        };
        set((s) => ({ docs: [copy, ...s.docs], activeId: copy.id }));
      },
      deleteBill: (id) =>
        set((s) => {
          const docs = s.docs.filter((doc) => doc.id !== id);
          const activeId = s.activeId === id ? (docs[0]?.id ?? "") : s.activeId;
          return { docs, activeId };
        }),
      selectBill: (id) => set({ activeId: id }),
      loadSample: () => {
        const bill = sampleBill(crypto.randomUUID(), crypto.randomUUID());
        bill.number = nextBillNumber(get().docs, "invoice");
        bill.updatedAt = Date.now();
        set((s) => ({ docs: [bill, ...s.docs], activeId: bill.id }));
      },
      importBackup: (raw) => {
        if (!raw || raw.app !== "av-interior" || !Array.isArray(raw.docs)) {
          throw new Error("That file is not an AV Interior backup.");
        }
        const profile = { ...SAMPLE_PROFILE, ...(raw.profile ?? {}) };
        if (profile.signature == null) profile.signature = SAMPLE_PROFILE.signature;
        const fallback = sampleBill();
        const docs = raw.docs.map((doc) => normalizeBill(doc, fallback));
        if (!docs.length) throw new Error("That backup has no bills.");
        const linked = linkCustomers(ensureNumbers(docs), raw.customers);
        const activeId = linked.docs.some((doc) => doc.id === raw.activeId)
          ? raw.activeId
          : linked.docs[0].id;
        set({ profile, docs: linked.docs, customers: linked.customers, activeId });
      },
    }),
    {
      name: "av-interior-bills-v1",
      skipHydration: true,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profile: state.profile,
        customers: state.customers,
        docs: state.docs,
        activeId: state.activeId,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object") return current;
        const saved = persisted as Partial<Pick<BillsState, "profile" | "customers" | "docs" | "activeId">>;
        const profile = { ...SAMPLE_PROFILE, ...(saved.profile ?? {}) };
        if (profile.signature == null) profile.signature = SAMPLE_PROFILE.signature;
        const fallback = current.docs[0] ?? sampleBill();
        const docs = Array.isArray(saved.docs)
          ? saved.docs.map((doc) => normalizeBill(doc, fallback))
          : current.docs;
        const safeDocs = ensureNumbers(docs.length ? docs : current.docs);
        const linked = linkCustomers(safeDocs, saved.customers);
        const activeId = linked.docs.some((doc) => doc.id === saved.activeId)
          ? (saved.activeId as string)
          : (linked.docs[0]?.id ?? "");
        return { ...current, profile, docs: linked.docs, customers: linked.customers, activeId };
      },
    },
  ),
);

export function makeBackup(): BackupFile {
  const state = useBills.getState();
  return {
    app: "av-interior",
    version: 1,
    savedAt: new Date().toISOString(),
    profile: state.profile,
    customers: state.customers,
    docs: state.docs,
    activeId: state.activeId,
  };
}
