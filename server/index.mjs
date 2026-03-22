import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, ".env.local");
const frontendEnvPath = path.join(__dirname, "../frontend/.env");
const frontendLocalEnvPath = path.join(__dirname, "../frontend/.env.local");
const appGuidePath = path.join(__dirname, "../docs/capablecare-community-guide.md");

loadEnvFile(envPath);
loadEnvFile(frontendEnvPath);
loadEnvFile(frontendLocalEnvPath);

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || "127.0.0.1";
const API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_AGENTS = loadAgentsFromEnv();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || "gemini-2.5-flash";
const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const knowledgeChunks = loadKnowledgeChunks();
const embeddingCache = new Map();
let knowledgeEmbeddingsPromise = null;

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

  if (request.method === "POST" && url.pathname === "/api/chat") {
    writeCorsHeaders(response);

    if (!GEMINI_API_KEY) {
      writeJson(response, 500, {
        error: "Missing GEMINI_API_KEY in server/.env.local",
      });
      return;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      writeJson(response, 500, {
        error: "Missing Supabase URL or anon key configuration for retrieval",
      });
      return;
    }

    try {
      const body = await readJsonBody(request);
      const accessToken = typeof body?.accessToken === "string" ? body.accessToken.trim() : "";
      const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
      const messages = rawMessages
        .filter(
          (entry) =>
            entry &&
            (entry.role === "user" || entry.role === "assistant") &&
            typeof entry.text === "string" &&
            entry.text.trim(),
        )
        .map((entry) => ({
          role: entry.role,
          text: entry.text.trim(),
        }));

      if (!accessToken) {
        writeJson(response, 401, { error: "Missing Supabase access token" });
        return;
      }

      if (messages.length === 0) {
        writeJson(response, 400, { error: "At least one chat message is required" });
        return;
      }

      const context = await loadCareContext(accessToken);
      const knowledgeMatches = await retrieveKnowledgeMatches(accessToken, context, messages);
      const reply = await generateGroundedReply(messages, context, knowledgeMatches);
      const citations = buildCitations(context, knowledgeMatches);

      writeJson(response, 200, {
        reply,
        citations,
        contextSummary: {
          clientName: context.client?.full_name || null,
          profileRole: context.profile?.role || null,
        },
      });
    } catch (error) {
      writeJson(response, 500, {
        error: error instanceof Error ? error.message : "Unexpected chat server error",
      });
    }

    return;
  }

  writeCorsHeaders(response);
  writeJson(response, 404, { error: "Not found" });
});

server.on("error", (error) => {
  if (!(error instanceof Error)) {
    console.error("CapableCare server failed to start:", error);
    process.exit(1);
  }

  const details =
    "code" in error && typeof error.code === "string"
      ? ` (${error.code})`
      : "";

  if ("port" in error && "address" in error) {
    console.error(
      `CapableCare server failed to bind to http://${HOST}:${PORT}${details}. ` +
        "Set HOST and PORT in server/.env.local to an available address.",
    );
    process.exit(1);
  }

  console.error(`CapableCare server failed to start${details}: ${error.message}`);
  process.exit(1);
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

async function loadCareContext(accessToken) {
  const authUser = await supabaseAuthRequest("/auth/v1/user", accessToken);
  const profile = await selectSingle(
    "profiles",
    "id,role,name,phone",
    `id=eq.${authUser.id}`,
    accessToken,
  );

  const client =
    profile.role === "customer"
      ? await fetchCustomerClient(accessToken, authUser.id)
      : await selectSingle(
          "elderly_clients",
          [
            "id",
            "full_name",
            "dob",
            "address",
            "health_conditions",
            "medications",
            "special_instructions",
            "transportation_flag",
            "assigned_caretaker_id",
            "assigned_since",
            "emergency_contacts",
          ].join(","),
          `assigned_caretaker_id=eq.${authUser.id}&order=created_at.asc&limit=1`,
          accessToken,
          true,
        );

  if (!client) {
    return {
      profile,
      client: null,
      carePlan: null,
      weeklyBrief: null,
      alerts: [],
      incidents: [],
      visitLogs: [],
      tasks: [],
      appointments: [],
      transportRequests: [],
      familyMembers: [],
    };
  }

  const clientFilter = `elderly_client_id=eq.${client.id}`;
  const [carePlan, weeklyBrief, alerts, incidents, visitLogs, tasks, appointments, transportRequests, familyMembers] =
    await Promise.all([
      selectSingle(
        "care_plans",
        "elderly_client_id,goals,routines,restrictions,medication_schedule,escalation_preferences,updated_at",
        clientFilter,
        accessToken,
        true,
      ),
      selectSingle(
        "weekly_briefs",
        "id,summary,concerns,next_steps,generated_at",
        `${clientFilter}&order=generated_at.desc&limit=1`,
        accessToken,
        true,
      ),
      selectMany(
        "alerts",
        "id,type,severity,summary,status,triggered_at",
        `${clientFilter}&status=in.(Open,Monitoring)&order=triggered_at.desc&limit=5`,
        accessToken,
      ),
      selectMany(
        "incident_reports",
        "id,severity,summary,actions_taken,acknowledged_by_family_at,created_at",
        `${clientFilter}&order=created_at.desc&limit=5`,
        accessToken,
      ),
      selectMany(
        "visit_logs",
        [
          "id",
          "created_at",
          "visit_type",
          "status",
          "notes",
          "emergency_flag",
          "incident_flag",
          "checked_in_at",
          "checked_out_at",
          "checklist_completed",
          "checklist_items",
        ].join(","),
        `${clientFilter}&order=created_at.desc&limit=5`,
        accessToken,
      ),
      selectMany(
        "tasks",
        "id,title,description,task_type,assigned_to,priority,status,due_date",
        `${clientFilter}&status=in.(Submitted,In Progress)&order=due_date.asc&limit=6`,
        accessToken,
      ),
      selectMany(
        "appointments",
        "id,title,provider,scheduled_for,status,transport_needed",
        `${clientFilter}&order=scheduled_for.asc&limit=6`,
        accessToken,
      ),
      selectMany(
        "transport_requests",
        "id,pickup_location,dropoff_location,scheduled_for,status,coordination_notes",
        `${clientFilter}&status=in.(Requested,Scheduled)&order=scheduled_for.asc&limit=6`,
        accessToken,
      ),
      selectMany(
        "family_members",
        "id,name,relationship,email,permissions,ownership_label",
        `${clientFilter}&order=created_at.asc&limit=6`,
        accessToken,
      ),
    ]);

  return {
    profile,
    client,
    carePlan,
    weeklyBrief,
    alerts,
    incidents,
    visitLogs,
    tasks,
    appointments,
    transportRequests,
    familyMembers,
  };
}

async function generateGroundedReply(messages, context, knowledgeMatches) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                "You are ECareAI for CapableCare. " +
                "Use the retrieved care context for client-specific claims. " +
                "Do not invent care-plan details, medications, incidents, appointments, or risks. " +
                "If the retrieved context is missing something, say that directly. " +
                "Prefer specific, practical answers over generic advice. " +
                "Keep answers concise and grounded in the available records.",
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text:
                  "Retrieved care context:\n" +
                  JSON.stringify(buildPromptContext(context), null, 2) +
                  "\n\nRetrieved app knowledge chunks:\n" +
                  JSON.stringify(
                    knowledgeMatches.map((match) => ({
                      title: match.title,
                      text: match.text,
                    })),
                    null,
                    2,
                  ),
              },
            ],
          },
          ...messages.map((message) => ({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text: message.text }],
          })),
        ],
      }),
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Gemini request failed");
  }

  const text = payload?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();

  if (!text) {
    throw new Error("Gemini returned an empty response");
  }

  return text;
}

function buildPromptContext(context) {
  if (!context.client) {
    return {
      profile: context.profile,
      note: "No linked elderly client is available for this signed-in user.",
    };
  }

  return {
    profile: {
      role: context.profile.role,
      name: context.profile.name,
    },
    client: {
      full_name: context.client.full_name,
      dob: context.client.dob,
      address: context.client.address,
      health_conditions: context.client.health_conditions || [],
      medications: context.client.medications || [],
      special_instructions: context.client.special_instructions || "",
      transportation_flag: Boolean(context.client.transportation_flag),
      assigned_since: context.client.assigned_since || null,
      emergency_contacts: context.client.emergency_contacts || [],
    },
    care_plan: context.carePlan,
    latest_weekly_brief: context.weeklyBrief,
    open_alerts: context.alerts,
    recent_incidents: context.incidents,
    recent_visit_logs: context.visitLogs,
    active_tasks: context.tasks,
    upcoming_appointments: context.appointments,
    active_transport_requests: context.transportRequests,
    family_members: context.familyMembers,
  };
}

function buildCitations(context, knowledgeMatches) {
  const citations = [];

  if (!context.client) {
    citations.push({
      id: "no-client",
      label: "No linked care profile",
      detail: "No elderly client record is linked to the signed-in user.",
    });
    return citations;
  }

  if (context.carePlan) {
    citations.push({
      id: `care-plan-${context.client.id}`,
      label: "Care plan",
      detail: `Updated ${formatDate(context.carePlan.updated_at)}.`,
    });
  }

  if (context.weeklyBrief) {
    citations.push({
      id: `weekly-brief-${context.weeklyBrief.id}`,
      label: "Weekly brief",
      detail: `Generated ${formatDate(context.weeklyBrief.generated_at)}.`,
    });
  }

  for (const match of knowledgeMatches) {
    citations.push({
      id: `knowledge-${match.id}`,
      label: `${match.sourceKind === "pdf" ? "PDF" : "Guide"}: ${match.title}`,
      detail: `${match.sourceTitle} retrieved through vector search.`,
    });
  }

  for (const alert of context.alerts.slice(0, 2)) {
    citations.push({
      id: `alert-${alert.id}`,
      label: `${alert.severity} alert: ${alert.type}`,
      detail: `${alert.summary} Triggered ${formatDate(alert.triggered_at)}.`,
    });
  }

  for (const incident of context.incidents.slice(0, 2)) {
    citations.push({
      id: `incident-${incident.id}`,
      label: `${incident.severity} incident`,
      detail: `${incident.summary} Logged ${formatDate(incident.created_at)}.`,
    });
  }

  for (const visitLog of context.visitLogs.slice(0, 2)) {
    citations.push({
      id: `visit-log-${visitLog.id}`,
      label: `${visitLog.visit_type} visit log`,
      detail: `${visitLog.status} on ${formatDate(visitLog.created_at)}.`,
    });
  }

  for (const task of context.tasks.slice(0, 2)) {
    citations.push({
      id: `task-${task.id}`,
      label: `Task: ${task.title}`,
      detail: `${task.status} with due date ${formatDate(task.due_date)}.`,
    });
  }

  for (const appointment of context.appointments.slice(0, 2)) {
    citations.push({
      id: `appointment-${appointment.id}`,
      label: `Appointment: ${appointment.title}`,
      detail: `${appointment.status} for ${formatDate(appointment.scheduled_for)} with ${appointment.provider}.`,
    });
  }

  for (const transportRequest of context.transportRequests.slice(0, 1)) {
    citations.push({
      id: `transport-${transportRequest.id}`,
      label: "Transport request",
      detail: `${transportRequest.status} for ${formatDate(transportRequest.scheduled_for)}.`,
    });
  }

  return citations.slice(0, 8);
}

async function fetchCustomerClient(accessToken, userId) {
  const rows = await selectMany(
    "family_links",
    [
      "relationship",
      "elderly_clients(",
      "id,full_name,dob,address,health_conditions,medications,special_instructions,transportation_flag,assigned_caretaker_id,assigned_since,emergency_contacts",
      ")",
    ].join(""),
    `customer_user_id=eq.${userId}&limit=1`,
    accessToken,
  );

  return rows[0]?.elderly_clients || null;
}

async function selectSingle(table, columns, query, accessToken, allowEmpty = false) {
  const rows = await supabaseRestRequest(
    `/rest/v1/${table}?select=${encodeURIComponent(columns)}&${query}`,
    accessToken,
  );

  if (!Array.isArray(rows) || rows.length === 0) {
    if (allowEmpty) {
      return null;
    }
    throw new Error(`No ${table} record found for the current user`);
  }

  return rows[0];
}

async function selectMany(table, columns, query, accessToken) {
  const rows = await supabaseRestRequest(
    `/rest/v1/${table}?select=${encodeURIComponent(columns)}&${query}`,
    accessToken,
  );

  return Array.isArray(rows) ? rows : [];
}

async function supabaseRestRequest(pathname, accessToken) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Supabase request failed for ${pathname}`);
  }

  return payload;
}

async function supabaseAuthRequest(pathname, accessToken) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.msg || payload?.message || "Unable to validate Supabase session");
  }

  return payload;
}

function loadKnowledgeChunks() {
  if (!existsSync(appGuidePath)) {
    return [];
  }

  const raw = readFileSync(appGuidePath, "utf8").trim();
  if (!raw) {
    return [];
  }

  const sections = raw.split(/\n##\s+/);
  const intro = sections.shift() || "";
  const chunks = [];

  if (intro.trim()) {
    chunks.push({
      id: "guide-intro",
      title: "CapableCare Community Guide",
      text: intro.replace(/^#\s+/m, "").trim(),
    });
  }

  for (const section of sections) {
    const [headingLine, ...bodyLines] = section.split("\n");
    const title = headingLine.trim();
    const text = bodyLines.join("\n").trim();
    if (!title || !text) {
      continue;
    }

    chunks.push({
      id: `guide-${slugify(title)}`,
      title,
      text: `${title}\n\n${text}`,
    });
  }

  return chunks;
}

async function retrieveKnowledgeMatches(accessToken, context, messages) {
  if (!GEMINI_API_KEY) {
    return [];
  }

  const latestUserMessage = [...messages].reverse().find((message) => message.role === "user");
  if (!latestUserMessage?.text) {
    return [];
  }

  try {
    const queryEmbedding = await embedText(latestUserMessage.text, "RETRIEVAL_QUERY");
    const persistentMatches = await retrievePersistentKnowledgeMatches(
      accessToken,
      context.client?.id || null,
      queryEmbedding,
    );

    if (persistentMatches.length > 0) {
      return persistentMatches;
    }

    if (knowledgeChunks.length === 0) {
      return [];
    }

    const fallbackEmbeddings = await getKnowledgeEmbeddings();
    return fallbackEmbeddings
      .map((chunk, index) => ({
        ...knowledgeChunks[index],
        sourceKind: "guide",
        sourceTitle: "CapableCare Community Guide",
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter((entry) => Number.isFinite(entry.score))
      .sort((left, right) => right.score - left.score)
      .slice(0, 3)
      .filter((entry) => entry.score > 0.2);
  } catch (error) {
    console.error("Vector retrieval failed:", error);
    return [];
  }
}

async function retrievePersistentKnowledgeMatches(accessToken, clientId, queryEmbedding) {
  const clientScopeFilter = clientId
    ? `or=(elderly_client_id.is.null,elderly_client_id.eq.${clientId})`
    : "elderly_client_id=is.null";
  const rows = await selectMany(
    "document_chunks",
    "id,source_id,chunk_index,heading,content,embedding,document_sources(title,source_kind,source_scope)",
    `${clientScopeFilter}&order=created_at.desc&limit=200`,
    accessToken,
  );

  return rows
    .map((row) => ({
      id: row.id,
      title:
        row.heading ||
        row.document_sources?.title ||
        "Knowledge chunk",
      text: row.content,
      sourceKind: row.document_sources?.source_kind || "note",
      sourceTitle: row.document_sources?.title || "Knowledge base",
      score: cosineSimilarity(queryEmbedding, parseEmbedding(row.embedding)),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .filter((entry) => entry.score > 0.2);
}

async function getKnowledgeEmbeddings() {
  if (!knowledgeEmbeddingsPromise) {
    knowledgeEmbeddingsPromise = Promise.all(
      knowledgeChunks.map(async (chunk) => ({
        id: chunk.id,
        embedding: await embedText(chunk.text, "RETRIEVAL_DOCUMENT"),
      })),
    );
  }

  return knowledgeEmbeddingsPromise;
}

async function embedText(text, taskType) {
  const cacheKey = `${taskType}:${text}`;
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_EMBEDDING_MODEL)}:embedContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        taskType,
        content: {
          parts: [{ text }],
        },
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Embedding request failed");
  }

  const values = payload?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error("Embedding response was empty");
  }

  embeddingCache.set(cacheKey, values);
  return values;
}

function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return Number.NEGATIVE_INFINITY;
  }

  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm);
  if (!denominator) {
    return Number.NEGATIVE_INFINITY;
  }

  return dot / denominator;
}

function parseEmbedding(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object" && Array.isArray(value.values)) {
    return value.values;
  }

  return [];
}

function formatDate(value) {
  if (!value) {
    return "unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
