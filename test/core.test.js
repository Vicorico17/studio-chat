import test from "node:test";
import assert from "node:assert/strict";
import {
  extractOutputText,
  createdTrackIndex,
  mcpToolsToOpenAITools,
  mutatesProject,
  requiresApproval,
  toolResultText
} from "../src/core.js";

test("maps MCP tools into Responses API function tools", () => {
  const [tool] = mcpToolsToOpenAITools([
    {
      name: "logic_transport",
      description: "Control transport",
      inputSchema: {
        type: "object",
        properties: { command: { type: "string" } }
      }
    }
  ]);
  assert.equal(tool.type, "function");
  assert.equal(tool.name, "logic_transport");
  assert.equal(tool.parameters.type, "object");
});

test("requires approval for higher-risk commands", () => {
  assert.equal(
    requiresApproval("logic_transport", { command: "record" }),
    true
  );
  assert.equal(
    requiresApproval("logic_transport", { command: "stop" }),
    false
  );
  assert.equal(mutatesProject("logic_tracks", { command: "mute" }), true);
});

test("extracts assistant output text", () => {
  const text = extractOutputText({
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: "Logic is stopped." }]
      }
    ]
  });
  assert.equal(text, "Logic is stopped.");
});

test("normalizes MCP text results", () => {
  assert.equal(
    toolResultText({ content: [{ type: "text", text: "verified" }] }),
    "verified"
  );
});

test("finds a newly created track index in an MCP result", () => {
  assert.equal(
    createdTrackIndex({ structuredContent: { created_track: { index: 3 } } }),
    3
  );
  assert.equal(
    createdTrackIndex({ content: [{ type: "text", text: '{"target_track_index": 7}' }] }),
    7
  );
  assert.equal(createdTrackIndex({ content: [{ type: "text", text: "created" }] }), null);
});
