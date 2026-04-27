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
  | { type: "generate"; itineraryId: string; perDay: number; shuffle: boolean };

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
      perDay: { type: "NUMBER", description: "Places per day, 1–8 (default 3)" },
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

  const messages: InMessage[] = body.messages;
  const ctx: {
    savedCount?: number;
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
    `App state: ${ctx.savedCount ?? 0} saved place(s), ${ctx.itineraryCount ?? 0} itinerary/itineraries.`,
    ctx.activeItineraryId
      ? `Active itinerary: "${ctx.activeItineraryTitle ?? "unknown"}" (ID: ${ctx.activeItineraryId}).`
      : "No active itinerary selected.",
    "When the user asks about places or a destination, call search_city.",
    "When the user wants to plan a trip, call create_itinerary then generate_itinerary.",
    "Keep replies short. Do not repeat tool return values verbatim.",
  ].join("\n");

  const functionDeclarations = userId
    ? [SEARCH_FN, CREATE_FN, GENERATE_FN]
    : [SEARCH_FN];

  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
    systemInstruction,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ functionDeclarations: functionDeclarations as any }],
  });

  const chat = model.startChat({ history });
  const sideEffects: ChatSideEffect[] = [];

  let result = await chat.sendMessage(lastMsg.content);

  // Function calling loop — max 5 iterations to prevent runaway tool chains
  for (let i = 0; i < 5; i++) {
    const calls = result.response.functionCalls();
    if (!calls?.length) break;

    const parts = await Promise.all(
      calls.map(async (call) => {
        const args = (call.args ?? {}) as Record<string, unknown>;
        const response = await executeFunction(call.name, args, userId, sideEffects);
        return { functionResponse: { name: call.name, response } };
      })
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result = await chat.sendMessage(parts as any);
  }

  return NextResponse.json({ message: result.response.text(), sideEffects });
}

async function executeFunction(
  name: string,
  args: Record<string, unknown>,
  userId: string | undefined,
  sideEffects: ChatSideEffect[]

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
    if (!itineraryId) return { error: "itineraryId is required" };

    const itin = await prisma.itinerary.findFirst({ where: { id: itineraryId, userId } });
    if (!itin) return { error: "Itinerary not found or not owned by user" };

    const perDay = Math.min(Math.max(Math.round(Number(args.perDay) || 3), 1), 8);
    const shuffle = Boolean(args.shuffle);

    sideEffects.push({ type: "generate", itineraryId, perDay, shuffle });
    return { result: `Will generate schedule for "${itin.title}" (${perDay} places/day)` };
  }

  return { error: `Unknown function: ${name}` };
}
