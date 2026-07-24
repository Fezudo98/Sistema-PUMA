import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function run() {
  const q = await prisma.question.findFirst();
  if (!q) {
    console.log("No question found");
    return;
  }
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.log("No Anthropic key");
  }
  const Anthropic = require("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  try {
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 1500,
      messages: [{ role: "user", content: "Say hello" }]
    });
    console.log(response.content[0]);
  } catch (err: any) {
    console.error("Error calling Anthropic:", err.message || err);
  }
}
run();
