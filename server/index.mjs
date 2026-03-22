import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, ".env.local");

loadEnvFile(envPath);

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENTS = loadAgentsFromEnv();

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (request.method === "OPTIONS") {
    writeCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    writeCorsHeaders(response);
    writeJson(response, 200, {
      ok: true,
      elevenlabsConfigured: Boolean(ELEVENLABS_AGENTS.length > 0 && API_KEY),
      elevenlabsAgents: ELEVENLABS_AGENTS.map(({ id, name, isDefault }) => ({
        id,
        name,
        isDefault,
      })),
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/elevenlabs/agents") {
    writeCorsHeaders(response);
    writeJson(response, 200, {
      agents: ELEVENLABS_AGENTS.map(({ id, name, isDefault }) => ({
        id,
        name,
        isDefault,
      })),
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/elevenlabs/conversation-token") {
    writeCorsHeaders(response);

    if (ELEVENLABS_AGENTS.length === 0 || !API_KEY) {
      writeJson(response, 500, {
        error: "Missing ElevenLabs agent configuration or ELEVENLABS_API_KEY in server/.env.local",
      });
      return;
    }

    try {
      const body = await readJsonBody(request);
      const selectedAgentId = typeof body?.agentId === "string" ? body.agentId : null;
      const selectedAgent =
        ELEVENLABS_AGENTS.find((agent) => agent.id === selectedAgentId) || ELEVENLABS_AGENTS[0];

      const upstream = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(selectedAgent.id)}`,
        {
          method: "GET",
          headers: {
            "xi-api-key": API_KEY,
          },
        },
      );

      const payload = await upstream.json();

      if (!upstream.ok) {
        writeJson(response, upstream.status, {
          error: payload?.detail?.message || payload?.detail || payload?.message || "Failed to create ElevenLabs conversation token",
        });
        return;
      }

      writeJson(response, 200, {
        token: payload?.token,
        agent: {
          id: selectedAgent.id,
          name: selectedAgent.name,
        },
      });
    } catch (error) {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : "Unexpected server error",
      });
    }

    return;
  }

  writeCorsHeaders(response);
  writeJson(response, 404, { error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`CapableCare server listening on http://${HOST}:${PORT}`);
});

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function writeCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function loadAgentsFromEnv() {
  const configuredAgents = [];
  const rawAgentList = process.env.ELEVENLABS_AGENTS;

  if (rawAgentList) {
    for (const entry of rawAgentList.split(",")) {
      const trimmedEntry = entry.trim();
      if (!trimmedEntry) {
        continue;
      }

      const separatorIndex = trimmedEntry.indexOf(":");
      if (separatorIndex === -1) {
        continue;
      }

      const name = trimmedEntry.slice(0, separatorIndex).trim();
      const id = trimmedEntry.slice(separatorIndex + 1).trim();
      if (!name || !id) {
        continue;
      }

      configuredAgents.push({ id, name, isDefault: false });
    }
  }

  if (configuredAgents.length === 0 && process.env.ELEVENLABS_AGENT_ID) {
    configuredAgents.push({
      id: process.env.ELEVENLABS_AGENT_ID,
      name: process.env.ELEVENLABS_AGENT_NAME || "Default voice agent",
      isDefault: false,
    });
  }

  const defaultAgentId = process.env.ELEVENLABS_DEFAULT_AGENT_ID;
  const dedupedAgents = [];
  const seenIds = new Set();

  for (const agent of configuredAgents) {
    if (seenIds.has(agent.id)) {
      continue;
    }
    seenIds.add(agent.id);
    dedupedAgents.push({
      ...agent,
      isDefault: defaultAgentId ? agent.id === defaultAgentId : dedupedAgents.length === 0,
    });
  }

  if (!defaultAgentId && dedupedAgents[0]) {
    dedupedAgents[0].isDefault = true;
  }

  return dedupedAgents.sort((left, right) => {
    if (left.isDefault === right.isDefault) {
      return left.name.localeCompare(right.name);
    }
    return left.isDefault ? -1 : 1;
  });
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return null;
  }

  const rawBody = Buffer.concat(chunks).toString("utf8").trim();
  if (!rawBody) {
    return null;
  }

  return JSON.parse(rawBody);
}
