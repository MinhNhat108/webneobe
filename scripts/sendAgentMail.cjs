const fs = require('fs');
const net = require('net');
const crypto = require('crypto');

const bridgePath = 'C:\\Users\\nhatm\\.agentsroom\\browser-bridge.json';
const bridge = JSON.parse(fs.readFileSync(bridgePath, 'utf8'));

class SimpleWS {
  constructor(url) {
    const u = new URL(url);
    this.url = u;
    this.socket = null;
    this.connected = false;
    this.handlers = new Map();
    this.buffer = Buffer.alloc(0);
    this._nextId = 1;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const key = crypto.randomBytes(16).toString('base64');
      const host = this.url.hostname;
      const port = this.url.port || 80;
      const wsPath = this.url.pathname + (this.url.search || '');
      this.socket = net.connect(Number(port), host, () => {
        this.socket.write(
          `GET ${wsPath} HTTP/1.1\r\nHost: ${host}:${port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`,
        );
      });
      let handshakeParsed = false;
      this.socket.on('data', (chunk) => {
        this.buffer = Buffer.concat([this.buffer, chunk]);
        if (!handshakeParsed) {
          const sep = this.buffer.indexOf('\r\n\r\n');
          if (sep === -1) return;
          const headers = this.buffer.slice(0, sep).toString('utf-8');
          this.buffer = this.buffer.slice(sep + 4);
          if (!/HTTP\/1\.1 101/i.test(headers)) {
            reject(new Error('websocket handshake failed: ' + headers.split('\r\n')[0]));
            return;
          }
          handshakeParsed = true;
          this.connected = true;
          resolve();
        }
        if (handshakeParsed) this._consumeFrames();
      });
      this.socket.on('error', (err) => {
        this.connected = false;
        if (!handshakeParsed) reject(err);
      });
      this.socket.on('close', () => {
        this.connected = false;
        for (const { reject: rj } of this.handlers.values()) rj(new Error('websocket closed'));
        this.handlers.clear();
      });
    });
  }
  _consumeFrames() {
    while (this.buffer.length >= 2) {
      const fin = (this.buffer[0] & 0x80) !== 0;
      const opcode = this.buffer[0] & 0x0f;
      let payloadLen = this.buffer[1] & 0x7f;
      let offset = 2;
      if (payloadLen === 126) {
        if (this.buffer.length < 4) return;
        payloadLen = this.buffer.readUInt16BE(2); offset = 4;
      } else if (payloadLen === 127) {
        if (this.buffer.length < 10) return;
        payloadLen = Number(this.buffer.readBigUInt64BE(2)); offset = 10;
      }
      if (this.buffer.length < offset + payloadLen) return;
      const payload = this.buffer.slice(offset, offset + payloadLen);
      this.buffer = this.buffer.slice(offset + payloadLen);
      if (opcode === 0x8) { try { this.socket.end(); } catch (_) {} return; }
      if (opcode === 0x9) { this._sendFrame(0xa, payload); continue; }
      if (opcode === 0x1 && fin) {
        const text = payload.toString('utf-8');
        let parsed = null;
        try { parsed = JSON.parse(text); } catch (_) { /* ignore */ }
        if (parsed && parsed.id && this.handlers.has(parsed.id)) {
          const { resolve } = this.handlers.get(parsed.id);
          this.handlers.delete(parsed.id);
          resolve(parsed);
        }
      }
    }
  }
  _sendFrame(opcode, payload) {
    const mask = crypto.randomBytes(4);
    const len = payload.length;
    const header = [0x80 | opcode];
    if (len < 126) header.push(0x80 | len);
    else if (len < 65536) header.push(0x80 | 126, (len >> 8) & 0xff, len & 0xff);
    else {
      const hi = Math.floor(len / 0x100000000);
      const lo = len >>> 0;
      header.push(0x80 | 127,
        (hi >> 24) & 0xff, (hi >> 16) & 0xff, (hi >> 8) & 0xff, hi & 0xff,
        (lo >> 24) & 0xff, (lo >> 16) & 0xff, (lo >> 8) & 0xff, lo & 0xff);
    }
    header.push(...mask);
    const masked = Buffer.alloc(len);
    for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4];
    this.socket.write(Buffer.concat([Buffer.from(header), masked]));
  }
  send(req) {
    return new Promise((resolve, reject) => {
      const id = String(this._nextId++);
      this.handlers.set(id, { resolve, reject });
      this._sendFrame(0x1, Buffer.from(JSON.stringify({ ...req, id }), 'utf-8'));
    });
  }
  close() {
    if (this.socket) {
      try { this.socket.end(); } catch (_) {}
    }
  }
}

async function main() {
  const ws = new SimpleWS(`ws://127.0.0.1:${bridge.port}/browser-mcp`);
  await ws.connect();
  console.log('Connected to bridge on port', bridge.port);

  const PROJECT_ID = 'proj-1787149114320-i82f8x';
  const PROJECT_PATH = 'E:\\Out Job\\Chu Giap\\Web tính neo bè';
  const OWN_AGENT_ID = 'agent-1790003586422-vafgmw';

  let body = process.argv[2] || 'Test message';
  const subject = process.argv[3] || 'Task notification';
  if (fs.existsSync(body)) {
    body = fs.readFileSync(body, 'utf8');
  }

  const resp = await ws.send({
    op: 'agentmail:send',
    projectId: PROJECT_ID,
    token: bridge.token,
    params: {
      projectPath: PROJECT_PATH,
      callerAgentId: OWN_AGENT_ID,
      to: 'agent-1790003657040-zw4idc',
      subject: subject,
      body: body,
      priority: 'high'
    }
  });

  console.log('Bridge response:', JSON.stringify(resp));
  ws.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
