import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Copy,
  ImagePlus,
  Lock,
  LockOpen,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import { BillSheet } from "@/components/bill-sheet";
import { PhoneBackup } from "@/components/phone-backup";
import {
  type Bill,
  type Customer,
  type DocKind,
  type Line,
  type Profile,
  billTotal,
  billAdvance,
  billBalance,
  billWords,
  docTitle,
  lineAmount,
  lineFormula,
  measuresFromSizes,
  partSqft,
  pdfFileName,
  sameCustomer,
  blankSize,
  advanceLabel,
  balanceLabel,
} from "@/lib/bill-model";
import { formatDocDate, formatInr } from "@/lib/money";
import { readSignature } from "@/lib/signature";
import { useBills } from "@/lib/store";

type Pane = "edit" | "preview";

const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base text-ink outline-none focus-visible:border-olive";
const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-olive px-4 text-sm font-semibold text-cream transition-colors duration-150 hover:bg-olive-deep disabled:opacity-50";
const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm font-semibold text-ink transition-colors duration-150 hover:border-olive";
const btnQuiet =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface";

function buyerTitle(bill: Bill): string {
  const named = bill.customerName.trim();
  if (named) return named;
  const line = bill.buyer.split("\n").map((part) => part.trim()).find(Boolean);
  return line || "No customer yet";
}

type KindFilter = "all" | DocKind;

function matchesQuery(doc: Bill, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    doc.number,
    doc.customerName,
    doc.buyer,
    doc.phone,
    doc.kind === "invoice" ? "invoice" : "quote quotation",
    `${doc.kind === "invoice" ? "invoice" : "quote"} ${doc.number}`,
    ...doc.lines.map((line) => line.description),
  ]
    .join("\n")
    .toLowerCase();
  return q.split(/\s+/).every((part) => hay.includes(part));
}

export function Desk() {
  const profile = useBills((s) => s.profile);
  const docs = useBills((s) => s.docs);
  const customers = useBills((s) => s.customers);
  const activeId = useBills((s) => s.activeId);
  const setProfile = useBills((s) => s.setProfile);
  const restoreLetterhead = useBills((s) => s.restoreLetterhead);
  const patchBill = useBills((s) => s.patchBill);
  const patchLine = useBills((s) => s.patchLine);
  const addLine = useBills((s) => s.addLine);
  const removeLine = useBills((s) => s.removeLine);
  const newBill = useBills((s) => s.newBill);
  const duplicateBill = useBills((s) => s.duplicateBill);
  const deleteBill = useBills((s) => s.deleteBill);
  const newFromPrevious = useBills((s) => s.newFromPrevious);
  const pickCustomer = useBills((s) => s.pickCustomer);
  const selectBill = useBills((s) => s.selectBill);
  const loadSample = useBills((s) => s.loadSample);

  const [pane, setPane] = useState<Pane>("edit");
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sigError, setSigError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void useBills.persist.rehydrate();
  }, []);

  const bill = docs.find((doc) => doc.id === activeId) ?? null;

  useEffect(() => {
    setConfirmDelete(false);
  }, [bill?.id]);

  useEffect(() => {
    document.title = bill ? pdfFileName(bill) : "AV Interior — Invoice & Quote";
  }, [bill]);

  const visible = [...docs]
    .filter((doc) => (kindFilter === "all" ? true : doc.kind === kindFilter))
    .filter((doc) => matchesQuery(doc, query))
    .sort((a, b) => b.updatedAt - a.updatedAt);

  function start(kind: DocKind) {
    newBill(kind);
    setPane("edit");
  }

  return (
    <div className="desk flex min-h-dvh flex-col overflow-x-hidden bg-canvas text-ink lg:h-dvh lg:overflow-hidden">
      <div className="no-print sticky top-0 z-20 border-b border-brass bg-olive-deep text-cream">
        <header className="flex items-center justify-between gap-3 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-cream/20">
              <HouseMark />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl leading-none text-cream">
                {profile.name || "AV Interior"}
              </p>
              <p className="mt-1 truncate text-sm text-cream/75">Invoice & quotation desk</p>
            </div>
          </div>
          <button type="button" className={`${btnPrimary} hidden shrink-0 lg:inline-flex`} onClick={() => window.print()} disabled={!bill}>
            <Printer className="size-4" aria-hidden="true" />
            Save PDF
          </button>
        </header>
      </div>

      <div className="desk-grid lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-3">
        <section
          className={`no-print border-line lg:col-span-1 lg:block lg:overflow-y-auto lg:border-r ${
            pane === "edit" ? "block" : "hidden"
          }`}
        >
          {bill ? (
            <Editor
              bill={bill}
              visible={visible}
              query={query}
              setQuery={setQuery}
              kindFilter={kindFilter}
              setKindFilter={setKindFilter}
              customers={customers}
              docs={docs}
              activeId={activeId}
              onSelect={(id) => {
                selectBill(id);
                setPane("edit");
              }}
              onStart={start}
              onDuplicate={() => {
                duplicateBill();
                setPane("edit");
              }}
              onLoadSample={() => {
                loadSample();
                setPane("edit");
              }}
              onUsePrevious={() => {
                newFromPrevious();
                setPane("edit");
              }}
              onPickCustomer={pickCustomer}
              confirmDelete={confirmDelete}
              setConfirmDelete={setConfirmDelete}
              onDelete={() => {
                deleteBill(bill.id);
                setConfirmDelete(false);
              }}
              patchBill={patchBill}
              patchLine={patchLine}
              addLine={addLine}
              removeLine={removeLine}
              profile={profile}
              setProfile={setProfile}
              restoreLetterhead={restoreLetterhead}
              sigError={sigError}
              setSigError={setSigError}
              fileRef={fileRef}
            />
          ) : (
            <EmptyDesk onStart={start} onLoadSample={loadSample} />
          )}
        </section>

        <section
          className={`sheet-column bg-canvas lg:col-span-2 lg:block lg:overflow-y-auto ${
            pane === "preview" ? "block" : "hidden"
          }`}
        >
          <p className="no-print px-4 pt-4 text-sm text-muted">
            This bill is saved on this device. Save PDF uses the file name{" "}
            <span className="font-semibold text-ink">{bill ? pdfFileName(bill) : "Invoice 1"}</span>. Turn on{" "}
            <span className="font-semibold text-ink">Background graphics</span> so the green header prints.
          </p>
          <div className="px-3 py-4 pb-28 sm:px-5 lg:pb-4">
            {bill ? (
              <ScaledBill>
                <BillSheet bill={bill} profile={profile} />
              </ScaledBill>
            ) : (
              <p className="px-2 text-muted">Create a bill to see it here.</p>
            )}
          </div>
        </section>
      </div>
      <nav className="no-print fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-cream/20 bg-olive-deep pb-[env(safe-area-inset-bottom)] text-cream lg:hidden">
        <button
          type="button"
          className={`min-h-14 text-sm font-semibold ${pane === "edit" ? "bg-cream text-olive-deep" : ""}`}
          onClick={() => setPane("edit")}
        >
          Edit
        </button>
        <button
          type="button"
          className={`min-h-14 text-sm font-semibold ${pane === "preview" ? "bg-cream text-olive-deep" : ""}`}
          onClick={() => setPane("preview")}
        >
          Preview
        </button>
        <button
          type="button"
          className="min-h-14 text-sm font-semibold disabled:opacity-40"
          onClick={() => window.print()}
          disabled={!bill}
        >
          Save PDF
        </button>
      </nav>
    </div>
  );
}

function EmptyDesk({
  onStart,
  onLoadSample,
}: {
  onStart: (kind: DocKind) => void;
  onLoadSample: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <h2 className="font-display text-2xl">No bills yet</h2>
      <p className="text-muted">Start a blank invoice or quotation, or bring back the sample chair bill.</p>
      <button type="button" className={btnPrimary} onClick={() => onStart("invoice")}>
        New invoice
      </button>
      <button type="button" className={btnGhost} onClick={() => onStart("quotation")}>
        New quotation
      </button>
      <button type="button" className={btnQuiet} onClick={onLoadSample}>
        Load sample bill
      </button>
    </div>
  );
}

function Editor({
  bill,
  visible,
  query,
  setQuery,
  kindFilter,
  setKindFilter,
  customers,
  docs,
  activeId,
  onSelect,
  onStart,
  onDuplicate,
  onLoadSample,
  onUsePrevious,
  onPickCustomer,
  confirmDelete,
  setConfirmDelete,
  onDelete,
  patchBill,
  patchLine,
  addLine,
  removeLine,
  profile,
  setProfile,
  restoreLetterhead,
  sigError,
  setSigError,
  fileRef,
}: {
  bill: Bill;
  visible: Bill[];
  query: string;
  setQuery: (value: string) => void;
  kindFilter: KindFilter;
  setKindFilter: (value: KindFilter) => void;
  customers: Customer[];
  docs: Bill[];
  activeId: string;
  onSelect: (id: string) => void;
  onStart: (kind: DocKind) => void;
  onDuplicate: () => void;
  onLoadSample: () => void;
  onUsePrevious: () => void;
  onPickCustomer: (id: string) => void;
  confirmDelete: boolean;
  setConfirmDelete: (value: boolean) => void;
  onDelete: () => void;
  patchBill: (patch: Partial<Omit<Bill, "id" | "lines">>) => void;
  patchLine: (lineId: string, patch: Partial<Omit<Line, "id">>) => void;
  addLine: () => void;
  removeLine: (lineId: string) => void;
  profile: Profile;
  setProfile: (patch: Partial<Profile>) => void;
  restoreLetterhead: () => void;
  sigError: string;
  setSigError: (value: string) => void;
  fileRef: RefObject<HTMLInputElement | null>;
}) {
  const total = billTotal(bill);
  const advance = billAdvance(bill);
  const balance = billBalance(bill);
  const earlier = docs
    .filter(
      (doc) =>
        doc.id !== bill.id &&
        ((bill.customerId && doc.customerId === bill.customerId) ||
          sameCustomer(doc.customerName, bill.customerName)),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const filters: { id: KindFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "invoice", label: "Invoices" },
    { id: "quotation", label: "Quotes" },
  ];

  return (
    <div className="flex flex-col gap-6 p-4 pb-28 lg:pb-8">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg">Saved bills</h2>
          <span className="text-sm text-muted">{visible.length}</span>
        </div>
        <input
          className={inputClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Invoice 1, quote 2, or customer"
          aria-label="Search bills"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`min-h-11 rounded-full px-3 text-sm font-semibold ${
                kindFilter === item.id ? "bg-olive text-cream" : "bg-surface text-ink"
              }`}
              onClick={() => setKindFilter(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">Every change is saved automatically on this phone.</p>
        <PhoneBackup />
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={btnGhost} onClick={() => onStart("invoice")}>
            <Plus className="size-4" aria-hidden="true" />
            Invoice
          </button>
          <button type="button" className={btnGhost} onClick={() => onStart("quotation")}>
            <Plus className="size-4" aria-hidden="true" />
            Quote
          </button>
        </div>
        <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
          {visible.length === 0 ? (
            <li className="px-1 py-2 text-sm text-muted">No bills match that search.</li>
          ) : (
            visible.map((doc) => {
              const active = doc.id === activeId;
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(doc.id)}
                    className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border-l-4 px-3 py-3 text-left ${
                      active ? "border-olive bg-surface" : "border-transparent hover:bg-surface"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold tracking-wide text-brass">
                        {docTitle(doc.kind)} No. {doc.number} · {formatDocDate(doc.date)}
                      </span>
                      <span className="block truncate text-sm">{buyerTitle(doc)}</span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatInr(billTotal(doc))}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>

      <section>
        <h2 className="mb-3 font-display text-lg">
          <span className="mr-2 font-sans text-sm font-semibold text-brass">01</span>
          Document
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className={bill.kind === "invoice" ? btnPrimary : btnGhost}
            onClick={() => patchBill({ kind: "invoice" })}
          >
            Invoice
          </button>
          <button
            type="button"
            className={bill.kind === "quotation" ? btnPrimary : btnGhost}
            onClick={() => patchBill({ kind: "quotation" })}
          >
            Quotation
          </button>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Date</span>
            <input
              type="date"
              className={inputClass}
              value={bill.date}
              onChange={(event) => patchBill({ date: event.target.value })}
            />
            <span className="mt-1 block text-sm text-muted">Prints as {formatDocDate(bill.date)}</span>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">
              {bill.kind === "invoice" ? "Invoice number" : "Quotation number"}
            </span>
            <input
              className={inputClass}
              value={bill.number}
              onChange={(event) => patchBill({ number: event.target.value })}
              aria-label={bill.kind === "invoice" ? "Invoice number" : "Quotation number"}
              autoComplete="off"
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg">
          <span className="mr-2 font-sans text-sm font-semibold text-brass">02</span>
          Buyer
        </h2>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-muted">Saved customer</span>
          <select
            className={inputClass}
            value={customers.some((customer) => customer.id === bill.customerId) ? bill.customerId : ""}
            onChange={(event) => {
              if (event.target.value) onPickCustomer(event.target.value);
            }}
          >
            <option value="">Choose a customer to fill this bill</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-muted">Customer name</span>
          <input
            className={inputClass}
            value={bill.customerName}
            onChange={(event) => patchBill({ customerName: event.target.value })}
            placeholder="Name printed above the address"
            autoComplete="off"
          />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-muted">Address</span>
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            value={bill.buyer}
            onChange={(event) => patchBill({ buyer: event.target.value })}
            placeholder="Street, area, city"
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-1">
            <span className="mb-1 block text-sm font-medium text-muted">Phone</span>
            <input
              className={inputClass}
              inputMode="tel"
              value={bill.phone}
              onChange={(event) => patchBill({ phone: event.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">State</span>
            <input
              className={inputClass}
              value={bill.state}
              onChange={(event) => patchBill({ state: event.target.value })}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Code</span>
            <input
              className={inputClass}
              value={bill.code}
              onChange={(event) => patchBill({ code: event.target.value })}
              autoComplete="off"
            />
          </label>
        </div>
        <div className="mt-3">
          <button type="button" className={`${btnGhost} disabled:opacity-50`} onClick={onUsePrevious} disabled={earlier.length === 0}>
            <Copy className="size-4" aria-hidden="true" />
            New from their last bill
          </button>
          {earlier.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No earlier bill for this customer yet. The name is kept for the next one.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {earlier.slice(0, 6).map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface"
                    onClick={() => onSelect(doc.id)}
                  >
                    <span className="min-w-0 truncate text-sm">
                      {docTitle(doc.kind)} No. {doc.number} · {formatDocDate(doc.date)}
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">{formatInr(billTotal(doc))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg">
          <span className="mr-2 font-sans text-sm font-semibold text-brass">03</span>
          Goods
        </h2>
        <ul className="space-y-3">
          {bill.lines.map((line, index) => (
            <li key={line.id} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-start gap-2">
                <span className="mt-2 w-6 shrink-0 text-sm font-semibold tabular-nums text-muted">{index + 1}</span>
                <textarea
                  className={`${inputClass} min-h-11 py-2`}
                  value={line.description}
                  onChange={(event) => patchLine(line.id, { description: event.target.value })}
                  placeholder="Description of goods"
                  aria-label={`Description ${index + 1}`}
                  rows={2}
                />
                <button
                  type="button"
                  className="grid size-11 shrink-0 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
                  aria-label={`Remove line ${index + 1}`}
                  onClick={() => removeLine(line.id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
              {line.sizes.length === 0 ? (
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">Qty</span>
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={line.quantity}
                      onChange={(event) => patchLine(line.id, { quantity: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">Rate</span>
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={line.rate}
                      onChange={(event) => patchLine(line.id, { rate: event.target.value })}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">Sq.ft</span>
                    <input
                      className={inputClass}
                      inputMode="decimal"
                      value={line.sqft}
                      onChange={(event) => patchLine(line.id, { sqft: event.target.value })}
                    />
                  </label>
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  <span className="block text-xs font-medium text-muted">
                    {bill.kind === "quotation" ? "Sizes on this item" : "Sizes"}
                  </span>
                  {line.sizes.map((part, sizeIndex) => {
                    const area = partSqft(part);
                    return (
                      <div key={part.id} className="grid grid-cols-1 items-end gap-2 min-[380px]:grid-cols-[minmax(0,1fr)_4.75rem_2.75rem]">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-muted">Size (ft)</span>
                          <input
                            className={inputClass}
                            value={part.size}
                            placeholder="10 x 8"
                            aria-label={`Size ${index + 1}.${sizeIndex + 1}`}
                            onChange={(event) => {
                              const sizes = line.sizes.map((item) =>
                                item.id === part.id ? { ...item, size: event.target.value } : item,
                              );
                              const measures = measuresFromSizes(sizes);
                              patchLine(line.id, measures ? { sizes, ...measures } : { sizes });
                            }}
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-muted">Qty</span>
                          <input
                            className={inputClass}
                            inputMode="decimal"
                            value={part.quantity}
                            aria-label={`Size quantity ${index + 1}.${sizeIndex + 1}`}
                            onChange={(event) => {
                              const sizes = line.sizes.map((item) =>
                                item.id === part.id ? { ...item, quantity: event.target.value } : item,
                              );
                              const measures = measuresFromSizes(sizes);
                              patchLine(line.id, measures ? { sizes, ...measures } : { sizes });
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className="grid size-11 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
                          aria-label={`Remove size ${index + 1}.${sizeIndex + 1}`}
                          onClick={() => {
                            const sizes = line.sizes.filter((item) => item.id !== part.id);
                            const measures = measuresFromSizes(sizes);
                            patchLine(line.id, measures ? { sizes, ...measures } : { sizes });
                          }}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </button>
                        {area != null ? (
                          <span className="col-span-3 text-xs text-muted">{area} sq.ft, rounded</span>
                        ) : null}
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    className={btnGhost}
                    onClick={() => patchLine(line.id, { sizes: [...line.sizes, blankSize(line.quantity || "1")] })}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Add size
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">Rate</span>
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={line.rate}
                        onChange={(event) => patchLine(line.id, { rate: event.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">Sq.ft</span>
                      <input
                        className={inputClass}
                        inputMode="decimal"
                        value={line.sqft}
                        onChange={(event) => patchLine(line.id, { sqft: event.target.value })}
                      />
                    </label>
                  </div>
                </div>
              )}
              {line.sizes.length === 0 ? (
                <button
                  type="button"
                  className={`${btnGhost} mt-2`}
                  onClick={() => patchLine(line.id, { sizes: [blankSize(line.quantity || "1")] })}
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Add size
                </button>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-sm text-muted">{lineFormula(line)}</span>
                <div className="flex items-center gap-1">
                  {line.manual ? (
                    <input
                      className={`${inputClass} w-28 text-right tabular-nums`}
                      inputMode="decimal"
                      value={line.manualAmount}
                      aria-label={`Amount ${index + 1}`}
                      onChange={(event) => patchLine(line.id, { manualAmount: event.target.value })}
                    />
                  ) : (
                    <span className="px-2 text-sm font-semibold tabular-nums">{formatInr(lineAmount(line))}</span>
                  )}
                  <button
                    type="button"
                    className="grid size-11 place-items-center rounded-lg text-muted hover:bg-canvas hover:text-ink"
                    aria-label={line.manual ? "Use calculated amount" : "Type amount yourself"}
                    onClick={() =>
                      patchLine(line.id, {
                        manual: !line.manual,
                        manualAmount: line.manual ? line.manualAmount : formatInr(lineAmount(line)),
                      })
                    }
                  >
                    {line.manual ? (
                      <Lock className="size-4" aria-hidden="true" />
                    ) : (
                      <LockOpen className="size-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <button type="button" className={`${btnGhost} mt-3`} onClick={addLine}>
          <Plus className="size-4" aria-hidden="true" />
          Add line
        </button>
        <p className="mt-2 text-sm text-muted">
          {bill.kind === "quotation"
            ? "A quotation lists every size under the item, each rounded, then added into Sq.ft. The rate is per sq.ft."
            : "An invoice can take several sizes on one line. They are rounded, added, and printed as one size list. Leave sizes empty and Sq.ft as “-” to charge the rate only."}
        </p>
        <div className="mt-3 rounded-xl bg-olive-deep px-4 py-3 text-cream">
          <div className="flex items-end justify-between gap-3">
            <span className="text-sm">Grand total</span>
            <span className="text-2xl font-semibold tabular-nums">{formatInr(total)}</span>
          </div>
          <p className="mt-1 text-sm text-cream/80">{billWords(bill)}</p>
          {advance !== 0 ? (
            <div className="mt-2 flex items-end justify-between gap-3 border-t border-cream/20 pt-2">
              <span className="text-sm">{balanceLabel(bill.kind)}</span>
              <span className="text-lg font-semibold tabular-nums">{formatInr(balance)}</span>
            </div>
          ) : null}
        </div>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium text-muted">{advanceLabel(bill.kind)}</span>
          <input
            className={inputClass}
            inputMode="decimal"
            value={bill.advance}
            placeholder="0"
            aria-label={advanceLabel(bill.kind)}
            onChange={(event) => patchBill({ advance: event.target.value })}
          />
          <span className="mt-1 block text-sm text-muted">
            {balanceLabel(bill.kind)} {formatInr(balance)}.{" "}
            {bill.kind === "invoice"
              ? "Leave blank if nothing was paid yet. Prints only when an advance is entered."
              : "Optional booking amount. Prints only when it is entered."}
          </span>
        </label>
      </section>

      <details className="group rounded-xl border border-line bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 font-semibold">
          Letterhead, bank & signature
          <span className="text-sm font-medium text-muted group-open:hidden">Edit</span>
        </summary>
        <div className="space-y-3 border-t border-line px-4 py-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Company name</span>
            <input
              className={inputClass}
              value={profile.name}
              onChange={(event) => setProfile({ name: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Address</span>
            <textarea
              className={`${inputClass} min-h-20 py-2`}
              value={profile.address}
              onChange={(event) => setProfile({ address: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">GSTIN</span>
            <input
              className={inputClass}
              value={profile.gstin}
              spellCheck={false}
              onChange={(event) => setProfile({ gstin: event.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Mobile</span>
              <input
                className={inputClass}
                inputMode="tel"
                value={profile.mobile}
                onChange={(event) => setProfile({ mobile: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Email</span>
              <input
                className={inputClass}
                type="email"
                value={profile.email}
                onChange={(event) => setProfile({ email: event.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Account name</span>
            <input
              className={inputClass}
              value={profile.accountName}
              onChange={(event) => setProfile({ accountName: event.target.value })}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Account number</span>
              <input
                className={inputClass}
                value={profile.accountNo}
                spellCheck={false}
                onChange={(event) => setProfile({ accountNo: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">IFSC</span>
              <input
                className={inputClass}
                value={profile.ifsc}
                spellCheck={false}
                onChange={(event) => setProfile({ ifsc: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Branch</span>
              <input
                className={inputClass}
                value={profile.branch}
                onChange={(event) => setProfile({ branch: event.target.value })}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted">Bank</span>
              <input
                className={inputClass}
                value={profile.bank}
                onChange={(event) => setProfile({ bank: event.target.value })}
              />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Invoice declaration</span>
            <textarea
              className={`${inputClass} min-h-20 py-2`}
              value={profile.declarationInvoice}
              onChange={(event) => setProfile({ declarationInvoice: event.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-muted">Quotation declaration</span>
            <textarea
              className={`${inputClass} min-h-20 py-2`}
              value={profile.declarationQuote}
              onChange={(event) => setProfile({ declarationQuote: event.target.value })}
            />
          </label>
          <div>
            <span className="mb-1 block text-sm font-medium text-muted">Authorised signature</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                void readSignature(file)
                  .then((signature) => {
                    setSigError("");
                    setProfile({ signature });
                  })
                  .catch(() => setSigError("Could not read that image. Try a PNG or JPG."));
              }}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={btnGhost} onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden="true" />
                Upload signature
              </button>
              {profile.signature ? (
                <button type="button" className={btnQuiet} onClick={() => setProfile({ signature: "" })}>
                  Remove
                </button>
              ) : null}
            </div>
            {profile.signature ? (
              <img
                src={profile.signature}
                alt="Signature preview"
                className="mt-2 h-14 w-full object-contain object-left"
              />
            ) : (
              <p className="mt-2 text-sm text-muted">The signature from your original bill is used until you upload another.</p>
            )}
            {sigError ? <p className="mt-2 text-sm text-ink">{sigError}</p> : null}
          </div>
          <button type="button" className={btnQuiet} onClick={restoreLetterhead}>
            Restore original letterhead
          </button>
        </div>
      </details>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={btnGhost} onClick={onDuplicate}>
          <Copy className="size-4" aria-hidden="true" />
          Duplicate
        </button>
        <button type="button" className={btnQuiet} onClick={onLoadSample}>
          Load sample
        </button>
        {confirmDelete ? (
          <>
            <button type="button" className={btnPrimary} onClick={onDelete}>
              Delete this bill
            </button>
            <button type="button" className={btnGhost} onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" className={btnQuiet} onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </button>
        )}
      </div>
      <p className="text-sm text-muted">Bills stay on this phone until you back them up.</p>
    </div>
  );
}

function ScaledBill({ children }: { children: ReactNode }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const slot = slotRef.current;
    const sheet = sheetRef.current;
    if (!slot || !sheet) return;
    const measure = () => {
      const naturalW = sheet.offsetWidth || 1;
      const naturalH = sheet.offsetHeight || 1;
      const next = Math.min(1, slot.clientWidth / naturalW);
      setScale((prev) => (Math.abs(prev - next) < 0.001 ? prev : next));
      const nextH = Math.ceil(naturalH * next);
      setHeight((prev) => (prev === nextH ? prev : nextH));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(slot);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={slotRef} className="preview-slot">
      <div className="fit-sizer" style={{ height }}>
        <div className="fit-scale" style={{ transform: `scale(${scale})` }}>
          <div ref={sheetRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}

function HouseMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
      <path d="M5 14.5 16 5l11 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M8 13.5V27h16V13.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M14 27v-6h4v6" fill="none" stroke="var(--color-brass)" strokeWidth="1.8" />
    </svg>
  );
}
