import { prisma } from "../lib/db";
import { processQueuedJobs } from "../lib/knowledge/process";

async function main() {
  const processed = await processQueuedJobs(prisma, { limit: 25 });
  console.log(`processed=${processed}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
