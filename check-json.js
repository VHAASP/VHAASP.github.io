const fs = require('fs');
const content = fs.readFileSync('stations/001-TestStation/TestStationOMJSON.json', 'utf8');
console.log('File size:', content.length, 'chars');

// Check for unescaped control chars inside strings
const matches = [];
let inString = false;
let escaped = false;
for (let i = 0; i < content.length; i++) {
  const c = content[i];
  if (escaped) { escaped = false; continue; }
  if (c === '\\' && inString) { escaped = true; continue; }
  if (c === '"') { inString = !inString; continue; }
  if (inString && (c === '\r' || c === '\n' || c.charCodeAt(0) < 0x20)) {
    const lineNum = content.substring(0, i).split('\n').length;
    matches.push({ pos: i, charCode: c.charCodeAt(0), line: lineNum });
    if (matches.length >= 5) break;
  }
}

if (matches.length) {
  console.log('Bad chars found:', JSON.stringify(matches));
} else {
  console.log('No unescaped control chars in strings found.');
}
