import fs from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";

export class SettingsStore {
  constructor() {
    this.filePath = path.join(app.getPath("userData"), "settings.json");
  }

  #read() {
    try {
      return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
    } catch {
      return {};
    }
  }

  #write(value) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(value, null, 2), {
      mode: 0o600
    });
  }

  getPublicSettings() {
    const settings = this.#read();
    return {
      hasAPIKey: Boolean(settings.encryptedAPIKey),
      model: settings.model || "gpt-5.6-sol",
      reasoningEffort: settings.reasoningEffort || "low"
    };
  }

  getAPIKey() {
    const settings = this.#read();
    if (!settings.encryptedAPIKey) return "";
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("macOS secure storage is not available.");
    }
    return safeStorage.decryptString(
      Buffer.from(settings.encryptedAPIKey, "base64")
    );
  }

  save({ apiKey, model, reasoningEffort }) {
    const settings = this.#read();
    if (typeof apiKey === "string" && apiKey.trim()) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error("macOS secure storage is not available.");
      }
      settings.encryptedAPIKey = safeStorage
        .encryptString(apiKey.trim())
        .toString("base64");
    }
    if (apiKey === "") delete settings.encryptedAPIKey;
    if (model) settings.model = model;
    if (reasoningEffort) settings.reasoningEffort = reasoningEffort;
    this.#write(settings);
    return this.getPublicSettings();
  }
}
