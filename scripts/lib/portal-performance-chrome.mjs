import { access, readFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const CANDIDATES = process.platform === 'win32'
  ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe']
  : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser'];


export class TargetOperationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TargetOperationError';
    this.code = code;
    Object.assign(this, details);
  }
}

async function fetchJsonWithTimeout(url, { method = 'GET', timeoutMs = 5000, timeoutCode, invalidCode, failedCode }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, signal: controller.signal });
    if (!response.ok) throw new TargetOperationError(failedCode || invalidCode, `Endpoint CDP retornou HTTP ${response.status}`, { status: response.status });
    return await response.json();
  } catch (error) {
    if (error?.name === 'AbortError') throw new TargetOperationError(timeoutCode, `Endpoint CDP excedeu ${timeoutMs} ms`, { timeoutMs });
    if (error instanceof TargetOperationError) throw error;
    throw new TargetOperationError(invalidCode, 'Endpoint CDP retornou payload inválido', { causeMessage: error.message });
  } finally {
    clearTimeout(timer);
  }
}

export function waitForPageLoad(cdp, { timeoutMs = 10000, label = 'page_load' } = {}) {
  let timer;
  let unsubscribe = () => {};
  let settled = false;
  const cleanup = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    unsubscribe();
    unsubscribe = () => {};
  };
  const promise = new Promise((resolve, reject) => {
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };
    unsubscribe = cdp.on('Page.loadEventFired', () => finish(resolve));
    timer = setTimeout(() => finish(reject, Object.assign(new Error(`${label}: Page.loadEventFired não ocorreu em ${timeoutMs} ms`), { code: 'PAGE_LOAD_TIMEOUT', label, timeoutMs })), timeoutMs);
  });
  return { promise, cleanup };
}

export class ChromeLaunchError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ChromeLaunchError';
    this.code = code;
    Object.assign(this, details);
  }
}

export function sanitizeChromeStderr(text, limit = 1600) {
  return String(text || '')
    .replace(/(token|authorization|cookie|password|secret)=([^\s&]+)/gi, '$1=[REDACTED]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .slice(-limit);
}

export async function validateChromeBinary(bin) {
  if (!bin) throw new ChromeLaunchError('CHROME_NOT_FOUND', 'Chrome/Chromium não encontrado. Defina CHROME_BIN.');
  let info;
  try { info = await stat(bin); } catch {
    throw new ChromeLaunchError('CHROME_NOT_FOUND', `Binário Chrome inexistente: ${bin}`, { binary: bin });
  }
  if (!info.isFile()) throw new ChromeLaunchError('CHROME_NOT_EXECUTABLE', `CHROME_BIN não aponta para arquivo executável: ${bin}`, { binary: bin });
  try { await access(bin, constants.X_OK); } catch {
    throw new ChromeLaunchError('CHROME_NOT_EXECUTABLE', `Binário Chrome sem permissão de execução: ${bin}`, { binary: bin });
  }
  return bin;
}

export async function findChrome() {
  for (const p of [process.env.CHROME_BIN, ...CANDIDATES].filter(Boolean)) {
    try { return await validateChromeBinary(p); } catch {}
  }
  return null;
}

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function waitForDevToolsPort({ child, dir, binary, timeoutMs, pollMs, stderrChunks }) {
  const started = Date.now();
  let exitInfo = null;
  child.once('exit', (code, signal) => { exitInfo = { code, signal }; });
  while (Date.now() - started < timeoutMs) {
    if (exitInfo || child.exitCode !== null) {
      const waitedMs = Date.now() - started;
      throw new ChromeLaunchError('CHROME_EXITED_BEFORE_CDP', `Chrome encerrou antes de disponibilizar CDP (${binary})`, {
        binary, waitedMs, exitCode: exitInfo?.code ?? child.exitCode, signal: exitInfo?.signal ?? child.signalCode,
        stderr: sanitizeChromeStderr(stderrChunks.join(''))
      });
    }
    try {
      const raw = await readFile(path.join(dir, 'DevToolsActivePort'), 'utf8');
      const port = Number(raw.split('\n')[0]);
      if (Number.isInteger(port) && port > 0) return { port, waitedMs: Date.now() - started };
    } catch {}
    await delay(pollMs);
  }
  throw new ChromeLaunchError('CHROME_CDP_TIMEOUT', `Chrome não disponibilizou a porta CDP dentro do prazo (${binary})`, {
    binary, waitedMs: Date.now() - started, exitCode: child.exitCode, signal: child.signalCode,
    stderr: sanitizeChromeStderr(stderrChunks.join(''))
  });
}

export async function readChromeVersion(port, { binary = null, timeoutMs = 5000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: controller.signal });
    if (!response.ok) throw new ChromeLaunchError('CHROME_VERSION_ENDPOINT_INVALID', `Endpoint /json/version inválido: HTTP ${response.status}`, { binary, status: response.status });
    const version = await response.json();
    if (!version || typeof version.Browser !== 'string') throw new ChromeLaunchError('CHROME_VERSION_ENDPOINT_INVALID', 'Endpoint /json/version não retornou Browser válido', { binary });
    if (typeof version.webSocketDebuggerUrl !== 'string' || !version.webSocketDebuggerUrl.startsWith('ws://')) throw new ChromeLaunchError('CHROME_CDP_WEBSOCKET_MISSING', 'Endpoint /json/version não retornou WebSocket CDP', { binary });
    return version;
  } finally {
    clearTimeout(timer);
  }
}

export async function launchChrome(options = {}) {
  const timeoutMs = options.timeoutMs ?? Number(process.env.PORTAL_CHROME_STARTUP_TIMEOUT_MS || 25000);
  const pollMs = options.pollMs ?? 100;
  const bin = options.binary ?? await findChrome();
  await validateChromeBinary(bin);
  const dir = await mkdtemp(path.join(os.tmpdir(), 'portal-performance-'));
  const stderrChunks = [];
  let child;
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(2000)]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await rm(dir, { recursive: true, force: true });
  };
  try {
    child = spawn(bin, [
      '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run',
      '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking',
      '--disable-component-update', '--metrics-recording-only', '--disable-default-apps', 'about:blank'
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr?.on('data', chunk => {
      stderrChunks.push(String(chunk));
      while (stderrChunks.join('').length > 2400) stderrChunks.shift();
    });
    const { port, waitedMs } = await waitForDevToolsPort({ child, dir, binary: bin, timeoutMs, pollMs, stderrChunks });
    const version = await readChromeVersion(port, { binary: bin });
    return { child, dir, port, waitedMs, version: version.Browser, webSocketDebuggerUrl: version.webSocketDebuggerUrl, close };
  } catch (error) {
    await close();
    throw error;
  }
}

export class CDP {
  constructor(url) {
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
    this.ws = new WebSocket(url);
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error('Falha ao abrir WebSocket CDP'));
    });
    this.ws.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (pending) message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
        return;
      }
      const handlers = [...(this.listeners.get(message.method) || [])];
      for (const handler of handlers) {
        Promise.resolve().then(() => handler(message.params)).catch(error => this.emitHandlerError(message.method, error));
      }
    };
    this.ws.onclose = () => this.rejectPending(new Error('Conexão CDP fechada'));
  }
  emitHandlerError(method, error) {
    for (const handler of this.listeners.get('CDP.handlerError') || []) handler({ method, error });
  }
  async send(method, params = {}) {
    if (this.closed) throw new Error(`CDP fechado antes de enviar ${method}`);
    await this.ready;
    if (this.closed) throw new Error(`CDP fechado antes de enviar ${method}`);
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, handler) {
    const set = this.listeners.get(method) || new Set();
    set.add(handler);
    this.listeners.set(method, set);
    return () => set.delete(handler);
  }
  listenerCount(method) { return (this.listeners.get(method) || new Set()).size; }
  rejectPending(error) {
    for (const { reject } of this.pending.values()) reject(error);
    this.pending.clear();
  }
  close() {
    if (this.closed) return;
    this.closed = true;
    this.rejectPending(new Error('Conexão CDP fechada'));
    this.listeners.clear();
    try { this.ws.close(); } catch {}
  }
}

export async function createPageTarget(debugPort, { timeoutMs = 5000 } = {}) {
  const target = await fetchJsonWithTimeout(`http://127.0.0.1:${debugPort}/json/new?about:blank`, {
    method: 'PUT', timeoutMs, timeoutCode: 'TARGET_CREATE_TIMEOUT', invalidCode: 'TARGET_CREATE_INVALID', failedCode: 'TARGET_CREATE_INVALID'
  });
  if (!target || typeof target.id !== 'string' || typeof target.webSocketDebuggerUrl !== 'string' || !target.webSocketDebuggerUrl.startsWith('ws://')) {
    throw new TargetOperationError('TARGET_CREATE_INVALID', 'Target CDP inválido');
  }
  return target;
}

export async function closePageTarget(debugPort, targetId, { timeoutMs = 5000 } = {}) {
  if (!targetId) return { closed: false, reason: 'missing_target' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/close/${encodeURIComponent(targetId)}`, { signal: controller.signal });
    if (!response.ok) throw new TargetOperationError('TARGET_CLOSE_FAILED', `Fechamento do target CDP retornou HTTP ${response.status}`, { status: response.status });
    return { closed: true };
  } catch (error) {
    if (error?.name === 'AbortError') throw new TargetOperationError('TARGET_CLOSE_TIMEOUT', `Fechamento do target CDP excedeu ${timeoutMs} ms`, { timeoutMs });
    if (error instanceof TargetOperationError) throw error;
    throw new TargetOperationError('TARGET_CLOSE_FAILED', 'Falha ao fechar target CDP', { causeMessage: error.message });
  } finally {
    clearTimeout(timer);
  }
}

export async function pageSocket(debugPort, options = {}) {
  const target = await createPageTarget(debugPort, options);
  const cdp = new CDP(target.webSocketDebuggerUrl);
  cdp.targetId = target.id;
  cdp.closeTargetError = null;
  cdp.closeTarget = async ({ throwOnError = false } = {}) => {
    cdp.close();
    try { return await closePageTarget(debugPort, target.id, options); }
    catch (error) { cdp.closeTargetError = error; if (throwOnError) throw error; return { closed: false, error }; }
  };
  return cdp;
}
