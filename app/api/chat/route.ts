export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";

type InMessage = { role: "user" | "assistant"; content: string };

export type ChatSideEffect =
  | { type: "search"; query: string }
  | { type: "refresh_itineraries"; selectId?: string }
  | { type: "generate"; itineraryId: string; perDay: number; shuffle: boolean; useSelected: boolean };

const SEARCH_FN = {
  name: "search_city",
  description:
    "Search for attractions and points of interest in a city — triggers a live search in the app UI",
  parameters: {
    type: "OBJECT",
    properties: {
      city: {
        type: "STRING",
        description: "City or neighbourhood name (e.g. Toronto, Shibuya, Marais)",
      },
    },
    required: ["city"],
  },
};

const CREATE_FN = {
  name: "create_itinerary",
  description: "Create a new travel itinerary for the signed-in user",
  parameters: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING", description: "Itinerary title (e.g. Tokyo Trip)" },
      daysCount: {
        type: "NUMBER",
        description:
          "Number of days, 1–14. Omit if the user did not specify a length so the app's default is used.",
      },
    },
    required: ["title"],
  },
};

const GENERATE_FN = {
  name: "generate_itinerary",
  description:
    "Auto-generate a day-by-day schedule for an itinerary from the user's saved places",
  parameters: {
    type: "OBJECT",
    properties: {
      itineraryId: {
        type: "STRING",
        description:
          "ID of the itinerary to populate — use the id returned by create_itinerary, or from context",
      },
      perDay: {
        type: "NUMBER",
        description: "Maximum places per day, 1–8. Omit to let the app decide.",
      },
      shuffle: { type: "BOOLEAN", description: "Randomise place order" },
    },
    required: ["itineraryId"],
  },
};

export async function POST(req: Request) {
  if (!process.env.GOOGLE_GENERATIVE_AI_KEY) {
    return NextResponse.json({ error: "AI not configured" }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Cap history to last 20 messages to avoid hitting context limits
  const messages: InMessage[] = body.messages.slice(-20);
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== "user" || !lastMsg.content?.trim()) {
    return NextResponse.json({ error: "Last message must be a non-empty user message" }, { status: 400 });
  }

  const ctx: {
    savedCount?: number;
    selectedSavedCount?: number;
    itineraryCount?: number;
    activeItineraryId?: string;
    activeItineraryTitle?: string;
    defaultDays?: number;
    defaultPerDay?: number;
  } = body.context ?? {};

  // Build Gemini chat history (all messages except the last).
  // Gemini requires history to start with "user", alternate user/model turns,
  // and end with "model" since sendMessage() appends the next "user" turn.
  const history: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
  for (const m of messages.slice(0, -1)) {
    const text = typeof m?.content === "string" ? m.content.trim() : "";
    if (!text) continue;
    const role: "user" | "model" = m.role === "user" ? "user" : "model";
    if (history.length === 0) {
      if (role !== "user") continue;
      history.push({ role, parts: [{ text }] });
      continue;
    }
    const prev = history[history.length - 1];
    if (prev.role === role) {
      if (role === "user") {
        // Previous user message had no model reply (e.g. stripped error turn); replace with latest
        prev.parts = [{ text }];
      } else {
        prev.parts.push({ text });
      }
    } else {
      history.push({ role, parts: [{ text }] });
    }
  }
  if (history.length > 0 && history[history.length - 1].role === "user") {
    history.pop();
  }

  const hasSelections = (ctx.selectedSavedCount ?? 0) > 0;

  const systemInstruction = [
    "You are a concise, action-oriented travel planning assistant embedded in an itinerary planner app.",

    userId
      ? "The user is signed in and can search, create itineraries, and generate schedules."
      : "The user is not signed in. Only search_city is available — politely suggest signing in for planning features.",

    `App state: ${ctx.savedCount ?? 0} saved place(s)` +
      ` (${ctx.selectedSavedCount ?? 0} selected),` +
      ` ${ctx.itineraryCount ?? 0} itinerary/itineraries.`,

    ctx.activeItineraryId
      ? `Active itinerary: "${ctx.activeItineraryTitle ?? "unknown"}" (ID: ${ctx.activeItineraryId}).`
      : "No active itinerary selected.",

    hasSelections
      ? `Generation scope: ${ctx.selectedSavedCount} selected place(s) will be used when you call generate_itinerary.`
      : `Generation scope: no places are selected, so ALL ${ctx.savedCount ?? 0} saved place(s) would be used.` +
        " Before calling generate_itinerary, warn the user and ask them to confirm" +
        " (or to select specific places first).",

    "When the user expresses any interest in exploring, finding, discovering, or learning about" +
      " places, attractions, points of interest, or destinations —" +
      " regardless of exact wording — call search_city.",

    ctx.activeItineraryId
      ? "Itinerary intent — pick ONE path based on the user's wording:" +
        " (PATH A) FILL the active itinerary listed above. Triggered by phrases like" +
        " 'fill it', 'regenerate', 'use my selections', 'add to my trip', 'generate now'," +
        " or any reference to the current/this/my existing itinerary." +
        " Action: call generate_itinerary with itineraryId set to the active itinerary ID above." +
        " Do NOT create a new itinerary in this case." +
        " (PATH B) NEW itinerary. Triggered by phrases like 'new trip', 'another city'," +
        " 'plan a trip to X', or a title clearly different from the active one." +
        (hasSelections
          ? " Action: MANDATORY 2-step in the SAME turn —" +
            " Step 1 call create_itinerary, Step 2 call generate_itinerary using the id" +
            " RETURNED by create_itinerary (NOT the active id). Never stop after Step 1."
          : " Action: call create_itinerary only, then tell the user to save and select" +
            " some places before generating.")
      : "There is no active itinerary." +
        (hasSelections
          ? " For ANY trip/itinerary intent: MANDATORY 2-step in the SAME turn —" +
            " Step 1 call create_itinerary, Step 2 call generate_itinerary using the id" +
            " RETURNED by create_itinerary. Never stop after Step 1."
          : " For ANY trip/itinerary intent: call create_itinerary only, then tell the user" +
            " to save and select some places before generating."),

    "Omit daysCount in create_itinerary and perDay in generate_itinerary unless the user" +
      " explicitly specifies a number, so the user's saved Settings defaults are used.",

    "If a function returns an error field, always relay that error message to the user exactly —" +
      " never assume success.",

    "Never state how many places per day were added —" +
      " the actual distribution is determined by the app after you respond" +
      " and may differ from the requested amount.",

    "Keep replies short. Do not repeat tool return values verbatim.",
  ].join("\n");

  const functionDeclarations = userId
    ? [SEARCH_FN, CREATE_FN, GENERATE_FN]
    : [SEARCH_FN];

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.5-flash-lite",
    systemInstruction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ functionDeclarations: functionDeclarations as any }],
  });

  const sideEffects: ChatSideEffect[] = [];

  try {
    // Use model.generateContent with explicit contents rather than startChat():
    // @google/generative-ai's ChatSession sends functionResponse with role:"function",
    // which Gemini 3.5+ rejects (requiring role:"user" + preserving thoughtSignature on model parts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contents: any[] = [
      ...history,
      { role: "user", parts: [{ text: lastMsg.content }] },
    ];
    let result = await model.generateContent({ contents });

    // Function calling loop — max 5 iterations to prevent runaway tool chains
    for (let i = 0; i < 5; i++) {
      const candidateContent = result.response.candidates?.[0]?.content;
      const calls = result.response.functionCalls();
      if (!calls?.length || !candidateContent) break;

      contents.push({ ...candidateContent, role: candidateContent.role || "model" });

      const parts = await Promise.all(
        calls.map(async (call) => {
          const args = (call.args ?? {}) as Record<string, unknown>;
          const response = await executeFunction(call.name, args, userId, sideEffects, ctx);
          const callId = (call as { id?: string }).id;
          return {
            functionResponse: {
              name: call.name,
              ...(callId ? { id: callId } : {}),
              response,
            },
          };
        })
      );

      contents.push({ role: "user", parts });
      result = await model.generateContent({ contents });
    }

    // Trigger SDK safety/promptFeedback validation on the final response before extracting non-thought text
    result.response.text();
    const text = extractVisibleText(result.response);
    const message = text || buildFallbackMessage(sideEffects);
    return NextResponse.json({ message, sideEffects });

  } catch (e: unknown) {
    if ((e as { status?: number })?.status === 429) {
      return NextResponse.json(
        { error: "The AI is temporarily rate-limited. Please wait a few seconds and try again." },
        { status: 429 }
      );
    }
    console.error("Gemini error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

function extractVisibleText(response: {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
  }>;
}): string {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();
}

function buildFallbackMessage(effects: ChatSideEffect[]): string {
  if (effects.some((e) => e.type === "generate")) {
    return "Your itinerary is ready! Check the itinerary section below.";
  }
  if (effects.some((e) => e.type === "refresh_itineraries")) {
    return "Itinerary created! You can now add places or generate a schedule.";
  }
  if (effects.some((e) => e.type === "search")) {
    return "Search complete! Check the results on the left.";
  }
  return "Done!";
}

async function executeFunction(
  name: string,
  args: Record<string, unknown>,
  userId: string | undefined,
  sideEffects: ChatSideEffect[],
  ctx: { selectedSavedCount?: number; defaultDays?: number; defaultPerDay?: number } = {}
): Promise<Record<string, unknown>> {
  if (name === "search_city") {
    const city = String(args.city ?? "").trim();
    if (!city) return { error: "city is required" };
    sideEffects.push({ type: "search", query: city });
    return { result: `Triggered search for "${city}" in the app` };
  }

  if (name === "create_itinerary") {
    if (!userId) return { error: "User is not signed in" };
    const title = String(args.title ?? "").trim();
    const fallbackDays =
      typeof ctx.defaultDays === "number" && Number.isFinite(ctx.defaultDays)
        ? ctx.defaultDays
        : 3;
    const daysCount = Math.min(Math.max(Math.round(Number(args.daysCount) || fallbackDays), 1), 14);
    if (!title) return { error: "title is required" };

    try {
      const itin = await prisma.itinerary.create({ data: { title, daysCount, userId } });
      try {
        const r = await getRedis();
        if (r) await r.del(`itineraries:v1:user:${userId}`);
      } catch {}
      sideEffects.push({ type: "refresh_itineraries", selectId: itin.id });
      return { result: `Created itinerary "${itin.title}" (${daysCount} days)`, id: itin.id };
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === "P2002") {
        return { error: `An itinerary named "${title}" already exists` };
      }
      return { error: err?.message ?? "Failed to create itinerary" };
    }
  }

  if (name === "generate_itinerary") {
    if (!userId) return { error: "User is not signed in" };
    const itineraryId = String(args.itineraryId ?? "").trim();
    if (!itineraryId) {
      return { error: "No itinerary is selected. Please create one or ask the user to select an itinerary first." };
    }

    const itin = await prisma.itinerary.findFirst({ where: { id: itineraryId, userId } });
    if (!itin) return { error: "Itinerary not found or not owned by user" };

    const savedCount = await prisma.savedPlace.count({ where: { savedById: userId } });
    if (savedCount === 0) {
      return { error: "You have no saved places to generate from. Search for a destination and save some places first." };
    }

    const eligibleCount = await prisma.savedPlace.count({
      where: {
        savedById: userId,
        place: { lat: { not: null }, lon: { not: null } },
      },
    });
    if (eligibleCount === 0) {
      return { error: "None of your saved places have location coordinates and cannot be scheduled." };
    }

    const fallbackPerDay =
      typeof ctx.defaultPerDay === "number" && Number.isFinite(ctx.defaultPerDay)
        ? ctx.defaultPerDay
        : 3;
    const perDay = Math.min(Math.max(Math.round(Number(args.perDay) || fallbackPerDay), 1), 8);
    const shuffle = Boolean(args.shuffle);
    const useSelected = (ctx.selectedSavedCount ?? 0) > 0;

    sideEffects.push({ type: "generate", itineraryId, perDay, shuffle, useSelected });

    const scope = useSelected
      ? `${ctx.selectedSavedCount} selected place(s)`
      : "all saved places";
    return {
      result:
        `Generating schedule for "${itin.title}" across ${itin.daysCount} day(s),` +
        ` up to ${perDay} place(s) per day, using ${scope}.` +
        " Actual distribution depends on how many places are available.",
    };
  }

  return { error: `Unknown function: ${name}` };
}
