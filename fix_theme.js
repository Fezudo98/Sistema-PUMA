const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

// Function to walk through the directory recursively
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

const colorReplacements = {
  // Backgrounds
  'bg-slate-950': 'bg-background',
  'bg-slate-900': 'bg-card',
  'bg-slate-800': 'bg-muted',
  'bg-slate-100': 'bg-muted',
  
  // Text colors
  'text-slate-50': 'text-foreground',
  'text-slate-100': 'text-foreground',
  'text-slate-200': 'text-foreground',
  'text-slate-300': 'text-muted-foreground',
  'text-slate-400': 'text-muted-foreground',
  'text-slate-500': 'text-muted-foreground',
  'text-slate-600': 'text-muted-foreground',
  
  // Border colors
  'border-slate-800': 'border-border',
  'border-slate-700': 'border-border',
  'border-slate-600': 'border-border',
  
  // Specific hardcoded gradients that assume dark mode
  'from-slate-900': 'from-background',
  'to-slate-950': 'to-background',
  'via-slate-900': 'via-background',
};

let totalReplaced = 0;

walkSync(srcDir, (filepath) => {
  let content = fs.readFileSync(filepath, 'utf8');
  let originalContent = content;

  // We only want to replace whole words (CSS classes)
  for (const [oldClass, newClass] of Object.entries(colorReplacements)) {
    // Regex matches the class name bounded by word boundaries or quotes/spaces
    const regex = new RegExp(`(?<=[\\s"'\\\`])(${oldClass})(?=[\\s"'\\\`/])`, 'g');
    content = content.replace(regex, newClass);
  }

  // Also handle cases with opacity, e.g. bg-slate-900/50 -> bg-card/50
  for (const [oldClass, newClass] of Object.entries(colorReplacements)) {
    // Regex for class with opacity modifier: oldClass/XX
    const regexOpacity = new RegExp(`(?<=[\\s"'\\\`])(${oldClass})/(\\d+)(?=[\\s"'\\\`])`, 'g');
    content = content.replace(regexOpacity, `${newClass}/$2`);
  }

  if (content !== originalContent) {
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Updated ${filepath}`);
    totalReplaced++;
  }
});

console.log(`\nFinished! Modified ${totalReplaced} files.`);
