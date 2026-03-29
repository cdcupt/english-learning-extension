import type { Settings } from "./types";
import { getSettings } from "./storage";
import { encryptConfig, decryptConfig } from "./crypto";

export type ConfigMode = "share" | "backup";

interface ConfigExport {
  version: 1;
  mode: ConfigMode;
  createdAt: string;
  salt: string;
  iv: string;
  ciphertext: string;
}

const SENSITIVE_TOP_KEYS: (keyof Settings)[] = [
  "nytApiKey",
  "claudeApiKey",
  "ttsApiKey",
  "bytedanceAppId",
  "bytedanceToken",
];

function stripSensitiveFields(settings: Settings): Partial<Settings> {
  const stripped: Record<string, unknown> = { ...settings };
  for (const key of SENSITIVE_TOP_KEYS) {
    stripped[key] = "";
  }
  // Strip nested aiProvider.apiKey but keep provider + model
  if (settings.aiProvider) {
    stripped.aiProvider = {
      provider: settings.aiProvider.provider,
      apiKey: "",
      model: settings.aiProvider.model,
    };
  }
  return stripped as Partial<Settings>;
}

export async function exportConfig(
  mode: ConfigMode,
  password: string
): Promise<Blob> {
  const settings = await getSettings();
  if (!settings) throw new Error("No settings found");

  const payload =
    mode === "share" ? stripSensitiveFields(settings) : settings;
  const plaintext = JSON.stringify(payload);
  const { salt, iv, ciphertext } = await encryptConfig(plaintext, password);

  const envelope: ConfigExport = {
    version: 1,
    mode,
    createdAt: new Date().toISOString(),
    salt,
    iv,
    ciphertext,
  };

  return new Blob([JSON.stringify(envelope, null, 2)], {
    type: "application/json",
  });
}

export async function importConfig(
  file: File,
  password: string
): Promise<{ settings: Partial<Settings>; mode: ConfigMode }> {
  const text = await file.text();
  let envelope: ConfigExport;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error("Invalid file format");
  }

  if (
    envelope.version !== 1 ||
    !["share", "backup"].includes(envelope.mode) ||
    !envelope.salt ||
    !envelope.iv ||
    !envelope.ciphertext
  ) {
    throw new Error("Invalid or unsupported config file");
  }

  const plaintext = await decryptConfig(
    envelope.salt,
    envelope.iv,
    envelope.ciphertext,
    password
  );

  let settings: Partial<Settings>;
  try {
    settings = JSON.parse(plaintext);
  } catch {
    throw new Error("Decrypted data is not valid JSON");
  }

  return { settings, mode: envelope.mode };
}

export function mergeSettings(
  existing: Settings,
  imported: Partial<Settings>,
  mode: ConfigMode
): Settings {
  if (mode === "backup") {
    // Overwrite everything except installedDate
    return { ...existing, ...imported, installedDate: existing.installedDate };
  }

  // Share mode: keep all sensitive fields from existing, merge the rest
  const merged = { ...existing, ...imported };
  for (const key of SENSITIVE_TOP_KEYS) {
    (merged as Record<string, unknown>)[key] =
      existing[key as keyof Settings] ?? "";
  }
  // Preserve existing aiProvider.apiKey
  if (existing.aiProvider) {
    merged.aiProvider = {
      ...merged.aiProvider!,
      apiKey: existing.aiProvider.apiKey,
    };
  }
  merged.installedDate = existing.installedDate;
  return merged as Settings;
}
