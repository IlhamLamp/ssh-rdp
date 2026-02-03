import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { ShortcutProfile } from "@/lib/shortcuts";
import { defaultProfiles } from "@/lib/shortcuts";

const DATA_DIR =
  process.env.DATA_DIR && process.env.DATA_DIR.trim().length > 0
    ? process.env.DATA_DIR
    : path.join(process.cwd(), "data");

const DATA_PATH = path.join(DATA_DIR, "server.json");

async function ensureDataFile() {
  try {
    await fs.access(DATA_PATH);
  } catch {
    const initial = defaultProfiles();
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

export async function GET() {
  try {
    await ensureDataFile();
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const parsed = JSON.parse(raw) as ShortcutProfile[];
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("GET /api/servers error", err);
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = (await req.json()) as unknown;
    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be an array" }, { status: 400 });
    }

    // Merge dan cegah duplikat berdasarkan jenis+host (case-insensitive).
    const byKey = new Map<string, ShortcutProfile>();
    for (const item of body as ShortcutProfile[]) {
      if (!item || typeof item !== "object") continue;
      const kind = item.kind;
      const host = item.host?.trim().toLowerCase();
      if (!kind || !host) continue;
      const key = `${kind}:${host}`;
      byKey.set(key, item);
    }

    const merged = Array.from(byKey.values());

    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    await fs.writeFile(DATA_PATH, JSON.stringify(merged, null, 2), "utf8");
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/servers error", err);
    return NextResponse.json({ error: "Failed to write data" }, { status: 500 });
  }
}



