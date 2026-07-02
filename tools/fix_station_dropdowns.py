from pathlib import Path
import re

PATTERN_1 = re.compile(r"  const urlParams = new URLSearchParams\\(window\\.location\\.search\\);\\s+const dropdown = document\\.getElementById\\('filterDropdown'\\);\\s+const dropdownValue = urlParams\\.get\\('dropdown'\\);\\s+if \\(dropdownValue\\) \\{\\s+dropdown\\.value = decodeURIComponent\\(dropdownValue\\);\\s+\\} else \\{\\s+// If no dropdown value is provided in the URL, set a default value\\s+dropdown\\.value = MainMenu;\\s+\\}\\s+pushHistory\\(dropdown\\.value\\);\\s+filterData\\(\\{ target: dropdown \\}\\);\\s+scrollToTop\\(\\)\\s*;\\s+adjustFontSize\\(\\);", re.MULTILINE)
PATTERN_2 = re.compile(r"  if \\(currentVersion === 'inpt'\\) \\{\\s+dropdown\\.value = MainMenu;\\s+\\} else if \\(currentVersion === 'outpt'\\) \\{\\s+dropdown\\.value = outptMenu;\\s+\\} else if \\(currentVersion === 'eruc'\\) \\{\\s+dropdown\\.value = erucMenu;\\s+\\};\\s+filterData\\(\\{ target: dropdown \\}\\);", re.MULTILINE)
PATTERN_3 = re.compile(r"  \\\.catch\\(error => \\{\\s+console\\.error\\('Error:', error\\);\\s+\\}\\);   ", re.MULTILINE)

REPLACEMENT_1 = """  const urlParams = new URLSearchParams(window.location.search);
  const dropdown = document.getElementById('filterDropdown');
  const dropdownValue = urlParams.get('dropdown');
  if (dropdownValue) {
    dropdown.value = decodeURIComponent(dropdownValue);
  } else {
    // If no dropdown value is provided in the URL, choose a valid default option
    const mainMenuOption = dropdown.querySelector(`option[value=\"${MainMenu}\"]`);
    const firstVisibleOption = Array.from(dropdown.options).find(opt => opt.style.display !== 'none' && !opt.disabled);
    const fallbackOption = mainMenuOption || firstVisibleOption || dropdown.options[0];
    if (fallbackOption) dropdown.value = fallbackOption.value;
  }
    pushHistory(dropdown.value);
    filterData({ target: dropdown });
    scrollToTop();
    adjustFontSize();"""

REPLACEMENT_2 = """  if (currentVersion === 'inpt') {
    dropdown.value = MainMenu;
  } else if (currentVersion === 'outpt') {
    dropdown.value = outptMenu;
  } else if (currentVersion === 'eruc') {
    dropdown.value = erucMenu;
  }
  if (!dropdown.querySelector(`option[value=\"${dropdown.value}\"]`)) {
    const firstVisibleOption = Array.from(dropdown.options).find(opt => opt.style.display !== 'none' && !opt.disabled);
    if (firstVisibleOption) dropdown.value = firstVisibleOption.value;
  }
  filterData({ target: dropdown });"""

REPLACEMENT_3 = """  .catch(error => {
    console.error('Error:', error);
    const resultContainer = document.getElementById('resultContainer');
    if (resultContainer) {
      resultContainer.innerHTML = '<div style=\"color:red\">Data load failed. See browser console.</div>';
    }
  });"""

changed_files = []
for path in Path('stations').glob('*/*CDSS.html'):
    text = path.read_text(encoding='utf-8')
    new_text = PATTERN_1.sub(REPLACEMENT_1, text)
    new_text = PATTERN_2.sub(REPLACEMENT_2, new_text)
    new_text = PATTERN_3.sub(REPLACEMENT_3, new_text)
    if text != new_text:
        path.write_text(new_text, encoding='utf-8')
        changed_files.append(str(path))

print(f'Changed {len(changed_files)} files')
for p in changed_files:
    print(p)
