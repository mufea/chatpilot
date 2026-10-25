import { PrismaClient } from "@prisma/client";
import { ensureDefaultPlans } from "../lib/org/service";

const prisma = new PrismaClient();

async function main() {
  await ensureDefaultPlans(prisma);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
