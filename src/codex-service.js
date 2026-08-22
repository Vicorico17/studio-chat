import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PLECAT_CONTEXT } from "./plecat-context.js";

const MAX_RUN_MS = 5 * 60 * 1000;

function codexCommand() {
  const local = path.join(os.homedir(), ".local", "bin", "codex");
  return fs.existsSync(local) ? local : "codex";
}

export class CodexService {
  constructor({ cwd }) {
    this.cwd = cwd;
    this.threadId = null;
  }

  resetConversation() {
    this.threadId = null;
  }

  async sendMessage(message, onActivity = () => {}) {
    if (typeof message !== "string" || !message.trim()) {
      throw new Error("Enter a message for Codex.");
    }

    onActivity(this.threadId ? "Continuing Codex chat" : "Starting Codex chat");
    const args = this.threadId
      ? ["exec", "resume", "--json", "--skip-git-repo-check", "-C", this.cwd, this.threadId, "-"]
      : ["exec", "--json", "--skip-git-repo-check", "-C", this.cwd, "-"];
    const prompt = this.threadId
      ? message
      : `You are the studio-chat studio guide for Logic Pro and the Plecat Mood single/album creation workspace.

Use the following canonical creative brief as persistent project context. Keep the album at the center, connect sonic choices to visuals, narrative, and rollout, and use Logic tools for live-session actions. Never claim a Logic action succeeded without tool confirmation.

${PLECAT_CONTEXT}

User request:
${message}`;
    const result = await this.#run(args, prompt);
    if (result.threadId) this.threadId = result.threadId;
    return { text: result.text, responseId: this.threadId };
  }

  #run(args, message) {
    return new Promise((resolve, reject) => {
      fs.mkdirSync(this.cwd, { recursive: true });
      const child = spawn(codexCommand(), args, {
        cwd: this.cwd,
        env: { ...process.env, PATH: `${path.dirname(codexCommand())}:${process.env.PATH || ""}` },
        stdio: ["pipe", "pipe", "pipe"]
      });
      let stdout = "";
      let stderr = "";
      let threadId = null;
      let finalText = "";
      const timer = setTimeout(() => child.kill("SIGTERM"), MAX_RUN_MS);

      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        let newline;
        while ((newline = stdout.indexOf("\n")) !== -1) {
          const line = stdout.slice(0, newline).trim();
          stdout = stdout.slice(newline + 1);
          try {
            const event = JSON.parse(line);
            if (event.type === "thread.started") threadId = event.thread_id;
            if (event.type === "item.completed" && event.item?.type === "agent_message") {
              finalText = event.item.text || finalText;
            }
          } catch {
            // Codex may write diagnostics to stdout before JSONL events.
          }
        }
      });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`Could not start Codex: ${error.message}`));
      });
      child.once("close", (code, signal) => {
        clearTimeout(timer);
        if (code === 0 && finalText) return resolve({ threadId, text: finalText });
        const detail = stderr.split("\n").find((line) => line.trim()) || "Codex returned no answer.";
        reject(new Error(signal ? `Codex stopped (${signal}).` : `Codex failed: ${detail}`));
      });
      child.stdin.end(message.trim());
    });
  }
}
