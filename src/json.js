import { parseTree, printParseErrorCode, format, applyEdits, createScanner, SyntaxKind } from 'jsonc-parser';

const messages = {
  InvalidSymbol: '無效的符號，請使用標準 JSON 語法',
  InvalidNumberFormat: '數字格式不正確',
  PropertyNameExpected: '屬性名稱必須用雙引號包住',
  ValueExpected: '此處需要 JSON 值',
  ColonExpected: '屬性名稱後缺少冒號 :',
  CommaExpected: '項目之間缺少逗號 ,',
  CloseBraceExpected: '缺少結尾大括號 }',
  CloseBracketExpected: '缺少結尾中括號 ]',
  EndOfFileExpected: 'JSON 結尾有多餘內容',
  InvalidCommentToken: '標準 JSON 不允許註解',
  UnexpectedEndOfString: '字串缺少結尾雙引號',
  UnexpectedEndOfNumber: '數字尚未完成',
  InvalidEscapeCharacter: '無效的跳脫字元',
  InvalidUnicode: '無效的 Unicode 跳脫字元',
  InvalidCharacter: '字串包含無效字元',
};

export function inspect(text) {
  const errors = [];
  const tree = parseTree(text, errors, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  const issues = errors.map(e => ({ ...e, message: messages[printParseErrorCode(e.error)] || printParseErrorCode(e.error) }));
  // Reject duplicate keys: otherwise a comparison can silently omit user data.
  const walk = node => {
    if (node.type === 'object') {
      const keys = new Set();
      for (const property of node.children || []) {
        const key = property.children[0];
        if (keys.has(key.value)) issues.push({ offset: key.offset, length: key.length, message: `重複的屬性名稱：${key.value}` });
        keys.add(key.value);
      }
    }
    for (const child of node.children || []) walk(child);
  };
  if (tree && !errors.length) walk(tree);
  return { tree, issues };
}

export function transform(text, indent = 2, compact = false) {
  if (inspect(text).issues.length) throw new Error('請先修正 JSON 錯誤');
  if (!compact) return applyEdits(text, format(text, undefined, { insertSpaces: true, tabSize: indent, eol: '\n' })).trim();
  const scanner = createScanner(text, true);
  let result = '';
  while (scanner.scan() !== SyntaxKind.EOF) result += text.slice(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength());
  return result;
}

// Normalize decimal notation without converting to IEEE-754 numbers.
function numberKey(raw) {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  let digits = (match[2] + (match[3] || '')).replace(/^0+/, '');
  if (!digits) return '0';
  let exponent = BigInt(match[4] || '0') - BigInt((match[3] || '').length);
  const trailing = digits.match(/0+$/)?.[0].length || 0;
  if (trailing) { digits = digits.slice(0, -trailing); exponent += BigInt(trailing); }
  return `${match[1]}${digits}e${exponent}`;
}

export function compare(left, right) {
  const a = inspect(left), b = inspect(right);
  if (a.issues.length || b.issues.length) throw new Error('請先修正左右兩側的 JSON 錯誤');
  const differences = [];
  const raw = (node, text) => node ? text.slice(node.offset, node.offset + node.length) : undefined;
  const add = (path, x, y) => differences.push({ path: path || '/', kind: !x ? 'added' : !y ? 'removed' : 'changed', left: raw(x, left), right: raw(y, right), leftOffset: x?.offset, rightOffset: y?.offset });
  const escape = key => key.replace(/~/g, '~0').replace(/\//g, '~1');
  function walk(x, y, path) {
    if (!x || !y || x.type !== y.type) return add(path, x, y);
    if (x.type === 'object') {
      const entries = node => new Map((node.children || []).map(p => [p.children[0].value, p.children[1]]));
      const xm = entries(x), ym = entries(y);
      for (const key of new Set([...xm.keys(), ...ym.keys()])) walk(xm.get(key), ym.get(key), `${path}/${escape(key)}`);
    } else if (x.type === 'array') {
      for (let i = 0; i < Math.max(x.children.length, y.children.length); i++) walk(x.children[i], y.children[i], `${path}/${i}`);
    } else if (x.type === 'number' ? numberKey(raw(x, left)) !== numberKey(raw(y, right)) : x.value !== y.value) add(path, x, y);
  }
  walk(a.tree, b.tree, '');
  return differences;
}
