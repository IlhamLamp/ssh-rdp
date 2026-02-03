"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ShortcutProfile,
  buildBatFilename,
  buildBatScript,
  defaultProfiles,
  isValidProfile,
} from "@/lib/shortcuts";
import { downloadTextFile, loadJson, saveJson } from "@/lib/web";

const STORAGE_KEY = "pam-shortcut.profiles.v1";

type Draft = Omit<ShortcutProfile, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
  password?: string;
};

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

export default function Home() {
  const [profiles, setProfiles] = useState<ShortcutProfile[]>([]);
  const [search, setSearch] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    name: "",
    kind: "rdp",
    host: "",
    port: 22,
    username: "",
    rdpUsername: "",
    password: "",
    rdpFullscreen: true,
    rdpAdmin: false,
    note: "",
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/servers", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as ShortcutProfile[];
        if (!cancelled && Array.isArray(data)) {
          setProfiles(data);
          saveJson(STORAGE_KEY, data);
          return;
        }
      } catch {
        const fromStorage = loadJson<ShortcutProfile[]>(STORAGE_KEY);
        if (!cancelled && fromStorage && Array.isArray(fromStorage)) {
          setProfiles(fromStorage);
          return;
        }
        if (!cancelled) {
          const fallback = defaultProfiles();
          setProfiles(fallback);
          saveJson(STORAGE_KEY, fallback);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (profiles.length === 0) return;
    saveJson(STORAGE_KEY, profiles);
    // fire-and-forget sync to JSON file on server
    fetch("/api/servers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profiles),
    }).catch(() => {});
  }, [profiles]);

  const editing = useMemo(() => Boolean(draft.id), [draft.id]);

  const filteredProfiles = useMemo(() => {
    let list = profiles;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = p.name.toLowerCase();
        const host = p.host.toLowerCase();
        return name.includes(q) || host.includes(q);
      });
    }
    if (activeLetter) {
      const l = activeLetter.toLowerCase();
      list = list.filter((p) => p.name.trim().toLowerCase().startsWith(l));
    }
    return list;
  }, [profiles, search, activeLetter]);

  function resetDraft() {
    setDraft({
      name: "",
      kind: "rdp",
      host: "",
      port: 22,
      username: "",
      rdpUsername: "",
      password: "",
      rdpFullscreen: true,
      rdpAdmin: false,
      note: "",
    });
  }

  function startEdit(p: ShortcutProfile) {
    setDraft({
      id: p.id,
      name: p.name,
      kind: p.kind,
      host: p.host,
      port: p.port ?? 22,
      username: p.username ?? "",
      rdpUsername: p.rdpUsername ?? "",
      password: p.password ?? "",
      rdpFullscreen: p.rdpFullscreen ?? true,
      rdpAdmin: p.rdpAdmin ?? false,
      note: p.note ?? "",
    });
  }

  function upsert() {
    const base: ShortcutProfile = {
      id: draft.id ?? uid(),
      name: draft.name.trim(),
      kind: draft.kind,
      host: draft.host.trim(),
      port: draft.kind === "ssh" ? Number(draft.port ?? 22) : undefined,
      username: draft.kind === "ssh" ? (draft.username?.trim() ?? "") : undefined,
      rdpUsername:
        draft.kind === "rdp" ? (draft.rdpUsername?.trim() ?? "") : undefined,
      rdpFullscreen: draft.kind === "rdp" ? Boolean(draft.rdpFullscreen) : undefined,
      rdpAdmin: draft.kind === "rdp" ? Boolean(draft.rdpAdmin) : undefined,
      password: draft.password?.trim() || undefined,
      note: draft.note?.trim() ?? "",
      createdAt: draft.id ? "" : nowIso(),
      updatedAt: nowIso(),
    };

    if (!isValidProfile(base)) return;

    setProfiles((prev) => {
      const key = `${base.kind}:${base.host.toLowerCase()}`;
      const existingIdx = prev.findIndex(
        (x) => `${x.kind}:${x.host.toLowerCase()}` === key,
      );

      // Jika ada profile dengan jenis+host sama dan ini create baru, treat sebagai update.
      if (!base.id && existingIdx !== -1) {
        base.id = prev[existingIdx].id;
      }

      const idx = prev.findIndex((x) => x.id === base.id);
      if (idx === -1) {
        return [{ ...base, createdAt: base.createdAt || nowIso() }, ...prev];
      }
      const existing = prev[idx];
      const next = [...prev];
      next[idx] = { ...existing, ...base, createdAt: existing.createdAt };
      return next;
    });
    resetDraft();
  }

  function remove(id: string) {
    setProfiles((prev) => prev.filter((p) => p.id !== id));
    if (draft.id === id) resetDraft();
  }

  function downloadBat(p: ShortcutProfile) {
    const script = buildBatScript(p);
    downloadTextFile(buildBatFilename(p), script);
  }

  function downloadAllBat() {
    const combined = profiles
      .map((p) => `:: ===== ${p.name} (${p.kind.toUpperCase()}) =====\r\n${buildBatScript(p)}\r\n`)
      .join("\r\n");
    downloadTextFile("pam-shortcuts_all.bat", combined);
  }

  const canSave = draft.name.trim() && draft.host.trim();
  const kind = draft.kind;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Shortcut Launcher
          </h1>
            <p className="mt-1 max-w-2xl text-sm text-zinc-600">
              Simpan daftar host (RDP/SSH) lalu download shortcut{" "}
              <span className="font-mono">.bat</span> untuk login cepat.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
              onClick={() => setProfiles(defaultProfiles())}
              type="button"
            >
              Reset contoh
            </button>
            <button
              className="rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-800"
              onClick={downloadAllBat}
              type="button"
              disabled={profiles.length === 0}
            >
              Download semua (.bat)
            </button>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-5">
          <section className="lg:col-span-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-900">
                  {editing ? "Edit shortcut" : "Tambah shortcut"}
                </h2>
                {editing ? (
                  <button
                    className="text-xs text-zinc-600 hover:text-zinc-900"
                    onClick={resetDraft}
                    type="button"
                  >
                    Batal
                  </button>
                ) : null}
              </div>

              <div className="mt-4 grid gap-3">
                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-700">Nama</span>
                  <input
                    className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                    placeholder="Prod Jumpbox"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-zinc-700">Jenis</span>
                    <select
                      className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-zinc-400"
                      value={draft.kind}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          kind: e.target.value as ShortcutProfile["kind"],
                        }))
                      }
                    >
                      <option value="rdp">RDP (mstsc)</option>
                      <option value="ssh">SSH (ssh.exe)</option>
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs font-medium text-zinc-700">
                      Host / IP
                    </span>
                    <input
                      className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                      placeholder="10.10.10.10"
                      value={draft.host}
                      onChange={(e) => setDraft((d) => ({ ...d, host: e.target.value }))}
                    />
                  </label>
                </div>

                {kind === "ssh" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-zinc-700">
                        Username (opsional)
                      </span>
                      <input
                        className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                        placeholder="ec2-user"
                        value={draft.username ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, username: e.target.value }))
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-zinc-700">
                        Port
                      </span>
                      <input
                        className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                        inputMode="numeric"
                        value={draft.port ?? 22}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, port: Number(e.target.value || 22) }))
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    <label className="grid gap-1">
                      <span className="text-xs font-medium text-zinc-700">
                        Username (opsional)
                      </span>
                      <input
                        className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                        placeholder="source-control"
                        value={draft.rdpUsername ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, rdpUsername: e.target.value }))
                        }
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.rdpFullscreen)}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, rdpFullscreen: e.target.checked }))
                        }
                      />
                      Fullscreen
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={Boolean(draft.rdpAdmin)}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, rdpAdmin: e.target.checked }))
                        }
                      />
                      Admin console (/admin)
                    </label>
                  </div>
                )}

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-700">
                    Password (boleh disimpan untuk latihan)
                  </span>
                  <input
                    className="h-10 rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-zinc-400"
                    type="password"
                    placeholder="••••••••"
                    value={draft.password ?? ""}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, password: e.target.value }))
                    }
                  />
                  <span className="text-[11px] text-zinc-500">
                    Jika diisi, password akan tersimpan di browser (localStorage) dan
                    ikut tertulis di file .bat RDP (auto login via cmdkey). Gunakan
                    hanya untuk environment latihan / non‑production.
                  </span>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs font-medium text-zinc-700">
                    Catatan (opsional)
                  </span>
                  <textarea
                    className="min-h-20 resize-y rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400"
                    placeholder="mis. butuh VPN..."
                    value={draft.note ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                  />
                </label>

                {!canSave ? (
                  <p className="text-xs text-zinc-500">
                    Isi minimal <b>Nama</b> dan <b>Host/IP</b>.
                  </p>
                ) : null}

                <button
                  className="mt-1 h-10 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                  type="button"
                  onClick={upsert}
                  disabled={!canSave}
                >
                  {editing ? "Simpan perubahan" : "Tambah shortcut"}
                </button>
              </div>
            </div>
          </section>

          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Shortcut tersimpan
                    </h2>
                    <span className="text-[11px] text-zinc-500">
                      {filteredProfiles.length} terlihat dari total {profiles.length} item
                    </span>
                  </div>
                  <div className="w-full sm:w-64">
                    <input
                      className="h-9 w-full rounded-full border border-zinc-200 px-3 text-xs outline-none focus:border-zinc-400"
                      placeholder="Cari nama atau host/IP..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="hidden flex-wrap gap-1 border-b border-zinc-100 pb-2 text-xs text-zinc-600 lg:flex">
                  <button
                    type="button"
                    className={`rounded-full px-2.5 py-1 ${
                      !activeLetter
                        ? "bg-zinc-900 text-white"
                        : "hover:bg-zinc-100"
                    }`}
                    onClick={() => setActiveLetter(null)}
                  >
                    All
                  </button>
                  {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((ch) => {
                    const isActive = activeLetter === ch;
                    return (
                      <button
                        key={ch}
                        type="button"
                        className={`rounded-full px-2.5 py-1 ${
                          isActive
                            ? "bg-zinc-900 text-white"
                            : "hover:bg-zinc-100"
                        }`}
                        onClick={() => setActiveLetter(isActive ? null : ch)}
                      >
                        {ch}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {filteredProfiles.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-600">
                    Tidak ada shortcut yang cocok. Coba hapus filter atau tambah data di
                    panel kiri.
                  </div>
                ) : (
                  filteredProfiles.map((p) => (
                    <div
                      key={p.id}
                      className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {p.name}
                          </span>
                          <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
                            {p.kind.toUpperCase()}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-zinc-600">
                          <span className="font-mono">{p.host}</span>
                          {p.kind === "ssh" ? (
                            <>
                              {p.username ? (
                                <span className="ml-2 text-zinc-500">
                                  user: <span className="font-mono">{p.username}</span>
                                </span>
                              ) : null}
                              <span className="ml-2 text-zinc-500">
                                port: <span className="font-mono">{p.port ?? 22}</span>
                              </span>
                            </>
                          ) : p.rdpUsername ? (
                            <span className="ml-2 text-zinc-500">
                              user: <span className="font-mono">{p.rdpUsername}</span>
                            </span>
                          ) : null}
                        </div>
                        {p.note ? (
                          <div className="mt-1 line-clamp-2 text-xs text-zinc-500">
                            {p.note}
                          </div>
                        ) : null}
        </div>

                      <div className="flex flex-wrap gap-2 sm:justify-end">
                        <button
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                          type="button"
                          onClick={() => downloadBat(p)}
                        >
                          Download .bat
                        </button>
                        <button
                          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50"
                          type="button"
                          onClick={() => startEdit(p)}
                        >
                          Edit
                        </button>
                        <button
                          className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                          type="button"
                          onClick={() => remove(p.id)}
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-8 text-xs text-zinc-500">
          Tips: Untuk RDP menggunakan <span className="font-mono">mstsc.exe</span>{" "}
          dan untuk SSH menggunakan <span className="font-mono">ssh.exe</span>{" "}
          (Windows OpenSSH). Jalankan file <span className="font-mono">.bat</span>{" "}
          yang kamu download.
        </footer>
      </div>
    </div>
  );
}
