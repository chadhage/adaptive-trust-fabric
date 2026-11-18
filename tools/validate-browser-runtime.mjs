import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

class Protocol {
  constructor(socket) {
    this.socket = socket;
    this.next = 0;
    this.pending = new Map();
    this.events = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) { this.events.push(message); return; }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message));
      else pending.resolve(message.result);
    });
    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) {
        clearTimeout(pending.timer);
        pending.reject(new Error('Owned browser connection closed'));
      }
      this.pending.clear();
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.next;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
}

export async function withLocalBrowser({ browser, profile }, action) {
  if (!profile || existsSync(profile)) throw new Error('Supply a new, unused --profile path. Existing/personal browser profiles are never reused.');
  const executable = browser ?? [
    process.env.ATF_BROWSER,
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ].find(candidate => candidate && existsSync(candidate));
  if (!executable || !existsSync(executable)) throw new Error('Installed Edge/Chrome is required; set --browser or ATF_BROWSER. No browser is downloaded.');
  mkdirSync(profile, { recursive: true });
  const child = spawn(executable, [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--remote-debugging-port=0',
    '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`, 'about:blank',
  ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let protocol;
  try {
    const address = await new Promise((resolve, reject) => {
      let stderr = '';
      const timeout = setTimeout(() => reject(new Error(`Owned browser did not become ready: ${stderr.slice(-1000)}`)), 30000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Owned browser exited during startup (${code}): ${stderr.slice(-2000)}`)); });
      child.stderr.on('data', chunk => {
        stderr += chunk;
        const found = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/[^\s]+)/);
        if (found) { clearTimeout(timeout); resolve(found[1]); }
      });
    });
    const socket = new WebSocket(address);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    protocol = new Protocol(socket);
    const { targetId } = await protocol.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await protocol.send('Target.attachToTarget', { targetId, flatten: true });
    const send = (method, params) => protocol.send(method, params, sessionId);
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result.value;
    };
    for (const domain of ['Page', 'Runtime', 'Network', 'Log']) await send(`${domain}.enable`);
    await send('Network.setBlockedURLs', { urls: ['http://*', 'https://*'] });
    await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
    await action({ send, evaluate, events: protocol.events, version: await protocol.send('Browser.getVersion') });
  } finally {
    if (protocol) {
      try { await protocol.send('Browser.close'); } catch { /* Browser may close before acknowledging. */ }
      protocol.socket.close();
    }
    for (let i = 0; i < 30 && child.exitCode === null; i++) await pause(100);
    if (child.exitCode === null && child.pid) child.kill();
    for (let i = 0; i < 20 && child.exitCode === null; i++) await pause(100);
    try { rmSync(profile, { recursive: true, force: true }); } catch { /* A locked, owned profile is safe to remove after browser exit. */ }
  }
}
