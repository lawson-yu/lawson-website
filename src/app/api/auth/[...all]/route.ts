import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";
import { getAuth, isAuthConfigured } from "@/server/auth";

function unavailable(request: NextRequest, method: "GET" | "POST") {
  if (
    method === "GET" &&
    new URL(request.url).pathname.endsWith("/get-session")
  ) {
    return Response.json(null);
  }

  return Response.json({ message: "Google 登录尚未配置。" }, { status: 503 });
}

export function GET(request: NextRequest) {
  if (!isAuthConfigured()) return unavailable(request, "GET");
  return toNextJsHandler(getAuth()!).GET(request);
}

export function POST(request: NextRequest) {
  if (!isAuthConfigured()) return unavailable(request, "POST");
  return toNextJsHandler(getAuth()!).POST(request);
}
