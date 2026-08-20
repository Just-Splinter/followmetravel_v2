import fs from 'fs';
import path from 'path';

const seen = new Set();
const exts = ['', '.js', '.jsx', '.json', '.css', '/index.js', '/index.jsx'];

function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.join(path.posix.dirname(from), spec);
  for (const e of exts) {
    const p = base + e;
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

function walk(file) {
  if (seen.has(file)) return;
  seen.add(file);
  if (!/\.(js|jsx)$/.test(file)) return;
  const src = fs.readFileSync(file, 'utf8');
  const re = /(?:import\s[^'"]*from\s*|import\s*|export\s[^'"]*from\s*|import\()\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const r = resolve(file, m[1]);
    if (r) walk(r);
  }
}

walk('src/main.jsx');

const all = fs.readFileSync('allfiles.txt', 'utf8').trim().split('\n').map(s => s.trim()).filter(Boolean);
const dead = all.filter(f => !seen.has(f));
console.log('REACHABLE: ' + seen.size + ' / ' + all.length);
console.log('\n--- UNREACHABLE ---');
let total = 0;
dead.forEach(f => {
  const n = fs.readFileSync(f, 'utf8').split('\n').length;
  total += n;
  console.log(String(n).padStart(6) + '  ' + f);
});
console.log('TOTAL DEAD LINES: ' + total);
