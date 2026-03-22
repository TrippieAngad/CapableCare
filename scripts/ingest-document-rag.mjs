#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverEnvPath = path.join(__dirname, "../server/.env.local");
const frontendEnvPath = path.join(__dirname, "../frontend/.env");
const frontendLocalEnvPath = path.join(__dirname, "../frontend/.env.local");

loadEnvFile(serverEnvPath);
loadEnvFile(frontendEnvPath);
loadEnvFile(frontendLocalEnvPath);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const args = parseArgs(process.argv.slice(2));

if (!args.file) {
  fail(
    "Missing --file. Example: node ./CapableCare/scripts/ingest-document-rag.mjs --file ./CapableCare/docs/capablecare-community-guide.md --title \"CapableCare Community Guide\" --scope global --source-kind guide",
  );
}

if (!existsSync(args.file)) {
  fail(`File not found: ${args.file}`);
}

if (!GEMINI_API_KEY) {
  fail("Missing GEMINI_API_KEY in CapableCare/server/.env.local");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  fail("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in CapableCare/server/.env.local");
}

const sourceKind = args["source-kind"] || inferSourceKind(args.file);
const scope = args.scope || "global";
const title = args.title || inferTitle(args.file);
const metadata = parseJsonObject(args.metadata, "--metadata must be valid JSON");

if (!["global", "client"].includes(scope)) {
  fail("--scope must be either global or client");
}

if (scope === "client" && !args["client-id"]) {
  fail("--client-id is required when --scope client");
}

try {
  const rawText = await extractDocumentText(args.file, sourceKind);
  const normalizedText = normalizeWhitespace(rawText);
  if (!normalizedText) {
    fail("The document did not contain extractable text");
  }

  const chunks = chunkText(normalizedText, 1200, 180);
  if (chunks.length === 0) {
    fail("No chunks were generated from the document");
  }

  const embeddings = [];
  for (const chunk of chunks) {
    embeddings.push(await embedText(chunk.content));
  }

  const source = await upsertSource({
    title,
    sourceKind,
    scope,
    clientId: args["client-id"] || null,
    filePath: args.file,
    metadata,
  });

  await deleteExistingChunks(source.id);
  await insertChunks(
    source.id,
    args["client-id"] || null,
    chunks.map((chunk, index) => ({
      chunk_index: index,
      heading: chunk.heading,
      content: chunk.content,
      embedding: embeddings[index],
      token_estimate: estimateTokens(chunk.content),
    })),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        sourceId: source.id,
        title,
        sourceKind,
        scope,
        clientId: args["client-id"] || null,
        chunks: chunks.length,
      },
      null,
      2,
    ),
  );
} catch (error) {
  fail(error instanceof Error ? error.message : "Unexpected ingestion failure");
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

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = next;
    index += 1;
  }

  return parsed;
}

function parseJsonObject(value, message) {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(message);
    }
    return parsed;
  } catch (error) {
    fail(error instanceof Error ? error.message : message);
  }
}

function inferSourceKind(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".pdf") {
    return "pdf";
  }
  if (extension === ".md") {
    return "guide";
  }
  return "note";
}

function inferTitle(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  return base
    .split(/[-_]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function extractDocumentText(filePath, sourceKind) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".md" || extension === ".txt") {
    return readFileSync(filePath, "utf8");
  }

  if (extension !== ".pdf" && sourceKind !== "pdf") {
    return readFileSync(filePath, "utf8");
  }

  try {
    const { stdout } = await execFileAsync("/usr/bin/mdls", [
      "-name",
      "kMDItemTextContent",
      "-raw",
      filePath,
    ]);
    const text = stdout.trim();
    if (text && text !== "(null)") {
      return text;
    }
  } catch (error) {
    console.warn("mdls extraction failed:", error instanceof Error ? error.message : error);
  }

  throw new Error(
    "Unable to extract text from the PDF on this machine. On macOS this script tries Spotlight metadata first. If that fails, export the PDF to text or markdown and ingest that file instead.",
  );
}

function normalizeWhitespace(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text, targetSize, overlap) {
  const sections = text.split(/\n##?\s+/);
  const chunks = [];
  let buffer = "";
  let currentHeading = "Document";

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) {
      continue;
    }

    const lines = trimmed.split("\n");
    const heading = lines[0].length < 120 ? lines[0].trim() : currentHeading;
    const body = lines.slice(1).join("\n").trim() || trimmed;
    currentHeading = heading || currentHeading;

    const paragraphs = body.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
    for (const paragraph of paragraphs) {
      const candidate = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      if (candidate.length <= targetSize) {
        buffer = candidate;
        continue;
      }

      if (buffer) {
        chunks.push({
          heading: currentHeading,
          content: buffer,
        });
      }

      if (paragraph.length <= targetSize) {
        buffer = paragraph;
        continue;
      }

      for (const slice of sliceLongParagraph(paragraph, targetSize, overlap)) {
        chunks.push({
          heading: currentHeading,
          content: slice,
        });
      }
      buffer = "";
    }
  }

  if (buffer) {
    chunks.push({
      heading: currentHeading,
      content: buffer,
    });
  }

  return chunks;
}

function sliceLongParagraph(text, targetSize, overlap) {
  const slices = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + targetSize, text.length);
    if (end < text.length) {
      const breakIndex = text.lastIndexOf(" ", end);
      if (breakIndex > start + Math.floor(targetSize * 0.6)) {
        end = breakIndex;
      }
    }

    slices.push(text.slice(start, end).trim());
    if (end >= text.length) {
      break;
    }
    start = Math.max(end - overlap, start + 1);
  }

  return slices.filter(Boolean);
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

async function embedText(text) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_EMBEDDING_MODEL)}:embedContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: `models/${GEMINI_EMBEDDING_MODEL}`,
        taskType: "RETRIEVAL_DOCUMENT",
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

  return values;
}

async function upsertSource({ title, sourceKind, scope, clientId, filePath, metadata }) {
  const body = {
    title,
    source_kind: sourceKind,
    source_scope: scope,
    elderly_client_id: clientId,
    storage_path: filePath,
    metadata,
  };

  const existing = await supabaseRequest(
    `/rest/v1/document_sources?select=id&title=eq.${encodeURIComponent(title)}&source_scope=eq.${scope}${clientId ? `&elderly_client_id=eq.${clientId}` : "&elderly_client_id=is.null"}&limit=1`,
    {
      method: "GET",
    },
  );

  if (Array.isArray(existing) && existing[0]?.id) {
    const sourceId = existing[0].id;
    await supabaseRequest(`/rest/v1/document_sources?id=eq.${sourceId}`, {
      method: "PATCH",
      body,
      headers: {
        Prefer: "return=representation",
      },
    });
    return { id: sourceId };
  }

  const inserted = await supabaseRequest("/rest/v1/document_sources", {
    method: "POST",
    body,
    headers: {
      Prefer: "return=representation",
    },
  });

  return inserted[0];
}

async function deleteExistingChunks(sourceId) {
  await supabaseRequest(`/rest/v1/document_chunks?source_id=eq.${sourceId}`, {
    method: "DELETE",
    headers: {
      Prefer: "return=minimal",
    },
  });
}

async function insertChunks(sourceId, clientId, chunks) {
  const payload = chunks.map((chunk) => ({
    source_id: sourceId,
    elderly_client_id: clientId,
    chunk_index: chunk.chunk_index,
    heading: chunk.heading,
    content: chunk.content,
    embedding: chunk.embedding,
    token_estimate: chunk.token_estimate,
  }));

  await supabaseRequest("/rest/v1/document_chunks", {
    method: "POST",
    body: payload,
    headers: {
      Prefer: "return=minimal",
    },
  });
}

async function supabaseRequest(pathname, options) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    method: options.method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Supabase request failed for ${pathname}`);
  }

  return payload;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
