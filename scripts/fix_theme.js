const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

function walkSync(dir, callback) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    var filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walkSync(filepath, callback);
    } else if (stats.isFile() && (filepath.endsWith('.tsx') || filepath.endsWith('.ts'))) {
      callback(filepath);
    }
  });
}

const replacements = [
  // divide-y dividers
  ['divide-slate-800/60', 'divide-border'],
  ['divide-slate-800/50', 'divide-border'],
  ['divide-slate-800/40', 'divide-border'],
  ['divide-slate-100', 'divide-border'],
  ['divide-slate-300', 'divide-border'],
  
  // ring-offset backgrounds (avatar rings)
  ['ring-offset-slate-950', 'ring-offset-background'],
  
  // placeholders
  ['placeholder-slate-500', 'placeholder-muted-foreground'],
  
  // border for tooltip arrow  
  ['border-t-slate-900', 'border-t-card'],
  
  // from-slate-700 in quem-somos gradient
  ['from-slate-700', 'from-muted'],
];

let totalReplaced = 0;

walkSync(srcDir, (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  let originalContent = content;
  
  for (const [oldClass, newClass] of replacements) {
    const escapedOld = oldClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedOld, 'g');
    content = content.replace(regex, newClass);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Updated: ${path.relative(__dirname, filepath)}`);
    totalReplaced++;
  }
});

console.log(`\nDone! Modified ${totalReplaced} files.`);
