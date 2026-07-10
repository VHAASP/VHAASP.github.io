const fs = require('fs');
const cp = require('child_process');

const filePath = 'stations/001-TestStation/TestStationOMJSON.json';

function slugifyKey(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'link';
}

function escapeMarkdownLabel(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function toLineText(row) {
  const text = (row && (row.Text || row.DisplayText || row.Item || '') ? String(row.Text || row.DisplayText || row.Item || '') : '').trim();
  if (!text) {
    return '';
  }

  const linkTarget = row && row.Item && String(row.Item).trim() ? String(row.Item).trim() : '';
  const isHeading = Boolean(row && (row.Header === 1 || row.Header === true || row.Bold === true));

  if (linkTarget) {
    const key = slugifyKey(linkTarget);
    const linkedText = `[${escapeMarkdownLabel(text)}](${key})`;
    return isHeading ? `# ${linkedText}` : linkedText;
  }

  if (row && row.Link && String(row.Link).trim()) {
    const key = slugifyKey(String(row.Link).trim());
    return `[${escapeMarkdownLabel(text)}](${key})`;
  }

  if (isHeading) {
    return `# ${text}`;
  }

  return text;
}

function normalizeLinkTargets(rows) {
  const seen = new Set();
  const out = [];

  for (const row of rows) {
    if (row && row.Item && String(row.Item).trim()) {
      const targetItem = String(row.Item).trim();
      const key = slugifyKey(targetItem);
      const dedupeKey = `${key}::${targetItem}`;
      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        out.push({
          Key: key,
          Text: (row.Text || row.DisplayText || '').toString().trim() || undefined,
          Item: targetItem,
        });
      }
    }

    if (!row || !row.Link || !String(row.Link).trim()) {
      continue;
    }
    const targetItem = String(row.Link).trim();
    const key = slugifyKey(targetItem);
    const dedupeKey = `${key}::${targetItem}`;
    if (seen.has(dedupeKey)) {
      continue;
    }
    seen.add(dedupeKey);
    out.push({
      Key: key,
      Text: (row.Text || row.DisplayText || '').toString().trim() || undefined,
      Item: targetItem,
    });
  }

  return out;
}

function convertMenu(menu) {
  const rows = Array.isArray(menu.Contents) ? menu.Contents : [];

  const lineTexts = rows
    .sort((a, b) => {
      const rowA = Number.isFinite(a?.Row) ? a.Row : 0;
      const rowB = Number.isFinite(b?.Row) ? b.Row : 0;
      if (rowA !== rowB) return rowA - rowB;
      const colA = Number.isFinite(a?.Column) ? a.Column : 0;
      const colB = Number.isFinite(b?.Column) ? b.Column : 0;
      return colA - colB;
    })
    .map(toLineText)
    .filter(Boolean);

  const converted = {
    Name: menu.Name,
    Term1: menu.Term1 || '',
    Term2: menu.Term2 || '',
    Text: lineTexts.join('\n\n'),
    LinkTargets: normalizeLinkTargets(rows),
  };

  return converted;
}

let raw = fs.readFileSync(filePath, 'utf8');
try {
  const gitRaw = cp.execSync(`git show HEAD:${filePath.replace(/\\/g, '/')}`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  const gitParsed = JSON.parse(gitRaw);
  if (Array.isArray(gitParsed.menus) && gitParsed.menus.some(menu => Array.isArray(menu.Contents))) {
    raw = gitRaw;
  }
} catch (error) {
  // Fall back to the current working tree file.
}

const beforeBytes = Buffer.byteLength(raw, 'utf8');
const parsed = JSON.parse(raw);
const menus = Array.isArray(parsed.menus) ? parsed.menus : [];

const convertedMenus = menus.map(convertMenu);
const result = { menus: convertedMenus };

const output = JSON.stringify(result, null, 2);
JSON.parse(output);
fs.writeFileSync(filePath, output + '\n', 'utf8');

const afterBytes = Buffer.byteLength(output + '\n', 'utf8');
console.log(`menus=${menus.length}`);
console.log(`before_bytes=${beforeBytes}`);
console.log(`after_bytes=${afterBytes}`);
console.log(`before_mb=${(beforeBytes / 1024 / 1024).toFixed(3)}`);
console.log(`after_mb=${(afterBytes / 1024 / 1024).toFixed(3)}`);
console.log(`reduction_percent=${(((beforeBytes - afterBytes) / beforeBytes) * 100).toFixed(2)}`);
