import type { gmail_v1 } from "googleapis";
import { createGmailClient } from "./auth.js";

const gmail = createGmailClient();

export const toolDeclarations = [
  {
    name: "list_messages",
    description:
      "Search Gmail messages and return metadata only (id, from, subject, snippet, date) — does NOT include the body. Use Gmail's standard search query syntax: 'is:unread', 'from:user@example.com', 'newer_than:1d', 'subject:foo', 'has:attachment', 'label:important', 'category:promotions'. Combine with spaces (AND) or 'OR'.",
    parameters: {
      type: "OBJECT",
      properties: {
        query: {
          type: "STRING",
          description:
            "Gmail search query, e.g. 'is:unread newer_than:2d' or 'from:billing@stripe.com'.",
        },
        maxResults: {
          type: "NUMBER",
          description: "Max messages to return (1-50). Default 10.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_message",
    description:
      "Get full details (subject, from, to, date, plain-text body) of a single Gmail message by ID. Call this after list_messages to read interesting messages in detail. Body is truncated to ~3000 characters.",
    parameters: {
      type: "OBJECT",
      properties: {
        id: {
          type: "STRING",
          description: "Gmail message ID (from a list_messages result).",
        },
      },
      required: ["id"],
    },
  },
];

async function listMessages(args: { query: string; maxResults?: number }) {
  const max = Math.min(Math.max(args.maxResults ?? 10, 1), 50);
  const listResp = await gmail.users.messages.list({
    userId: "me",
    q: args.query,
    maxResults: max,
  });
  const messages = listResp.data.messages ?? [];
  if (messages.length === 0) {
    return { results: [], message: `검색 결과 없음: ${args.query}` };
  }
  const results = await Promise.all(
    messages.map(async (m) => {
      const r = await gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const headers = r.data.payload?.headers ?? [];
      const headerVal = (n: string) =>
        headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ??
        "";
      return {
        id: r.data.id,
        from: headerVal("From"),
        subject: headerVal("Subject"),
        date: headerVal("Date"),
        snippet: r.data.snippet ?? "",
      };
    })
  );
  return { results };
}

function decodeBase64Url(s: string): string {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
    "utf-8"
  );
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    const plain = payload.parts.find(
      (p) => p.mimeType === "text/plain" && p.body?.data
    );
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);
    for (const p of payload.parts) {
      const found = extractBody(p);
      if (found) return found;
    }
  }
  if (payload.mimeType === "text/html" && payload.body?.data) {
    const html = decodeBase64Url(payload.body.data);
    return html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

async function getMessage(args: { id: string }) {
  const r = await gmail.users.messages.get({
    userId: "me",
    id: args.id,
    format: "full",
  });
  const headers = r.data.payload?.headers ?? [];
  const headerVal = (n: string) =>
    headers.find((h) => h.name?.toLowerCase() === n.toLowerCase())?.value ?? "";
  const body = extractBody(r.data.payload).trim();
  const truncated =
    body.length > 3000 ? body.slice(0, 3000) + "\n...(truncated)" : body;
  return {
    id: r.data.id,
    from: headerVal("From"),
    to: headerVal("To"),
    subject: headerVal("Subject"),
    date: headerVal("Date"),
    body: truncated,
  };
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    switch (name) {
      case "list_messages":
        return await listMessages(args as { query: string; maxResults?: number });
      case "get_message":
        return await getMessage(args as { id: string });
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: `Tool error: ${(e as Error).message}` };
  }
}
