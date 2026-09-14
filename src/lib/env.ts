const XTROUTER_MODEL =
  process.env.XTROUTER_MODEL || "deepseek/deepseek-v4-pro";

export const AGENT_MODELS: Record<string, string[]> = {
  pm: [XTROUTER_MODEL],
  designer: [XTROUTER_MODEL],
  frontend: [XTROUTER_MODEL],
  backend: [XTROUTER_MODEL],
  qa: [XTROUTER_MODEL],
};

const XTROUTER_KEY_ENV: Record<string, string> = {
  pm: "XTROUTER_API_KEY_OPTIMUS",
  designer: "XTROUTER_API_KEY_ULTRON",
  frontend: "XTROUTER_API_KEY_VEXTRON",
  backend: "XTROUTER_API_KEY_MEGATRON",
  qa: "XTROUTER_API_KEY_CYBERTRON",
};

export function groqKeyFor(agentId: string): string | undefined {
  const envName = XTROUTER_KEY_ENV[agentId];
  return envName ? process.env[envName] : undefined;
}

export function groqApiKeyA(): string | undefined {
  return process.env.XTROUTER_API_KEY_OPTIMUS;
}

export function groqApiKeyB(): string | undefined {
  return process.env.XTROUTER_API_KEY_ULTRON;
}

export function groqApiKey(): string | undefined {
  return groqApiKeyA();
}

export function groqApiKeyFor(slot: "A" | "B"): string | undefined {
  return slot === "B" ? groqApiKeyB() : groqApiKeyA();
}
