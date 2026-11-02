import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OCCASIONS,
  THEMES,
  normalizePage,
  toPublicPage
} from './shared/content.mjs';

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.dirname(__filename);

function loadEnvFile(root) {
  try {
    const raw = readFileSync(path.join(root, '.env'), 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const splitAt = trimmed.indexOf('=');
      if (splitAt < 1) continue;
      const key = trimmed.slice(0, splitAt).trim();
      let value = trimmed.slice(splitAt + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

loadEnvFile(ROOT);

const PUBLIC_DIR = path.join(ROOT, 'public');
const SHARED_DIR = path.join(ROOT, 'shared');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const STORE_PATH = path.join(DATA_DIR, 'pages.json');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'blessing-admin';
const SESSION_TTL = 1000 * 60 * 60 * 12;
const MAX_LOGIN_ATTEMPTS = 8;
const LOGIN_WINDOW = 1000 * 60 * 15;

const sessions = new Map();
const loginAttempts = new Map();
let store = { version: 1, pages: [] };
let writeQueue = Promise.resolve();

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.avif': 'image/avif',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf'
};

function log(message) {
  console.log(`[blessinglink] ${message}`);
}

function randomToken(length = 10) {
  return randomBytes(12).toString('base64url').slice(0, length);
}

function getOrigin(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim()
    || (req.socket.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function publicUrl(req, page) {
  return `${getOrigin(req)}/b/${page.token}`;
}

function withUrl(req, page) {
  return { ...page, url: publicUrl(req, page) };
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header.split(';').map((part) => {
      const splitAt = part.indexOf('=');
      if (splitAt === -1) return ['', ''];
      return [part.slice(0, splitAt).trim(), decodeURIComponent(part.slice(splitAt + 1).trim())];
    }).filter(([key]) => key)
  );
}

function isAuthenticated(req) {
  const token = parseCookies(req.headers.cookie || '').blessing_session;
  if (!token) return false;
  const session = sessions.get(token);
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

function comparePassword(candidate) {
  const supplied = Buffer.from(String(candidate ?? ''));
  const expected = Buffer.from(ADMIN_PASSWORD);
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(supplied, expected);
}

function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function loginBlocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.startedAt > LOGIN_WINDOW) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function recordFailedLogin(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() - entry.startedAt > LOGIN_WINDOW) {
    loginAttempts.set(ip, { count: 1, startedAt: Date.now() });
    return;
  }
  entry.count += 1;
}

function setJson(res, status, body, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(JSON.stringify(body));
}

function setError(res, status, message, extraHeaders = {}) {
  setJson(res, status, { error: message }, extraHeaders);
}

async function readJson(req, maxBytes = 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('请求内容过大');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('JSON 格式不正确');
    error.statusCode = 400;
    throw error;
  }
}

async function ensureStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    store = {
      version: 1,
      pages: Array.isArray(parsed.pages) ? parsed.pages : []
    };
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    store = { version: 1, pages: createSeedPages() };
    await persistStore();
    log('已创建本地数据文件与演示祝福页');
  }
}

async function persistStore() {
  const temporary = `${STORE_PATH}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await fs.rename(temporary, STORE_PATH);
}

function mutateStore(mutator) {
  const task = writeQueue.then(async () => {
    const result = mutator(store);
    await persistStore();
    return result;
  });
  writeQueue = task.catch(() => {});
  return task;
}

function createSeedPages() {
  const now = new Date().toISOString();
  const makeSeed = (input, token, views) => {
    const normalized = normalizePage(input);
    return {
      ...normalized,
      id: randomUUID(),
      token,
      status: 'published',
      views,
      createdAt: now,
      updatedAt: now,
      publishedAt: now
    };
  };

  return [
    makeSeed({
      recipient: '林晚',
      sender: '阿宁',
      occasion: 'birthday',
      theme: 'ivory',
      title: '给林晚的二十九岁来信',
      message: '林晚，\n认识你的第九年，还是想认真祝你生日快乐。\n愿你继续做那个会在深夜看月亮、在清晨买第一束花的人。愿你去爱，也一直被爱。',
      closing: '新的一岁，去成为更自由的风。',
      eventDate: '2026-10-29',
      gallery: [
        { url: '/assets/images/demo-letter.svg', caption: '那些写不完的话' },
        { url: '/assets/images/demo-morning.svg', caption: '一起看过的清晨' },
        { url: '/assets/images/demo-garden.svg', caption: '属于我们的春天' }
      ],
      milestones: [
        { date: '2017', title: '第一次见面', text: '你坐在窗边，阳光刚好落在桌上。' },
        { date: '2021', title: '一起看海', text: '我们在风里说了很多以后。' },
        { date: '2026', title: '今天', text: '想把这封信，郑重地交到你手里。' }
      ],
      components: { gallery: true, timeline: true, closing: true }
    }, 'demo-linwan', 0),
    makeSeed({
      recipient: '周予安',
      sender: '见字如面',
      occasion: 'festival',
      theme: 'night',
      title: '寄一轮月亮给你',
      message: '予安，\n又到一年灯火渐亮的时候。\n想把此刻的月色、远处的灯和一句轻轻的问候，一起寄给你。愿你在每一个平常夜里，都有一盏灯为你而亮。',
      closing: '月圆人安，万事胜意。',
      eventDate: '2026-10-27',
      gallery: [
        { url: '/assets/images/demo-moon.svg', caption: '今夜月色很好' }
      ],
      components: { gallery: true, closing: true }
    }, 'demo-yuan', 0)
  ];
}

function findPage(id) {
  return store.pages.find((page) => page.id === id);
}

function pageExpired(page) {
  if (!page.expiresAt) return false;
  const expiry = new Date(`${page.expiresAt.slice(0, 10)}T23:59:59`);
  return !Number.isNaN(expiry.getTime()) && expiry.getTime() < Date.now();
}

function createPageObject(input, status = 'draft') {
  const normalized = normalizePage(input);
  const timestamp = new Date().toISOString();
  return {
    ...normalized,
    id: randomUUID(),
    token: randomToken(),
    status,
    views: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    publishedAt: status === 'published' ? timestamp : ''
  };
}

function pageMatchesId(page, id) {
  return page.id === id;
}

function safeStaticPath(root, requestPath) {
  const decoded = decodeURIComponent(requestPath);
  const target = path.resolve(root, `.${decoded}`);
  const relative = path.relative(root, target);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return target;
}

async function sendFile(res, filePath, options = {}) {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) throw Object.assign(new Error('Not found'), { code: 'ENOENT' });
    const ext = path.extname(filePath).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': options.cache || 'public, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });
    const file = await fs.readFile(filePath);
    res.end(file);
  } catch (error) {
    if (error.code === 'ENOENT') {
      setError(res, 404, '文件不存在');
      return;
    }
    throw error;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function serveBlessingShell(res, req, token) {
  const page = store.pages.find((item) => item.token === token);
  const source = await fs.readFile(path.join(PUBLIC_DIR, 'blessing.html'), 'utf8');
  const title = page ? `${page.recipient} · ${page.title}` : '一封写给你的祝福';
  const description = page ? `${page.recipient}，这里有一封来自${page.sender || '重要的人'}的祝福，等你亲自打开。` : '有人为你留下了一封祝福。';
  const meta = [
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    '<meta property="og:type" content="website">',
    '<meta name="twitter:card" content="summary">',
    '<meta name="robots" content="noindex,nofollow,noarchive">'
  ].join('\n    ');
  const html = source
    .replace('<!-- OG_META -->', meta)
    .replaceAll('%OG_TITLE%', escapeHtml(title))
    .replaceAll('%OG_DESCRIPTION%', escapeHtml(description));
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    ...securityHeaders()
  });
  res.end(html);
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'SAMEORIGIN',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  };
}

async function handleApi(req, res, url) {
  const { pathname, searchParams } = url;

  if (pathname === '/api/health' && req.method === 'GET') {
    setJson(res, 200, { ok: true, service: 'blessinglink' });
    return true;
  }

  if (pathname === '/api/auth' && req.method === 'GET') {
    setJson(res, 200, {
      authenticated: isAuthenticated(req),
      defaultPassword: !process.env.ADMIN_PASSWORD
    });
    return true;
  }

  if (pathname === '/api/login' && req.method === 'POST') {
    const ip = clientIp(req);
    if (loginBlocked(ip)) {
      setError(res, 429, '尝试次数过多，请稍后再试');
      return true;
    }
    const body = await readJson(req, 32 * 1024);
    if (!comparePassword(body.password)) {
      recordFailedLogin(ip);
      setError(res, 401, '密码不正确');
      return true;
    }
    loginAttempts.delete(ip);
    const token = randomBytes(32).toString('base64url');
    sessions.set(token, { expiresAt: Date.now() + SESSION_TTL });
    const secure = String(req.headers['x-forwarded-proto'] || '').includes('https') || String(process.env.PUBLIC_BASE_URL || '').startsWith('https://') ? '; Secure' : '';
    setJson(res, 200, { ok: true }, {
      'Set-Cookie': `blessing_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL / 1000}${secure}`
    });
    return true;
  }

  if (pathname === '/api/logout' && req.method === 'POST') {
    const token = parseCookies(req.headers.cookie || '').blessing_session;
    if (token) sessions.delete(token);
    setJson(res, 200, { ok: true }, {
      'Set-Cookie': 'blessing_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'
    });
    return true;
  }

  if (pathname.startsWith('/api/public/pages/') && req.method === 'GET') {
    const token = pathname.split('/').pop();
    const preview = searchParams.get('preview') === '1';
    const page = store.pages.find((item) => item.token === token);
    if (!page) {
      setError(res, 404, '这封祝福不存在或链接已失效');
      return true;
    }
    if (preview && !isAuthenticated(req)) {
      setError(res, 404, '预览链接需要先登录后台');
      return true;
    }
    if (pageExpired(page)) {
      setError(res, 410, '这封祝福已经到期');
      return true;
    }
    if (page.status !== 'published' && !preview) {
      setError(res, 404, '这封祝福还没有发布');
      return true;
    }
    if (page.status === 'published' && !preview) {
      await mutateStore((current) => {
        const target = current.pages.find((item) => item.id === page.id);
        if (target) {
          target.views = Number(target.views || 0) + 1;
          target.lastViewedAt = new Date().toISOString();
        }
      });
    }
    setJson(res, 200, { page: toPublicPage(page), preview });
    return true;
  }

  if (!pathname.startsWith('/api/admin/')) return false;
  if (!isAuthenticated(req)) {
    setError(res, 401, '请先登录后台');
    return true;
  }

  if (pathname === '/api/admin/overview' && req.method === 'GET') {
    const pages = [...store.pages]
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
      .map((page) => withUrl(req, page));
    setJson(res, 200, {
      pages,
      occasions: OCCASIONS,
      themes: THEMES,
      defaultPassword: !process.env.ADMIN_PASSWORD
    });
    return true;
  }

  if (pathname === '/api/admin/pages' && req.method === 'POST') {
    const body = await readJson(req);
    const page = createPageObject(body, body.publish ? 'published' : 'draft');
    await mutateStore((current) => {
      current.pages.unshift(page);
    });
    setJson(res, 201, { page: withUrl(req, page) });
    return true;
  }

  if (pathname === '/api/admin/batch' && req.method === 'POST') {
    const body = await readJson(req, 2 * 1024 * 1024);
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) {
      setError(res, 400, '没有可生成的数据');
      return true;
    }
    if (rows.length > 200) {
      setError(res, 400, '一次最多生成 200 条祝福链接');
      return true;
    }
    const publishAll = Boolean(body.publishAll);
    const created = rows.map((row) => createPageObject(row, publishAll ? 'published' : 'draft'));
    await mutateStore((current) => {
      current.pages.unshift(...created);
    });
    setJson(res, 201, {
      count: created.length,
      pages: created.map((page) => withUrl(req, page))
    });
    return true;
  }

  if (pathname === '/api/admin/bulk' && req.method === 'POST') {
    const body = await readJson(req);
    const ids = new Set(Array.isArray(body.ids) ? body.ids.map(String) : []);
    const action = String(body.action || '');
    if (!ids.size) {
      setError(res, 400, '请选择祝福页');
      return true;
    }
    if (!['publish', 'unpublish', 'delete'].includes(action)) {
      setError(res, 400, '不支持的批量操作');
      return true;
    }
    let affected = 0;
    await mutateStore((current) => {
      if (action === 'delete') {
        const before = current.pages.length;
        current.pages = current.pages.filter((page) => !ids.has(page.id));
        affected = before - current.pages.length;
        return;
      }
      const now = new Date().toISOString();
      current.pages.forEach((page) => {
        if (!ids.has(page.id)) return;
        page.status = action === 'publish' ? 'published' : 'draft';
        page.updatedAt = now;
        if (action === 'publish') page.publishedAt = page.publishedAt || now;
        affected += 1;
      });
    });
    setJson(res, 200, { ok: true, affected });
    return true;
  }

  const uploadMatch = pathname.match(/^\/api\/admin\/uploads$/);
  if (uploadMatch && req.method === 'POST') {
    const body = await readJson(req, 18 * 1024 * 1024);
    const match = String(body.data || '').match(/^data:([a-zA-Z0-9/+.-]+);base64,(.+)$/);
    if (!match) {
      setError(res, 400, '上传文件格式不正确');
      return true;
    }
    const mime = match[1].toLowerCase();
    const extensionMap = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/avif': '.avif',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/wav': '.wav',
      'audio/ogg': '.ogg',
      'video/mp4': '.mp4'
    };
    const ext = extensionMap[mime];
    if (!ext) {
      setError(res, 415, '仅支持常见图片、音频和 MP4 视频');
      return true;
    }
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > 12 * 1024 * 1024) {
      setError(res, 413, '单个文件不能超过 12MB');
      return true;
    }
    const fileName = `${randomBytes(12).toString('hex')}${ext}`;
    await fs.writeFile(path.join(UPLOAD_DIR, fileName), buffer);
    setJson(res, 201, { url: `/uploads/${fileName}` });
    return true;
  }

  const pageMatch = pathname.match(/^\/api\/admin\/pages\/([a-zA-Z0-9-]+)$/);
  if (pageMatch && req.method === 'PUT') {
    const page = findPage(pageMatch[1]);
    if (!page) {
      setError(res, 404, '祝福页不存在');
      return true;
    }
    const body = await readJson(req);
    const normalized = normalizePage(body, page);
    Object.assign(page, normalized, {
      status: page.status,
      updatedAt: new Date().toISOString()
    });
    await mutateStore(() => {});
    setJson(res, 200, { page: withUrl(req, page) });
    return true;
  }

  if (pageMatch && req.method === 'DELETE') {
    const id = pageMatch[1];
    let removed = false;
    await mutateStore((current) => {
      const next = current.pages.filter((page) => !pageMatchesId(page, id));
      removed = next.length !== current.pages.length;
      current.pages = next;
    });
    if (!removed) {
      setError(res, 404, '祝福页不存在');
      return true;
    }
    setJson(res, 200, { ok: true });
    return true;
  }

  const publishMatch = pathname.match(/^\/api\/admin\/pages\/([a-zA-Z0-9-]+)\/(publish|unpublish)$/);
  if (publishMatch && req.method === 'POST') {
    const page = findPage(publishMatch[1]);
    if (!page) {
      setError(res, 404, '祝福页不存在');
      return true;
    }
    const publishing = publishMatch[2] === 'publish';
    const updated = await mutateStore(() => {
      page.status = publishing ? 'published' : 'draft';
      page.updatedAt = new Date().toISOString();
      if (publishing) page.publishedAt = page.publishedAt || page.updatedAt;
      return { ...page };
    });
    setJson(res, 200, { page: withUrl(req, updated) });
    return true;
  }

  setError(res, 404, '接口不存在');
  return true;
}

async function handleRequest(req, res) {
  Object.entries(securityHeaders()).forEach(([key, value]) => res.setHeader(key, value));

  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${PORT}`}`);
    if (await handleApi(req, res, url)) return;

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      setError(res, 405, 'Method not allowed');
      return;
    }

    const { pathname } = url;
    const blessingMatch = pathname.match(/^\/b\/([a-zA-Z0-9_-]{6,40})\/?$/);
    if (blessingMatch) {
      await serveBlessingShell(res, req, blessingMatch[1]);
      return;
    }

    if (pathname === '/' || pathname === '/index.html') {
      await sendFile(res, path.join(PUBLIC_DIR, 'index.html'), { cache: 'no-store' });
      return;
    }

    const directFiles = new Set(['/admin.css', '/admin.js', '/blessing.css', '/blessing.js', '/favicon.svg']);
    if (directFiles.has(pathname)) {
      await sendFile(res, path.join(PUBLIC_DIR, pathname.slice(1)), { cache: 'no-store' });
      return;
    }

    if (pathname.startsWith('/assets/')) {
      const filePath = safeStaticPath(PUBLIC_DIR, pathname);
      if (filePath) await sendFile(res, filePath, { cache: 'public, max-age=300, must-revalidate' });
      else setError(res, 400, '路径不正确');
      return;
    }

    if (pathname.startsWith('/uploads/')) {
      const filePath = safeStaticPath(DATA_DIR, pathname);
      if (filePath) await sendFile(res, filePath, { cache: 'public, max-age=86400' });
      else setError(res, 400, '路径不正确');
      return;
    }

    if (pathname.startsWith('/modules/')) {
      const filePath = safeStaticPath(SHARED_DIR, pathname.slice('/modules'.length));
      if (filePath) await sendFile(res, filePath, { cache: 'no-store' });
      else setError(res, 400, '路径不正确');
      return;
    }

    setError(res, 404, '页面不存在');
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      setError(res, error.statusCode || 500, error.statusCode ? error.message : '服务器内部错误');
    } else {
      res.end();
    }
  }
}

async function start() {
  if (process.env.NODE_ENV === 'production' && !process.env.ADMIN_PASSWORD) {
    throw new Error('生产环境必须设置 ADMIN_PASSWORD');
  }
  await ensureStorage();
  const server = http.createServer((req, res) => {
    handleRequest(req, res);
  });
  server.listen(PORT, HOST, () => {
    log(`后台地址: http://${HOST}:${PORT}`);
    if (!process.env.ADMIN_PASSWORD) {
      log('警告: 正在使用默认后台密码 blessing-admin。部署前请设置 ADMIN_PASSWORD。');
    }
  });
}

if (process.argv[1] === __filename) {
  start().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { start, createPageObject, randomToken };















