import { promises as fs } from "node:fs";

const FILE = "/tmp/finetune-empire-save.json";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const raw = await fs.readFile(FILE, "utf8").catch(() => null);
    if (!raw) return res.status(200).json({ ok: true, state: null });
    return res.status(200).json({ ok: true, state: JSON.parse(raw) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
