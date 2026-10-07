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
import {
  type Bill,
  type DocKind,
  type Line,
  type Profile,
  billTotal,
  billWords,
  lineAmount,
  lineFormula,
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
  const line = bill.buyer.split("\n").map((part) => part.trim()).find(Boolean);
  return line || "No buyer yet";
}

export function Desk() {
  const profile = useBills((s) => s.profile);
  const docs = useBills((s) => s.docs);
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
  const selectBill = useBills((s) => s.selectBill);
  const loadSample = useBills((s) => s.loadSample);

  const [pane, setPane] = useState<Pane>("preview");
  const [query, setQuery] = useState("");
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

  const q = query.trim().toLowerCase();
  const visible = [...docs]
    .filter((doc) => {
      if (!q) return true;
      return (
        doc.buyer.toLowerCase().includes(q) ||
        doc.number.toLowerCase().includes(q) ||
        doc.lines.some((line) => line.description.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  function start(kind: DocKind) {
    newBill(kind);
    setPane("edit");
  }

  return (
    <div className="desk flex min-h-dvh flex-col bg-canvas text-ink lg:h-dvh lg:overflow-hidden">
      <div className="no-print sticky top-0 z-20 border-b border-brass bg-olive-deep text-cream">
        <header className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-cream/20">
              <HouseMark />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-xl leading-none text-cream">
                {profile.name || "AV Interior"}
              </p>
              <p className="mt-1 text-sm text-cream/75">Invoice & quotation desk</p>
            </div>
          </div>
          <button type="button" className={btnPrimary} onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" />
            Print
          </button>
        </header>
        <div className="grid grid-cols-2 border-t border-cream/15 lg:hidden">
          <button
            type="button"
            className={`min-h-11 text-sm font-semibold ${pane === "edit" ? "bg-cream text-olive-deep" : "text-cream"}`}
            onClick={() => setPane("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            className={`min-h-11 text-sm font-semibold ${pane === "preview" ? "bg-cream text-olive-deep" : "text-cream"}`}
            onClick={() => setPane("preview")}
          >
            Preview
          </button>
        </div>
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
            A4 preview. In the print dialog, turn on <span className="font-semibold text-ink">Background graphics</span> so the green header prints.
          </p>
          <div className="px-3 py-4 sm:px-5">
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
  activeId,
  onSelect,
  onStart,
  onDuplicate,
  onLoadSample,
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
  activeId: string;
  onSelect: (id: string) => void;
  onStart: (kind: DocKind) => void;
  onDuplicate: () => void;
  onLoadSample: () => void;
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

  return (
    <div className="flex flex-col gap-6 p-4 pb-24">
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg">Saved bills</h2>
          <span className="text-sm text-muted">{visible.length}</span>
        </div>
        <input
          className={inputClass}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search buyer or item"
          aria-label="Search bills"
        />
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
                    className={`flex w-full items-center justify-between gap-3 rounded-lg border-l-4 px-3 py-2 text-left ${
                      active ? "border-olive bg-surface" : "border-transparent hover:bg-surface"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold tracking-wide text-brass">
                        {doc.kind === "invoice" ? "INVOICE" : "QUOTATION"} No. {doc.number} · {formatDocDate(doc.date)}
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
          <span className="mb-1 block text-sm font-medium text-muted">Name and address</span>
          <textarea
            className={`${inputClass} min-h-24 py-2`}
            value={bill.buyer}
            onChange={(event) => patchBill({ buyer: event.target.value })}
            placeholder="Buyer name and address"
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
          Amount is Qty × Rate. If Sq.ft is a number, it multiplies too. Use “-” when size does not apply. Tax or transport can be its own line.
        </p>
        <div className="mt-3 rounded-xl bg-olive-deep px-4 py-3 text-cream">
          <div className="flex items-end justify-between gap-3">
            <span className="text-sm">Grand total</span>
            <span className="text-2xl font-semibold tabular-nums">{formatInr(total)}</span>
          </div>
          <p className="mt-1 text-sm text-cream/80">{billWords(bill)}</p>
        </div>
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
      <p className="text-sm text-muted">Bills stay in this browser on this device.</p>
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
