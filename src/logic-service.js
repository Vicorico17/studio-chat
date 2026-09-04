import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MCP_BINARY = "/opt/homebrew/bin/LogicProMCP";
const MCP_SHARE_DIR = "/opt/homebrew/opt/logic-pro-mcp/share/logic-pro-mcp";
const CONNECT_TIMEOUT_MS = 15_000;

function withTimeout(promise, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${CONNECT_TIMEOUT_MS / 1000}s`)),
      CONNECT_TIMEOUT_MS
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class LogicService {
  constructor({ binary = MCP_BINARY, shareDirectory = MCP_SHARE_DIR } = {}) {
    this.binary = binary;
    this.shareDirectory = shareDirectory;
    this.client = null;
    this.transport = null;
    this.tools = [];
    this.connectPromise = null;
  }

  get connected() {
    return Boolean(this.client && this.transport);
  }

  async connect() {
    if (this.connected) return this.status();
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = this.#connect();
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async #connect() {
    this.client = new Client(
      { name: "studio-chat", version: "0.1.0" },
      { capabilities: {} }
    );

    this.transport = new StdioClientTransport({
      command: this.binary,
      args: [],
      env: {
        ...process.env,
        LOGIC_PRO_MCP_SHARE_DIR: this.shareDirectory
      },
      stderr: "pipe"
    });

    this.transport.onerror = (error) => {
      console.error("Logic MCP transport error", error);
    };

    try {
      await withTimeout(this.client.connect(this.transport), "LogicProMCP startup");
      const listed = await withTimeout(
        this.client.listTools(),
        "LogicProMCP tool discovery"
      );
      this.tools = listed.tools || [];
      return this.status();
    } catch (error) {
      await this.close();
      const detail = error.message.includes("timed out")
        ? `${error.message}. Open Logic Pro and check Accessibility/Automation permissions, then try again.`
        : error.message;
      throw new Error(`Could not connect to Logic MCP: ${detail}`);
    }
  }

  status() {
    return {
      connected: this.connected,
      toolCount: this.tools.length,
      server: "LogicProMCP",
      binary: this.binary
    };
  }

  async version() {
    try {
      const { stdout } = await execFileAsync(this.binary, ["--version"], { timeout: 5_000 });
      return stdout.trim() || "unknown";
    } catch {
      return "unavailable";
    }
  }

  async listTools() {
    await this.connect();
    if (!this.tools.length) {
      const listed = await this.client.listTools();
      this.tools = listed.tools || [];
    }
    return this.tools;
  }

  async callTool(name, args = {}) {
    await this.connect();
    return this.client.callTool({ name, arguments: args });
  }

  async health() {
    const result = await this.callTool("logic_system", {
      command: "health",
      params: {}
    });
    return result;
  }

  async close() {
    const client = this.client;
    this.client = null;
    this.transport = null;
    this.tools = [];
    if (client) {
      try {
        await client.close();
      } catch {
        // Process shutdown is best-effort during app termination.
      }
    }
  }
}
