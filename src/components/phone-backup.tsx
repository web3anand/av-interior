import { useEffect, useState } from "react";
import {
  backupToDrive,
  downloadBackup,
  driveAutoOn,
  getGoogleClientId,
  lastDriveBackup,
  restoreBackupFile,
  restoreFromDrive,
  setDriveAuto,
  setGoogleClientId,
} from "@/lib/drive-backup";
import { useBills } from "@/lib/store";

function when(iso: string): string {
  if (!iso) return "Not backed up to Google yet";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Not backed up to Google yet";
  return `Last Google backup ${date.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" })}`;
}

export function PhoneBackup() {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState("");
  const [auto, setAuto] = useState(false);
  const [last, setLast] = useState("");

  useEffect(() => {
    setClientId(getGoogleClientId());
    setAuto(driveAutoOn());
    setLast(lastDriveBackup());
  }, []);

  useEffect(() => {
    if (!auto || !getGoogleClientId()) return;
    let timer = 0;
    const unsub = useBills.subscribe(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void backupToDrive(true)
          .then(() => {
            const stamp = lastDriveBackup();
            setLast(stamp);
            setNote("");
          })
          .catch(() => {
            /* Stay quiet. The phone copy is already saved. */
          });
      }, 4000);
    });
    return () => {
      unsub();
      window.clearTimeout(timer);
    };
  }, [auto, clientId]);

  async function run(action: () => Promise<void> | void) {
    setBusy(true);
    setNote("");
    try {
      await action();
      setLast(lastDriveBackup());
    } catch (error) {
      setNote(error instanceof Error ? error.message : "That did not work. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-3">
      <h2 className="font-display text-lg">On this phone</h2>
      <p className="mt-1 text-sm text-muted">
        Bills are saved on this phone as you type. Back them up to your Google Drive so a new phone can restore them,
        the same way WhatsApp does.
      </p>
      <p className="mt-2 text-sm font-medium">{when(last)}</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-olive px-3 text-sm font-semibold text-cream disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await backupToDrive(false);
              setNote("Backed up to Google Drive.");
            })
          }
        >
          Back up
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-canvas px-3 text-sm font-semibold disabled:opacity-50"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const ok = window.confirm("Replace the bills on this phone with the Google Drive backup?");
              if (!ok) return;
              await restoreFromDrive();
              setNote("Restored from Google Drive.");
            })
          }
        >
          Restore
        </button>
        <button
          type="button"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-canvas px-3 text-sm font-semibold"
          onClick={() => downloadBackup()}
        >
          Save file
        </button>
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-line bg-canvas px-3 text-sm font-semibold">
          Open file
          <input
            type="file"
            accept="application/json"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              void run(async () => {
                const ok = window.confirm("Replace the bills on this phone with this backup file?");
                if (!ok) return;
                await restoreBackupFile(file);
                setNote("Restored from the backup file.");
              });
            }}
          />
        </label>
      </div>
      {note ? <p className="mt-2 text-sm">{note}</p> : null}
      <details className="mt-3">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">Google Drive setup</summary>
        <p className="mt-1 text-sm text-muted">
          In Google Cloud, create a Web client ID and allow this site. Paste it here once. After that, turn on
          automatic backup and it keeps a copy in your Drive.
        </p>
        <label className="mt-2 block">
          <span className="mb-1 block text-xs font-medium text-muted">Google client ID</span>
          <input
            className="min-h-11 w-full rounded-lg border border-line bg-canvas px-3 text-base outline-none focus-visible:border-olive"
            value={clientId}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => setClientId(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="mt-2 inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-canvas px-3 text-sm font-semibold"
          onClick={() => {
            setGoogleClientId(clientId);
            setNote("Google client ID saved on this phone.");
          }}
        >
          Save client ID
        </button>
        <label className="mt-3 flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="size-5"
            checked={auto}
            onChange={(event) => {
              setDriveAuto(event.target.checked);
              setAuto(event.target.checked);
            }}
          />
          Back up automatically after each change
        </label>
      </details>
    </section>
  );
}
