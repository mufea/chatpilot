export type PlanLimits = {
  chatbots: number;
  knowledgeBases: number;
  monthlyMessages: number;
  teamMembers: number;
  documentsPerKnowledgeBase: number;
};

export type PlanDefinition = {
  code: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  currency: string;
  sortOrder: number;
  limits: PlanLimits;
  features: string[];
  highlighted?: boolean;
};

export const DEFAULT_PLANS: PlanDefinition[] = [
  {
    code: "FREE",
    name: "Free",
    description: "Launch one chatbot, learn the product, and prove the workflow before you pay.",
    monthlyPriceCents: 0,
    yearlyPriceCents: 0,
    currency: "USD",
    sortOrder: 10,
    limits: {
      chatbots: 1,
      knowledgeBases: 1,
      monthlyMessages: 200,
      teamMembers: 1,
      documentsPerKnowledgeBase: 5,
    },
    features: [
      "1 published chatbot",
      "1 knowledge base",
      "200 monthly messages",
      "Basic widget branding",
      "Community support",
    ],
  },
  {
    code: "STARTER",
    name: "Starter",
    description: "For growing stores and solo operators who need more conversations and training data.",
    monthlyPriceCents: 3900,
    yearlyPriceCents: 39000,
    currency: "USD",
    sortOrder: 20,
    limits: {
      chatbots: 3,
      knowledgeBases: 3,
      monthlyMessages: 3000,
      teamMembers: 3,
      documentsPerKnowledgeBase: 25,
    },
    features: [
      "Up to 3 chatbots",
      "Document and website training",
      "3,000 monthly messages",
      "Standard widget customization",
      "Basic analytics",
    ],
  },
  {
    code: "PRO",
    name: "Pro",
    description: "For teams that need collaboration, human handoff, and higher usage ceilings.",
    monthlyPriceCents: 9900,
    yearlyPriceCents: 99000,
    currency: "USD",
    sortOrder: 30,
    highlighted: true,
    limits: {
      chatbots: 10,
      knowledgeBases: 10,
      monthlyMessages: 20000,
      teamMembers: 10,
      documentsPerKnowledgeBase: 100,
    },
    features: [
      "Up to 10 chatbots",
      "Multiple knowledge bases",
      "20,000 monthly messages",
      "Team collaboration",
      "Human handoff inbox",
      "Advanced analytics",
      "Remove ChatPilot branding",
    ],
  },
  {
    code: "BUSINESS",
    name: "Business",
    description: "For agencies and multi-brand teams that need higher limits and custom branding.",
    monthlyPriceCents: 24900,
    yearlyPriceCents: 249000,
    currency: "USD",
    sortOrder: 40,
    limits: {
      chatbots: 50,
      knowledgeBases: 50,
      monthlyMessages: 100000,
      teamMembers: 40,
      documentsPerKnowledgeBase: 500,
    },
    features: [
      "Higher chatbot and message limits",
      "Agency and white-label options",
      "Priority support",
      "Advanced integrations",
      "Custom branding",
      "Higher concurrency",
    ],
  },
];

export async function getOrganizationPlanLimits(
  db: import("@prisma/client").PrismaClient,
  organizationId: string,
): Promise<PlanLimits> {
  const subscription = await db.subscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });
  const limits = subscription?.plan?.limits as PlanLimits | undefined;
  return limits ?? DEFAULT_PLANS[0]!.limits;
}

export function formatPlanPrice(cents: number, currency = "USD"): string {
  if (cents === 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
