import { connection, NextResponse } from "next/server";

import { getPrisma } from "@/server/db";

export async function GET() {
  await connection();

  try {
    await getPrisma().$queryRaw`SELECT 1`;

    return NextResponse.json({ status: "ok", database: "ok" });
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unavailable" },
      { status: 503 },
    );
  }
}
