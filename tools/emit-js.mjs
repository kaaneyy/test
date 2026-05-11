import { promises as fs } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(path.join(dist, 'src'), { recursive: true });

const files = await walk(path.join(root, 'src'));
for (const file of files) {
  const rel = path.relative(path.join(root, 'src'), file);
  const outFile = path.join(dist, 'src', rel.replace(/\.ts$/, '.js'));
  await fs.mkdir(path.dirname(outFile), { recursive: true });
  const raw = await fs.readFile(file, 'utf8');
  const js = raw.replace(/from\s+(["'][^"']+)\.ts(["'])/g, 'from $1.js$2');
  await fs.writeFile(outFile, js, 'utf8');
}

const indexRaw = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const indexOut = indexRaw.replace('./src/main.ts', './src/main.js');
await fs.writeFile(path.join(dist, 'index.html'), indexOut, 'utf8');
await fs.copyFile(path.join(root, 'styles.css'), path.join(dist, 'styles.css'));
