import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * The one place the app talks to Claude.
 *
 * - `structured()` returns JSON validated against a Zod schema (recipe
 *   extraction and generation).
 * - `research()` lets Claude search and read the web, returning its notes as
 *   text (restaurant menus).
 *
 * Both use server-side refusal fallbacks, so the rare declined request is
 * retried on another model instead of failing.
 */

export const MODEL = "claude-opus-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class AiUnavailableError extends Error {
  constructor() {
    super("AI features need an ANTHROPIC_API_KEY.");
  }
}

export class AiFailedError extends Error {}

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!aiEnabled()) throw new AiUnavailableError();
  client ??= new Anthropic({ maxRetries: 2, timeout: 5 * 60 * 1000 });
  return client;
}

type Content = Anthropic.Beta.BetaContentBlockParam[] | string;

export async function structured<T extends z.ZodType>(options: {
  system: string;
  content: Content;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: options.maxTokens ?? 16000,
    betas: [FALLBACK_BETA],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: options.effort ?? "medium", format: zodOutputFormat(options.schema) },
    system: options.system,
    messages: [{ role: "user", content: options.content }],
  });
  if (response.stop_reason === "refusal") throw new AiFailedError("Claude couldn't help with that one.");
  if (response.stop_reason === "max_tokens") throw new AiFailedError("That was too long to finish. Try a shorter recipe.");
  if (!response.parsed_output) throw new AiFailedError("Claude's answer didn't come back in the right shape.");
  return response.parsed_output as z.infer<T>;
}

/**
 * Lets Claude use web search and web fetch, and returns its final notes.
 * Handles `pause_turn` (the server's tool loop hitting its iteration cap)
 * by re-sending the conversation so it can pick up where it left off.
 */
export async function research(options: {
  system: string;
  prompt: string;
  maxSearches?: number;
  effort?: "low" | "medium" | "high";
}): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: options.prompt }];
  const sources = new Map<string, string>();
  let text = "";

  for (let round = 0; round < 4; round++) {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: options.effort ?? "medium" },
      system: options.system,
      messages,
      tools: [
        { type: "web_search_20260209", name: "web_search", max_uses: options.maxSearches ?? 6 },
        { type: "web_fetch_20260209", name: "web_fetch", max_uses: 6 },
      ],
    });

    for (const block of response.content) {
      if (block.type === "text") {
        text += block.text;
        for (const citation of block.citations ?? []) {
          if ("url" in citation && citation.url) sources.set(citation.url, citation.title ?? citation.url);
        }
      }
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const result of block.content) {
          if (result.type === "web_search_result") sources.set(result.url, result.title);
        }
      }
    }

    if (response.stop_reason === "refusal") throw new AiFailedError("Claude couldn't research that one.");
    if (response.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: response.content });
    text = "";
  }

  return { text: text.trim(), sources: [...sources.entries()].map(([url, title]) => ({ url, title })) };
}

export function friendlyAiError(error: unknown): string {
  if (error instanceof AiUnavailableError) return "AI isn't set up yet. Add ANTHROPIC_API_KEY to turn it on.";
  if (error instanceof AiFailedError) return error.message;
  if (error instanceof Anthropic.RateLimitError) return "Claude is busy right now. Try again in a minute.";
  if (error instanceof Anthropic.AuthenticationError) return "The Anthropic API key isn't working. Check it in Vercel.";
  if (error instanceof Anthropic.BadRequestError) return "Claude couldn't read that. Try a clearer photo or a different file.";
  if (error instanceof Anthropic.APIError) return "Claude had a hiccup. Try again.";
  return "Something went wrong talking to Claude. Try again.";
}
