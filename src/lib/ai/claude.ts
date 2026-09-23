import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { AiBudgetError } from "./errors";
import { checkBudget, costCents, recordUsage } from "./usage";

export { AiBudgetError };

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
/** Cheap and quick; plenty for estimates, suggestions and simple recipes. */
export const FAST_MODEL = "claude-haiku-4-5";
/** Web research: capable enough to read menus, much cheaper than Opus. */
export const RESEARCH_MODEL = "claude-sonnet-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

/**
 * "smart" (Opus) reads photos, PDFs and handwriting; "balanced" (Sonnet)
 * handles tidy text at about half the price; "fast" (Haiku, about a tenth
 * of Opus) does everything simpler.
 */
export type Tier = "smart" | "balanced" | "fast";

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
  /** What it's for, for the spending report (e.g. "nutrition") */
  feature: string;
  tier?: Tier;
  system: string;
  content: Content;
  schema: T;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<z.infer<T>> {
  const client = getClient();
  await checkBudget();
  const fast = options.tier === "fast";
  const model = fast ? FAST_MODEL : options.tier === "balanced" ? RESEARCH_MODEL : MODEL;
  const format = zodOutputFormat(options.schema);
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: options.content }];
  // Haiku doesn't take adaptive thinking, effort, or refusal fallbacks.
  const response = fast
    ? await client.beta.messages.parse({
        model,
        max_tokens: Math.min(options.maxTokens ?? 16000, 16000),
        output_config: { format },
        system: options.system,
        messages,
      })
    : await client.beta.messages.parse({
        model,
        max_tokens: options.maxTokens ?? 16000,
        ...(options.tier === "balanced" ? {} : { betas: [FALLBACK_BETA], fallbacks: "default" as const }),
        thinking: { type: "adaptive" },
        output_config: { effort: options.effort ?? "medium", format },
        system: options.system,
        messages,
      });
  await recordUsage(options.feature, model, response.usage);
  if (response.stop_reason === "refusal") throw new AiFailedError("Claude couldn't help with that one.");
  if (response.stop_reason === "max_tokens") throw new AiFailedError("That was too long to finish. Try a shorter recipe.");
  if (!response.parsed_output) throw new AiFailedError("Claude's answer didn't come back in the right shape.");
  return response.parsed_output as z.infer<T>;
}

/** A short back-and-forth: questions about a recipe while cooking. */
export async function chat(options: {
  feature: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const client = getClient();
  await checkBudget();
  const response = await client.beta.messages.create({
    model: FAST_MODEL,
    max_tokens: options.maxTokens ?? 1200,
    system: options.system,
    messages: options.messages,
  });
  await recordUsage(options.feature, FAST_MODEL, response.usage);
  if (response.stop_reason === "refusal") throw new AiFailedError("Claude couldn't answer that one.");
  const text = response.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) throw new AiFailedError("No answer came back. Try asking again.");
  return text;
}

/**
 * Lets Claude use web search and web fetch, and returns its final notes.
 * Handles `pause_turn` (the server's tool loop hitting its iteration cap)
 * by re-sending the conversation so it can pick up where it left off.
 */
export async function research(options: {
  feature: string;
  system: string;
  prompt: string;
  maxSearches?: number;
  effort?: "low" | "medium" | "high";
  /** Stop and use what we have once the call has cost this much (cents) */
  costCapCents?: number;
  /**
   * Let Claude open whole pages. Off by default: a fetched page lands in the
   * prompt in full, which is where research bills run into dollars. Search
   * results carry enough for most questions.
   */
  readPages?: boolean;
}): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  const client = getClient();
  const cap = options.costCapCents ?? 40;
  await checkBudget(cap);
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: options.prompt }];
  const sources = new Map<string, string>();
  let spent = 0;
  let text = "";

  // Each extra round re-sends every page Claude has read, so rounds are the
  // expensive part: two is enough for a menu, and the cost cap is the backstop.
  for (let round = 0; round < 2; round++) {
    const response = await client.beta.messages.create({
      model: RESEARCH_MODEL,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: options.effort ?? "low" },
      system: options.system,
      messages,
      tools: options.readPages
        ? [
            { type: "web_search_20260209", name: "web_search", max_uses: options.maxSearches ?? 3 },
            { type: "web_fetch_20260209", name: "web_fetch", max_uses: 1 },
          ]
        : [{ type: "web_search_20260209", name: "web_search", max_uses: options.maxSearches ?? 3 }],
    });

    await recordUsage(options.feature, RESEARCH_MODEL, response.usage);
    spent += costCents(RESEARCH_MODEL, response.usage);

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
    if (response.stop_reason !== "pause_turn" || spent >= cap) break;
    messages.push({ role: "assistant", content: response.content });
    text = "";
  }

  return { text: text.trim(), sources: [...sources.entries()].map(([url, title]) => ({ url, title })) };
}

export function friendlyAiError(error: unknown): string {
  if (error instanceof AiBudgetError) return error.message;
  if (error instanceof AiUnavailableError) return "AI isn't set up yet. Add ANTHROPIC_API_KEY to turn it on.";
  if (error instanceof AiFailedError) return error.message;
  if (error instanceof Anthropic.RateLimitError) return "Claude is busy right now. Try again in a minute.";
  if (error instanceof Anthropic.AuthenticationError) return "The Anthropic API key isn't working. Check it in Vercel.";
  if (error instanceof Anthropic.BadRequestError) return "Claude couldn't read that. Try a clearer photo or a different file.";
  if (error instanceof Anthropic.APIError) return "Claude had a hiccup. Try again.";
  return "Something went wrong talking to Claude. Try again.";
}
