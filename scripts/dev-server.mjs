import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import generateHandler from '../api/generate.js';

const root = normalize(join(fileURLToPath(new URL('..', import.meta.url))));
const port = Number(process.env.PORT || 8765);
const host = process.env.HOST || '127.0.0.1';

async function loadEnvFile() {
  try {
    const text = await readFile(join(root, '.env'), 'utf8');
    text.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.slice(0, index).trim();
      const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch {
    // .env is optional; production uses platform environment variables.
  }
}

const contentTypes = {
  '.html': 'text/html;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8',
  '.css': 'text/css;charset=utf-8',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.json': 'application/json;charset=utf-8',
  '.md': 'text/markdown;charset=utf-8'
};

function send(res, status, body, type = 'text/plain;charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

async function parseJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function createApiResponse(res) {
  return {
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    status(code) {
      res.statusCode = code;
      return this;
    },
    json(data) {
      send(res, res.statusCode || 200, JSON.stringify(data), 'application/json;charset=utf-8');
      return this;
    }
  };
}

async function handleApi(req, res) {
  try {
    req.body = await parseJson(req);
    await generateHandler(req, createApiResponse(res));
  } catch (error) {
    send(res, 400, JSON.stringify({ error: error.message }), 'application/json;charset=utf-8');
  }
}

async function handleStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const target = normalize(join(root, pathname));

  if (!target.startsWith(root)) {
    send(res, 403, 'Forbidden');
    return;
  }

  try {
    const body = await readFile(target);
    send(res, 200, body, contentTypes[extname(target)] || 'application/octet-stream');
  } catch {
    send(res, 404, 'Not found');
  }
}

await loadEnvFile();

createServer((req, res) => {
  if (req.url?.startsWith('/api/generate')) {
    handleApi(req, res);
    return;
  }
  handleStatic(req, res);
}).listen(port, host, () => {
  console.log(`НГО dev server: http://${host}:${port}`);
});
