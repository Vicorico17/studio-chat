const MUTATING_COMMANDS = new Set([
  "arm",
  "arm_only",
  "bounce",
  "bounce_in_place",
  "cleanup_apply",
  "close",
  "create_audio",
  "create_drummer",
  "create_external_midi",
  "create_instrument",
  "create_marker",
  "delete",
  "duplicate",
  "export_run",
  "export_resume",
  "insert_plugin",
  "insert_verified",
  "mute",
  "new",
  "normalize",
  "open",
  "quit",
  "record",
  "record_sequence",
  "rename",
  "save",
  "save_as",
  "set_automation",
  "set_instrument",
  "set_master_volume",
  "set_pan",
  "set_plugin_param",
  "set_param_verified",
  "set_volume",
  "solo"
]);

const HIGH_RISK_COMMANDS = new Set([
  "bounce",
  "cleanup_apply",
  "close",
  "delete",
  "export_run",
  "export_resume",
  "new",
  "open",
  "quit",
  "record",
  "record_sequence",
  "save_as"
]);

export function commandFromArguments(args = {}) {
  return typeof args.command === "string" ? args.command : "";
}

export function requiresApproval(toolName, args = {}) {
  const command = commandFromArguments(args);
  if (HIGH_RISK_COMMANDS.has(command)) return true;
  if (toolName === "logic_edit" && command === "delete") return true;
  return false;
}

export function mutatesProject(toolName, args = {}) {
  const command = commandFromArguments(args);
  if (MUTATING_COMMANDS.has(command)) return true;
  return ["logic_edit", "logic_mixer", "logic_plugins"].includes(toolName);
}

export function approvalSummary(toolName, args = {}) {
  const command = commandFromArguments(args) || "run";
  const params = args.params && typeof args.params === "object" ? args.params : {};
  const target =
    Number.isInteger(params.index) ? ` on track ${params.index + 1}` : "";
  return `${command.replaceAll("_", " ")}${target} using ${toolName}`;
}

export function mcpToolsToOpenAITools(tools = []) {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description || `Run ${tool.name} in Logic Pro.`,
    parameters: tool.inputSchema || {
      type: "object",
      properties: {},
      additionalProperties: true
    }
  }));
}

export function extractOutputText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }

  return (response?.output || [])
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function toolResultText(result) {
  if (!result) return "No result returned.";
  const textBlocks = (result.content || [])
    .filter((item) => item.type === "text")
    .map((item) => item.text);
  if (textBlocks.length) return textBlocks.join("\n");
  return JSON.stringify(result.structuredContent ?? result);
}

export function createdTrackIndex(result) {
  const payloads = [result?.structuredContent];
  for (const item of result?.content || []) {
    if (item?.type !== "text" || typeof item.text !== "string") continue;
    try {
      payloads.push(JSON.parse(item.text));
    } catch {
      // Some MCP servers return a human-readable prefix before their JSON.
      const json = item.text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) continue;
      try { payloads.push(JSON.parse(json)); } catch { /* Ignore non-JSON text. */ }
    }
  }

  for (const payload of payloads) {
    if (!payload || typeof payload !== "object") continue;
    const candidates = [
      payload.created_track_index,
      payload.target_track_index,
      payload.track_index,
      payload.created_track?.index,
      payload.track?.index
    ];
    const index = candidates.find((value) => Number.isInteger(value) && value >= 0);
    if (index !== undefined) return index;
  }
  return null;
}
