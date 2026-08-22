import OpenAI from "openai";
import {
  approvalSummary,
  extractOutputText,
  mcpToolsToOpenAITools,
  requiresApproval,
  toolResultText
} from "./core.js";
import { PLECAT_CONTEXT } from "./plecat-context.js";

const SYSTEM_PROMPT = `You are studio-chat, a focused Logic Pro assistant and creative director inside a macOS desktop app.

Creative workspace:
- The active project is Plecat Mood, a complete single/album creation world.
- Use the canonical Plecat Mood brief below whenever the user asks about music creation, lyrics, titles, visuals, narrative, branding, tracklists, or launch planning.
- Keep the album at the center and connect sonic decisions to visual, narrative, and rollout decisions.
- When useful, turn an idea into concrete deliverables, decisions, and next actions. Ask at most one focused question when a creative choice is genuinely missing.

Outcome:
- Help the user inspect and control their open Logic Pro session through the provided tools.
- Complete safe, in-scope requests and report the observed result.

Tool rules:
- Use tools when the user asks about live Logic state or requests a Logic action.
- Never claim an action succeeded until the tool result confirms it.
- Prefer read-only inspection before changing an ambiguous track or project.
- Use explicit zero-based track indices exactly as required by the tool schema.
- Keep answers concise and friendly. Mention any unverified or partial result.
- The host app enforces confirmation for higher-risk actions.

Canonical Plecat Mood brief:
${PLECAT_CONTEXT}`;

export class OpenAIService {
  constructor({ logicService, settingsStore, requestApproval }) {
    this.logicService = logicService;
    this.settingsStore = settingsStore;
    this.requestApproval = requestApproval;
    this.previousResponseId = null;
  }

  resetConversation() {
    this.previousResponseId = null;
  }

  async sendMessage(message, onActivity = () => {}) {
    const apiKey = this.settingsStore.getAPIKey();
    if (!apiKey) {
      throw new Error("Add an OpenAI API key in Settings before using chat.");
    }

    const settings = this.settingsStore.getPublicSettings();
    const client = new OpenAI({ apiKey });
    const mcpTools = await this.logicService.listTools();
    const tools = mcpToolsToOpenAITools(mcpTools);

    onActivity("Thinking");
    let response = await client.responses.create({
      model: settings.model,
      reasoning: { effort: settings.reasoningEffort },
      instructions: SYSTEM_PROMPT,
      input: message,
      tools,
      previous_response_id: this.previousResponseId || undefined,
      parallel_tool_calls: false,
      text: { verbosity: "low" }
    });

    for (let turn = 0; turn < 8; turn += 1) {
      const calls = (response.output || []).filter(
        (item) => item.type === "function_call"
      );
      if (!calls.length) {
        this.previousResponseId = response.id;
        return {
          text:
            extractOutputText(response) ||
            "Done. Logic returned no additional message.",
          responseId: response.id
        };
      }

      const outputs = [];
      for (const call of calls) {
        let args = {};
        try {
          args = JSON.parse(call.arguments || "{}");
        } catch {
          outputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: "Invalid tool arguments returned by the model."
          });
          continue;
        }

        onActivity(`Using ${call.name}`);
        if (requiresApproval(call.name, args)) {
          const approved = await this.requestApproval({
            title: "Allow Logic action?",
            summary: approvalSummary(call.name, args),
            toolName: call.name,
            arguments: args
          });
          if (!approved) {
            outputs.push({
              type: "function_call_output",
              call_id: call.call_id,
              output: "The user declined this action."
            });
            continue;
          }
        }

        try {
          const result = await this.logicService.callTool(call.name, args);
          outputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: toolResultText(result)
          });
        } catch (error) {
          outputs.push({
            type: "function_call_output",
            call_id: call.call_id,
            output: `Tool error: ${error.message}`
          });
        }
      }

      onActivity("Checking the result");
      response = await client.responses.create({
        model: settings.model,
        reasoning: { effort: settings.reasoningEffort },
        instructions: SYSTEM_PROMPT,
        input: outputs,
        tools,
        previous_response_id: response.id,
        parallel_tool_calls: false,
        text: { verbosity: "low" }
      });
    }

    throw new Error("The assistant reached the tool-loop safety limit.");
  }
}
