import { NextResponse } from "next/server";
import { exportAccount } from "@/lib/auth/service";
import { getCurrentAuth } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export async function GET() {
  const auth = await getCurrentAuth();
  if (!auth) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  const payload = await exportAccount(prisma, auth.user.id);
  return NextResponse.json(payload, {
    headers: {
      "content-disposition": 'attachment; filename="chatpilot-account-export.json"',
    },
  });
}
