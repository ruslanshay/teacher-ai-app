// app/api/generate/route.ts
import OpenAI from "openai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";          // ensure Node runtime (not Edge)
export const dynamic = "force-dynamic";   // avoid caching of route results

// Configure the OpenAI SDK (envs are read at runtime)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Optional: point to a custom base if you use a proxy
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const body = await req.json().catch(() => ({} as any));

    // Accept either a raw messages array OR structured fields from your UI.
    let messages: ChatMessage[] | undefined = Array.isArray(body?.messages)
      ? body.messages
      : undefined;

    if (!messages) {
      const {
        topic,
        context,
        grade,
        curriculum,
        template,
        systemPrompt,
      } = body || {};

      const lines = [
        curriculum ? `Curriculum: ${curriculum}` : "",
        grade ? `Grade: ${grade}` : "",
        topic ? `Topic: ${topic}` : "",
        context ? `Context: ${context}` : "",
        template ? `Template: ${template}` : "",
      ].filter(Boolean);

      const userPrompt =
        (lines.length ? lines.join("\n") + "\n\n" : "") +
        "Generate helpful teacher-facing output that is concise, practical, and classroom-ready.";

      messages = [
        {
          role: "system",
          content:
            systemPrompt ||
            "You are a helpful curriculum assistant. Prefer bullet points, clear structure, and actionable steps.",
        },
        { role: "user", content: userPrompt },
      ];
    }

    const model = process.env.OPENAI_MODEL || "gpt-5";
    const temperature =
      typeof body?.temperature === "number" ? body.temperature : 0.7;

    const completion = await openai.chat.completions.create({
      model,
      temperature,
      messages,
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ ok: true, model, text });
  } catch (err: any) {
    // You’ll see this in the terminal running `npm run dev`
    console.error("API /api/generate error:", err?.stack || err?.message || err);
    return NextResponse.json(
      { error: err?.message || "Server error" },
      { status: 500 },
    );
  }
}
