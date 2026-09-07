import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { json } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { inspect, transform, compare } from './json.js';
import { loadDocument, saveDocument } from './storage.js';
import './style.css';

const app = document.querySelector('#app');
// Inline outline icons are decorative; visible labels remain the accessible names.
const iconPaths = {
  format: '<path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m13 5h3a2 2 0 0 0 2-2v-3M8 8h8M8 12h6M8 16h8"/>',
  compact: '<path d="m8 4 4 4 4-4M12 8V2m-4 18 4-4 4 4m-4-4v6M4 12h16"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h4"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v4h16v-4"/>',
  clear: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  import: '<path d="M3 8V5a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v1M3 9h18l-3 11H5L3 9Z"/>',
  compare: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6"/>',
};
const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPaths[name]}</svg>`;
app.innerHTML = `
  <header class="header"><a class="brand" href="./"><span class="logo">{ }</span> JSON<span class="brand-light">Studio</span></a><label class="theme-control">主題 <select id="theme"><option value="system">跟隨系統</option><option value="light">Light 淺色</option><option value="dark">Dark 深色</option><option value="blue">Blue 藍灰白</option></select></label></header>
  <main>
  <section class="workspace" aria-label="JSON 工作區"><div class="workbar"><div class="work-title"><span class="workspace-dot"></span> 雙欄編輯器</div><div class="global-actions"><label>縮排 <select id="indent"><option value="2">2 格</option><option value="4">4 格</option></select></label><button id="format-all">格式化兩側</button><button id="compare" class="primary">⇄ 比對內容</button></div></div>
  <div class="editors">${['left', 'right'].map((side, i) => `<section class="pane"><div class="pane-title"><div><span class="panel-index">0${i + 1}</span><h2>${i ? '右側 JSON' : '左側 JSON'}</h2><span class="file-label">${i ? '修改版本' : '原始版本'}</span></div><button data-side="${side}" data-action="import" class="text-button">開啟檔案 ↗</button><input type="file" id="${side}-file" accept=".json,application/json,text/plain" hidden></div><div class="pane-actions"><button data-side="${side}" data-action="format">格式化</button><button data-side="${side}" data-action="compact">壓縮</button><span class="spacer"></span><button data-side="${side}" data-action="copy">複製</button><button data-side="${side}" data-action="download">下載</button><button data-side="${side}" data-action="clear">清空</button></div><div id="${side}-editor" class="editor"></div><div class="pane-status"><button id="${side}-status" class="validation" title="點擊跳至錯誤位置"></button><span id="${side}-count"></span></div></section>`).join('')}</div>
  <div class="workspace-bottom"><span>⌘ / Ctrl + Enter 格式化 · Ctrl / ⌘ + F 搜尋</span><label class="height-control" for="editor-height">編輯區高度 <input id="editor-height" type="range" min="300" max="1400" step="10"><output id="height-value" for="editor-height"></output></label><button id="reset-height" class="text-button">自動高度</button><button id="swap" class="text-button">⇄ 交換左右</button></div></section>
  <section class="results" aria-label="比對結果"><div class="result-head"><h2>比對結果 <span id="diff-count" class="badge">—</span></h2><span>忽略空白與物件欄位順序 · 保留陣列順序</span></div><div id="results" aria-live="polite"><div class="empty-result"><span class="compare-icon">⇄</span><div><strong>每個差異，都有跡可循。</strong><p>在兩側貼上 JSON，再按「比對內容」。</p></div></div></div></section>
  <footer><span id="save-status" role="status">自動保存於此瀏覽器，不會上傳。</span><span>JSON Studio <span class="footer-mark">{ }</span></span></footer></main><div id="toast" role="status" class="toast" hidden></div>`;

const views = {};
document.querySelectorAll('[data-action]').forEach(button => {
  button.textContent = button.textContent.replace(' ↗', '');
  button.insertAdjacentHTML('afterbegin', icon(button.dataset.action));
});
for (const [id, name] of [['format-all', 'format'], ['compare', 'compare'], ['swap', 'compare'], ['reset-height', 'reset']]) {
  const button = document.getElementById(id);
  button.textContent = button.textContent.replace('⇄ ', '');
  button.insertAdjacentHTML('afterbegin', icon(name));
}
document.querySelector('.compare-icon').innerHTML = icon('compare');
const themeCompartments = {};
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
const readPreference = key => { try { return localStorage.getItem(key); } catch { return null; } };
const savePreference = (key, value) => { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value); } catch { /* Preferences are optional when storage is unavailable. */ } };
const themeSelect = document.querySelector('#theme');
const savedTheme = readPreference('json-studio-theme');
themeSelect.value = ['light', 'dark', 'blue', 'system'].includes(savedTheme) ? savedTheme : 'system';
const darkTheme = () => themeSelect.value === 'dark' || (themeSelect.value === 'system' && systemTheme.matches);
function editorTheme() {
  const dark = darkTheme();
  return [EditorView.theme({}, { dark }), syntaxHighlighting(HighlightStyle.define([
    { tag: tags.propertyName, color: dark ? '#91c9ff' : '#285f92' },
    { tag: tags.string, color: dark ? '#a9d995' : '#327243' },
    { tag: tags.number, color: dark ? '#f3c58d' : '#975213' },
    { tag: [tags.bool, tags.null], color: dark ? '#cbb0f5' : '#8553a3' },
    { tag: tags.punctuation, color: dark ? '#bac7c2' : '#5b6f64' },
  ]))];
}
function applyTheme() {
  document.documentElement.dataset.theme = darkTheme() ? 'dark' : themeSelect.value === 'blue' ? 'blue' : 'light';
  document.querySelector('meta[name="theme-color"]').content = darkTheme() ? '#1c201d' : themeSelect.value === 'blue' ? '#eef2f6' : '#f3f4ef';
  for (const side of Object.keys(views)) views[side].dispatch({ effects: themeCompartments[side].reconfigure(editorTheme()) });
}
themeSelect.onchange = () => { savePreference('json-studio-theme', themeSelect.value); applyTheme(); };
systemTheme.addEventListener('change', () => { if (themeSelect.value === 'system') applyTheme(); });
applyTheme();
const heightInput = document.querySelector('#editor-height');
const storedHeight = Number(readPreference('json-studio-height'));
let manualHeight = storedHeight >= 300 && storedHeight <= 1400 ? storedHeight : null;
function applyHeight() {
  const height = manualHeight ?? Math.max(420, Math.min(1400, Math.round((innerHeight - 270) / 10) * 10));
  document.documentElement.style.setProperty('--editor-height', `${height}px`);
  heightInput.value = height;
  document.querySelector('#height-value').textContent = `${height}px`;
  for (const view of Object.values(views)) view.requestMeasure();
}
heightInput.oninput = () => { manualHeight = Number(heightInput.value); savePreference('json-studio-height', String(manualHeight)); applyHeight(); };
document.querySelector('#reset-height').onclick = () => { manualHeight = null; savePreference('json-studio-height', null); applyHeight(); };
window.addEventListener('resize', () => { if (manualHeight === null) applyHeight(); });
applyHeight();
let compared = false, toastTimer;
const notify = message => { const el = document.querySelector('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 3500); };
const content = side => views[side].state.doc.toString();
let documentStorage;
try { documentStorage = window.localStorage; } catch { /* Report unavailable storage below. */ }
const restored = Object.fromEntries(['left', 'right'].map(side => [side, loadDocument(documentStorage, side)]));
const dirtySides = new Set();
let saveTimer;
const saveStatus = document.querySelector('#save-status');
function flushDocuments() {
  clearTimeout(saveTimer);
  for (const side of dirtySides) if (saveDocument(documentStorage, side, content(side))) dirtySides.delete(side);
  saveStatus.classList.toggle('invalid', dirtySides.size > 0);
  saveStatus.textContent = dirtySides.size ? '無法保存：瀏覽器儲存空間不足或被停用，請先下載或複製。' : '已保存於此瀏覽器，不會上傳。';
}
function scheduleSave(side) {
  dirtySides.add(side);
  saveStatus.textContent = '正在保存…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushDocuments, 300);
}
if (Object.values(restored).some(result => !result.ok)) {
  saveStatus.classList.add('invalid');
  saveStatus.textContent = '無法讀取瀏覽器紀錄；本次內容請先下載或複製。';
} else if (Object.values(restored).some(result => result.text)) saveStatus.textContent = '已還原上次內容；變更會自動保存於此瀏覽器。';
window.addEventListener('pagehide', () => { if (dirtySides.size) flushDocuments(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && dirtySides.size) flushDocuments(); });
function setContent(side, text) { views[side].dispatch({ changes: { from: 0, to: views[side].state.doc.length, insert: text } }); }
function invalidate() { if (compared) { document.querySelector('#diff-count').textContent = '待更新'; document.querySelector('#results').textContent = '內容已變更，請重新比對。'; compared = false; } }
function refresh(side) {
  const text = content(side), state = inspect(text), status = document.querySelector(`#${side}-status`);
  const first = state.issues[0];
  status.className = `validation ${!text.trim() ? 'neutral' : first ? 'invalid' : 'valid'}`;
  status.textContent = !text.trim() ? '○ 等待輸入' : first ? `● ${first.message}（第 ${views[side].state.doc.lineAt(first.offset).number} 行）` : '● JSON 格式正確';
  status.onclick = () => { if (first) jump(side, first.offset); };
  document.querySelector(`#${side}-count`).textContent = `${views[side].state.doc.lines} 行 · ${new TextEncoder().encode(text).length.toLocaleString()} bytes`;
  invalidate();
}
function jump(side, position) { if (position === undefined) return; const view = views[side]; view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: 'center' }) }); view.focus(); }
function runTransform(side, compact = false) { try { setContent(side, transform(content(side), Number(document.querySelector('#indent').value), compact)); return true; } catch (error) { notify(error.message); const first = inspect(content(side)).issues[0]; if (first) jump(side, first.offset); return false; } }
for (const side of ['left', 'right']) {
  themeCompartments[side] = new Compartment();
  views[side] = new EditorView({ doc: restored[side].text, parent: document.querySelector(`#${side}-editor`), extensions: [basicSetup, json(), EditorView.lineWrapping, themeCompartments[side].of(editorTheme()),
    EditorView.editorAttributes.of(view => ({ class: view.state.selection.ranges.some(range => !range.empty) ? 'has-selection' : '' })),
    EditorView.contentAttributes.of({ 'aria-label': side === 'left' ? '左側 JSON 編輯器' : '右側 JSON 編輯器', spellcheck: 'false' }),
    keymap.of([{ key: 'Mod-Enter', run: () => { runTransform(side); return true; } }]),
    linter(view => { const text = view.state.doc.toString(); return text.trim() ? inspect(text).issues.map(e => ({ from: e.offset, to: Math.min(e.offset + e.length, text.length), severity: 'error', message: e.message })) : []; }),
    EditorView.updateListener.of(update => { if (update.docChanged) { refresh(side); scheduleSave(side); } }),
  ] });
  refresh(side);
  document.querySelector(`#${side}-file`).addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try { if (file.size > 5 * 1024 * 1024) throw new Error('請選擇 5 MB 以下的 JSON 檔案'); setContent(side, await file.text()); notify(`已開啟 ${file.name}`); } catch (error) { notify(error.message); } finally { event.target.value = ''; }
  });
}
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
  const { side, action } = button.dataset;
  if (action === 'format' || action === 'compact') runTransform(side, action === 'compact');
  if (action === 'clear') setContent(side, '');
  if (action === 'import') document.querySelector(`#${side}-file`).click();
  if (action === 'copy') { try { await navigator.clipboard.writeText(content(side)); notify('已複製到剪貼簿'); } catch { notify('無法使用剪貼簿，請在編輯器內全選後複製'); } }
  if (action === 'download') { const url = URL.createObjectURL(new Blob([content(side)], { type: 'application/json;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = `${side}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
}));
document.querySelector('#format-all').onclick = () => { for (const side of ['left', 'right']) if (content(side).trim()) runTransform(side); };
document.querySelector('#swap').onclick = () => { const left = content('left'); setContent('left', content('right')); setContent('right', left); };
document.querySelector('#compare').onclick = () => {
  const target = document.querySelector('#results'); target.replaceChildren();
  try {
    const diffs = compare(content('left'), content('right')); compared = true;
    document.querySelector('#diff-count').textContent = `${diffs.length} 處差異`;
    if (!diffs.length) { const message = document.createElement('p'); message.className = 'match-result'; message.textContent = '✓ 兩側 JSON 內容一致'; target.append(message); return; }
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr><th>變更 / JSON Pointer 路徑</th><th>左側值</th><th>右側值</th></tr></thead>';
    const body = document.createElement('tbody');
    for (const diff of diffs.slice(0, 500)) {
      const row = document.createElement('tr');
      const path = document.createElement('td'), tag = document.createElement('span'), code = document.createElement('code');
      tag.className = `change-tag ${diff.kind}`; tag.textContent = { added: '新增', removed: '刪除', changed: '修改' }[diff.kind]; code.textContent = diff.path; path.append(tag, code); row.append(path);
      for (const side of ['left', 'right']) { const cell = document.createElement('td'), button = document.createElement('button'); button.className = 'diff-value'; button.textContent = diff[side] === undefined ? '— 不存在' : diff[side].slice(0, 400); button.title = '跳至編輯器中的位置'; button.disabled = diff[`${side}Offset`] === undefined; button.onclick = () => jump(side, diff[`${side}Offset`]); cell.append(button); row.append(cell); }
      body.append(row);
    }
    table.append(body); target.append(table);
    if (diffs.length > 500) { const message = document.createElement('p'); message.textContent = '為維持操作順暢，僅顯示前 500 處差異。'; target.append(message); }
  } catch (error) { target.textContent = error.message; document.querySelector('#diff-count').textContent = '無法比對'; notify(error.message); }
};
