import { basicSetup } from 'codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { json } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { inspect, transform, compare } from './json.js';
import './style.css';

const app = document.querySelector('#app');
app.innerHTML = `
  <header class="header"><a class="brand" href="./"><span class="logo">{ }</span> JSON<span class="brand-light">Studio</span></a><span class="privacy"><span class="dot"></span> 本機處理 · 無廣告</span><a class="github" href="https://github.com/Urash0519/json-edit-format" target="_blank" rel="noreferrer">GitHub ↗</a></header>
  <main><section class="heading"><div class="eyebrow">YOUR EVERYDAY JSON WORKSPACE</div><h1>讓 JSON，一目了然。</h1><p>貼上、整理、比對。專注在資料本身。</p></section>
  <section class="workspace" aria-label="JSON 工作區"><div class="workbar"><div class="work-title"><span class="workspace-dot"></span> 雙欄編輯器</div><div class="global-actions"><label>縮排 <select id="indent"><option value="2">2 格</option><option value="4">4 格</option></select></label><button id="format-all">格式化兩側</button><button id="compare" class="primary">⇄ 比對內容</button></div></div>
  <div class="editors">${['left', 'right'].map((side, i) => `<section class="pane"><div class="pane-title"><div><span class="panel-index">0${i + 1}</span><h2>${i ? '右側 JSON' : '左側 JSON'}</h2><span class="file-label">${i ? '修改版本' : '原始版本'}</span></div><button data-side="${side}" data-action="import" class="text-button">開啟檔案 ↗</button><input type="file" id="${side}-file" accept=".json,application/json,text/plain" hidden></div><div class="pane-actions"><button data-side="${side}" data-action="format">格式化</button><button data-side="${side}" data-action="compact">壓縮</button><span class="spacer"></span><button data-side="${side}" data-action="copy">複製</button><button data-side="${side}" data-action="download">下載</button><button data-side="${side}" data-action="clear">清空</button></div><div id="${side}-editor" class="editor"></div><div class="pane-status"><button id="${side}-status" class="validation" title="點擊跳至錯誤位置"></button><span id="${side}-count"></span></div></section>`).join('')}</div>
  <div class="workspace-bottom"><span>⌘ / Ctrl + Enter 格式化 · Ctrl / ⌘ + F 搜尋</span><button id="swap" class="text-button">⇄ 交換左右</button></div></section>
  <section class="results" aria-label="比對結果"><div class="result-head"><h2>比對結果 <span id="diff-count" class="badge">—</span></h2><span>忽略空白與物件欄位順序 · 保留陣列順序</span></div><div id="results" aria-live="polite"><div class="empty-result"><span class="compare-icon">⇄</span><div><strong>每個差異，都有跡可循。</strong><p>在兩側貼上 JSON，再按「比對內容」。</p></div></div></div></section>
  <footer><span>資料不會上傳，也不會自動儲存。重新整理前，請先下載或複製。</span><span>JSON Studio <span class="footer-mark">{ }</span></span></footer></main><div id="toast" role="status" class="toast" hidden></div>`;

const views = {};
let compared = false, toastTimer;
const notify = message => { const el = document.querySelector('#toast'); el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 3500); };
const content = side => views[side].state.doc.toString();
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
  views[side] = new EditorView({ parent: document.querySelector(`#${side}-editor`), extensions: [basicSetup, json(), EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': side === 'left' ? '左側 JSON 編輯器' : '右側 JSON 編輯器', spellcheck: 'false' }),
    keymap.of([{ key: 'Mod-Enter', run: () => { runTransform(side); return true; } }]),
    linter(view => { const text = view.state.doc.toString(); return text.trim() ? inspect(text).issues.map(e => ({ from: e.offset, to: Math.min(e.offset + e.length, text.length), severity: 'error', message: e.message })) : []; }),
    EditorView.updateListener.of(update => { if (update.docChanged) refresh(side); }),
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
