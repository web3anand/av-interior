import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  type Bill,
  type DocKind,
  type Line,
  type Profile,
  SAMPLE_PROFILE,
  blankBill,
  blankLine,
  ensureNumbers,
  nextBillNumber,
  sampleBill,
} from "@/lib/bill-model";

type BillsState = {
  profile: Profile;
  docs: Bill[];
  activeId: string;
  setProfile: (patch: Partial<Profile>) => void;
  restoreLetterhead: () => void;
  patchBill: (patch: Partial<Omit<Bill, "id" | "lines">>) => void;
  patchLine: (lineId: string, patch: Partial<Omit<Line, "id">>) => void;
  addLine: () => void;
  removeLine: (lineId: string) => void;
  newBill: (kind: DocKind) => void;
  duplicateBill: () => void;
  deleteBill: (id: string) => void;
  selectBill: (id: string) => void;
  loadSample: () => void;
};

function touch(bill: Bill, patch: Partial<Bill>): Bill {
  return { ...bill, ...patch, updatedAt: Date.now() };
}

function normalizeLine(raw: Partial<Line> | undefined): Line {
  return {
    id: raw?.id || crypto.randomUUID(),
    description: raw?.description ?? "",
    quantity: raw?.quantity ?? "",
    rate: raw?.rate ?? "",
    sqft: raw?.sqft ?? "-",
    manual: Boolean(raw?.manual),
    manualAmount: raw?.manualAmount ?? "",
  };
}

function normalizeBill(raw: Partial<Bill> | undefined, fallback: Bill): Bill {
  if (!raw || typeof raw !== "object") return fallback;
  const lines = Array.isArray(raw.lines) ? raw.lines.map((line) => normalizeLine(line)) : fallback.lines;
  const kind = raw.kind === "quotation" ? "quotation" : raw.kind === "invoice" ? "invoice" : fallback.kind;
  return {
    id: raw.id || fallback.id,
    kind,
    date: raw.date || fallback.date,
    number: raw.number ?? "",
    buyer: raw.buyer ?? "",
    phone: raw.phone ?? "",
    state: raw.state ?? "TamilNadu",
    code: raw.code ?? "33",
    lines: lines.length ? lines : [blankLine()],
    updatedAt: typeof raw.updatedAt === "number" ? raw.updatedAt : Date.now(),
  };
}

const initialBill = sampleBill();

export const useBills = create<BillsState>()(
  persist(
    (set, get) => ({
      profile: SAMPLE_PROFILE,
      docs: [initialBill],
      activeId: initialBill.id,
      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
      restoreLetterhead: () => set({ profile: { ...SAMPLE_PROFILE } }),
      patchBill: (patch) =>
        set((s) => ({
          docs: s.docs.map((doc) => (doc.id === s.activeId ? touch(doc, patch) : doc)),
        })),
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
        set((s) => ({
          docs: s.docs.map((doc) =>
            doc.id === s.activeId ? touch(doc, { lines: [...doc.lines, blankLine()] }) : doc,
          ),
        })),
      removeLine: (lineId) =>
        set((s) => ({
          docs: s.docs.map((doc) => {
            if (doc.id !== s.activeId) return doc;
            const lines = doc.lines.filter((line) => line.id !== lineId);
            return touch(doc, { lines: lines.length ? lines : [blankLine()] });
          }),
        })),
      newBill: (kind) => {
        const bill = blankBill(kind);
        bill.number = nextBillNumber(get().docs, kind);
        set((s) => ({ docs: [bill, ...s.docs], activeId: bill.id }));
      },
      duplicateBill: () => {
        const current = get().docs.find((doc) => doc.id === get().activeId);
        if (!current) return;
        const copy: Bill = {
          ...current,
          id: crypto.randomUUID(),
          number: nextBillNumber(get().docs, current.kind),
          lines: current.lines.map((line) => ({ ...line, id: crypto.randomUUID() })),
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
    }),
    {
      name: "av-interior-bills-v1",
      skipHydration: true,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profile: state.profile,
        docs: state.docs,
        activeId: state.activeId,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== "object") return current;
        const saved = persisted as Partial<Pick<BillsState, "profile" | "docs" | "activeId">>;
        const profile = { ...SAMPLE_PROFILE, ...(saved.profile ?? {}) };
        if (profile.signature == null) profile.signature = SAMPLE_PROFILE.signature;
        const fallback = current.docs[0] ?? sampleBill();
        const docs = Array.isArray(saved.docs)
          ? saved.docs.map((doc) => normalizeBill(doc, fallback))
          : current.docs;
        const safeDocs = ensureNumbers(docs.length ? docs : current.docs);
        const activeId = safeDocs.some((doc) => doc.id === saved.activeId)
          ? (saved.activeId as string)
          : (safeDocs[0]?.id ?? "");
        return { ...current, profile, docs: safeDocs, activeId };
      },
    },
  ),
);
