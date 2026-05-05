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
      daysCount: { type: "NUMBER", description: "Number of days, 1–14" },
    },
    required: ["title", "daysCount"],
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
      perDay: { type: "NUMBER", description: "Maximum places per day, 1–8. Omit to let the app decide." },
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
  const userId = (session?.user as any)?.id as string | undefined;

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }

  // Cap history to last 20 messages to avoid hitting context limits
  const messages: InMessage[] = body.messages.slice(-20);
  const ctx: {
    savedCount?: number;
    selectedSavedCount?: number;
    itineraryCount?: number;
    activeItineraryId?: string;
    activeItineraryTitle?: string;
  } = body.context ?? {};

  // Build Gemini chat history (all messages except the last)
  const history = messages.slice(0, -1).map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));
  const lastMsg = messages[messages.length - 1];

  const systemInstruction = [
    "You are a concise, action-oriented travel planning assistant embedded in an itinerary planner app.",
    userId
      ? "The user is signed in and can search, create itineraries, and generate schedules."
      : "The user is not signed in. Only search_city is available — politely suggest signing in for planning features.",
    `App state: ${ctx.savedCount ?? 0} saved place(s) (${ctx.selectedSavedCount ?? 0} selected), ${ctx.itineraryCount ?? 0} itinerary/itineraries.`,
    ctx.activeItineraryId
      ? `Active itinerary: "${ctx.activeItineraryTitle ?? "unknown"}" (ID: ${ctx.activeItineraryId}).`
      : "No active itinerary selected.",
    ctx.selectedSavedCount && ctx.selectedSavedCount > 0
      ? `The user has ${ctx.selectedSavedCount} place(s) selected — generation will use only those selected places.`
      : `No places are selected — if the user asks to generate, warn them that ALL ${ctx.savedCount ?? 0} saved place(s) will be used and ask them to confirm before calling generate_itinerary.`,
    "When the user asks about places or a destination, call search_city.",
    "When the user asks to both create AND generate in the same message: call create_itinerary, receive its response to get the id, then immediately call generate_itinerary using that id — do NOT stop to ask the user for confirmation between the two calls.",
    "When the user only asks to create an itinerary (no mention of generating): call create_itinerary only, then ask if they want to generate a schedule.",
    "If a function returns an error field, always relay that error message to the user exactly — never assume success.",
    "Never state how many places per day were added — the actual distribution is determined by the app after you respond and may differ from the requested amount.",
    "Keep replies short. Do not repeat tool return values verbatim.",
  ].join("\n");

  const functionDeclarations = userId
    ? [SEARCH_FN, CREATE_FN, GENERATE_FN]
    : [SEARCH_FN];

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ functionDeclarations: functionDeclarations as any }],
  });

  const chat = model.startChat({ history });
  const sideEffects: ChatSideEffect[] = [];

  try {
    let result = await chat.sendMessage(lastMsg.content);

    // Function calling loop — max 5 iterations to prevent runaway tool chains
    for (let i = 0; i < 5; i++) {
      const calls = result.response.functionCalls();
      if (!calls?.length) break;

      const parts = await Promise.all(
        calls.map(async (call) => {
          const args = (call.args ?? {}) as Record<string, unknown>;
          const response = await executeFunction(call.name, args, userId, sideEffects, ctx);
          return { functionResponse: { name: call.name, response } };
        })
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result = await chat.sendMessage(parts as any);
    }

    const text = result.response.text().trim();
    const message = text || buildFallbackMessage(sideEffects);
    return NextResponse.json({ message, sideEffects });
  } catch (e: any) {
    if (e?.status === 429) {
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
  ctx: { selectedSavedCount?: number } = {}
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
    const daysCount = Math.min(Math.max(Math.round(Number(args.daysCount) || 3), 1), 14);
    if (!title) return { error: "title is required" };

    try {
      const itin = await prisma.itinerary.create({ data: { title, daysCount, userId } });
      const r = await getRedis();
      if (r){
        r.del(`itineraries:v1:user:${userId}`).catch(() => {});
      }
      sideEffects.push({ type: "refresh_itineraries", selectId: itin.id });
      return { result: `Created itinerary "${itin.title}" (${daysCount} days)`, id: itin.id };
    } catch (e: any) {
      if (e?.code === "P2002"){
        return { error: `An itinerary named "${title}" already exists` };
      }
      return { error: e?.message ?? "Failed to create itinerary" };
    }

  }

  if (name === "generate_itinerary") {
    if (!userId) return { error: "User is not signed in" };
    const itineraryId = String(args.itineraryId ?? "").trim();
    if (!itineraryId) return { error: "No itinerary is selected. Please create one or ask the user to select an itinerary first." };

    const itin = await prisma.itinerary.findFirst({ where: { id: itineraryId, userId } });
    if (!itin) return { error: "Itinerary not found or not owned by user" };

    const savedCount = await prisma.savedPlace.count({ where: { savedById: userId } });
    if (savedCount === 0) {
      return { error: "You have no saved places to generate from. Search for a destination and save some places first." };
    }

    const perDay = Math.min(Math.max(Math.round(Number(args.perDay) || 3), 1), 8);
    const shuffle = Boolean(args.shuffle);

    const useSelected = (ctx.selectedSavedCount ?? 0) > 0;
    sideEffects.push({ type: "generate", itineraryId, perDay, shuffle, useSelected });
    const scope = useSelected ? `${ctx.selectedSavedCount} selected place(s)` : "all saved places";
    return { result: `Generating schedule for "${itin.title}" across ${itin.daysCount} day(s), up to ${perDay} place(s) per day, using ${scope}. Actual distribution depends on how many places are available.` };
  }

  return { error: `Unknown function: ${name}` };
}
