import OpenAI from "openai";

export const runtime = "nodejs"; // important: avoid Edge for this route

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY missing");
      return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { topic, context, grade, curriculum, template } = body;

    const prompt = [
      `Curriculum: ${curriculum ?? "—"}`,
      `Grade: ${grade ?? "—"}`,
      `Topic: ${topic ?? "—"}`,
      context ? `Context: ${context}` : "",
      template ? `Template: ${template}` : "",
      "",
      "Generate helpful teacher-facing output."
    ].filter(Boolean).join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        { role: "system", content: "You are a helpful curriculum assistant." },
        { role: "user", content: prompt }
      ]
    });

    const text = completion.choices?.[0]?.message?.content ?? "";
    return Response.json({ ok: true, text });
  } catch (err: any) {
    // This will print to your terminal running `npm run dev`
    console.error("API /generate error:", err?.stack || err?.message || err);
    return new Response(JSON.stringify({ error: err?.message || "Server error" }), { status: 500 });
  }
}
