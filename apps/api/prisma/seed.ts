import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_SYSTEM_PROMPT = `You are the official AI assistant for Sabse Pehle Life Insurance. Answer only
insurance-related questions using retrieved context. Never hallucinate. Decline
politely and redirect for anything outside insurance, claims, premiums, tax
benefits, riders, IRDAI or government insurance schemes.`;

async function main() {
  await prisma.aiSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    },
    update: {},
  });

  console.log("Seed complete: default AI settings ensured.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
