import { promises as fs } from "node:fs";

const FILE = "/tmp/finetune-empire-save.json";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  await fs.rm(FILE, { force: true });
  return res.status(200).json({ ok: true });
}
