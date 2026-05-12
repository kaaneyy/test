import { promises as fs } from "node:fs";
import path from "node:path";

const FILE = "/tmp/finetune-empire-save.json";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    await fs.writeFile(FILE, JSON.stringify(body || {}), "utf8");
    return res.status(200).json({ ok: true, storage: "vercel-function" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
