import { NextResponse, type NextRequest } from "next/server";
import { readLocalMediaFile } from "@/server/media";

type RouteContext = {
  params: Promise<{ key: string[] }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { key: segments } = await context.params;
  if (!segments?.length) {
    return new NextResponse(null, { status: 404 });
  }

  const relativeKey = segments.join("/");
  const file = await readLocalMediaFile(relativeKey);
  if (!file) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.buffer), {
    status: 200,
    headers: {
      "content-type": file.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
