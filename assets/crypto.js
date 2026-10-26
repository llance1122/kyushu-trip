// 密碼加密金鑰與 GitHub 存取的共用工具
const TripCrypto = (() => {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const toB64 = (buf) => { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); };
  const fromB64 = (str) => Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
  async function key(password, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(text, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(password, salt), enc.encode(text));
    return { salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
  }
  async function decrypt(obj, password) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(obj.iv) }, await key(password, fromB64(obj.salt)), fromB64(obj.ct));
    return dec.decode(pt);
  }
  const utf8ToB64 = (str) => toB64(enc.encode(str));
  const b64ToUtf8 = (b64) => dec.decode(fromB64(b64.replace(/\s/g, '')));
  return { encrypt, decrypt, utf8ToB64, b64ToUtf8 };
})();

const GitHub = (() => {
  const api = 'https://api.github.com';
  const headers = (token) => ({ Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' });
  async function getFile(cfg, token, path) {
    const r = await fetch(`${api}/repos/${cfg.owner}/${cfg.repo}/contents/${path}?ref=${cfg.branch}&t=${Date.now()}`, { headers: headers(token), cache: 'no-store' });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`讀取失敗（${r.status}）`);
    const j = await r.json();
    return { sha: j.sha, text: TripCrypto.b64ToUtf8(j.content) };
  }
  async function putFile(cfg, token, path, text, sha, message) {
    const body = { message, content: TripCrypto.utf8ToB64(text), branch: cfg.branch };
    if (sha) body.sha = sha;
    const r = await fetch(`${api}/repos/${cfg.owner}/${cfg.repo}/contents/${path}`, { method: 'PUT', headers: headers(token), body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) throw Object.assign(new Error('conflict'), { code: 'conflict' });
    if (!r.ok) throw new Error(`寫入失敗（${r.status}）`);
    const j = await r.json();
    return j.content.sha;
  }
  async function checkRepo(cfg, token) {
    const r = await fetch(`${api}/repos/${cfg.owner}/${cfg.repo}`, { headers: headers(token) });
    if (!r.ok) throw new Error(r.status === 404 ? '找不到這個 repo，或金鑰沒有存取權限' : `驗證失敗（${r.status}）`);
    return r.json();
  }
  return { getFile, putFile, checkRepo };
})();
