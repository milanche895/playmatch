const fs = require('fs');
const path = require('path');

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name.endsWith('.tsx')) acc.push(full);
  }
  return acc;
}

let count = 0;
for (const file of walk('src')) {
  const src = fs.readFileSync(file, 'utf8');
  const next = src.replace(/<Alert\b[\s\S]*?>/g, (tag) =>
    tag
      .replace(/borderRadius:\s*2\b/g, "borderRadius: '16px'")
      .replace(/borderRadius:\s*'12px'/g, "borderRadius: '16px'")
      .replace(/borderRadius:\s*"12px"/g, "borderRadius: '16px'")
  );
  if (next !== src) {
    fs.writeFileSync(file, next);
    count += 1;
    console.log(file);
  }
}
console.log('files', count);
