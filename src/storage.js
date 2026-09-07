const key = side => `json-studio-document-v1-${side}`;

export function loadDocument(storage, side) {
  try { return { text: storage.getItem(key(side)) ?? '', ok: true }; }
  catch { return { text: '', ok: false }; }
}

export function saveDocument(storage, side, text) {
  try {
    if (text === '') storage.removeItem(key(side));
    else storage.setItem(key(side), text);
    return true;
  } catch { return false; }
}
