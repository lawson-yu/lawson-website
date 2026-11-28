import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { isSiteOwner } from "@/lib/auth-policy";
import { getAuth } from "@/server/auth";
import {
  MAX_MEDIA_UPLOAD_BYTES,
  MediaValidationError,
  storeUploadedImage,
} from "@/server/media";

// multipart 表单字段与边界预留 256KB 开销，超限在读 body 前快速拒绝。
const MAX_REQUEST_BYTES = MAX_MEDIA_UPLOAD_BYTES + 256 * 1024;

async function readBoundedFormData(request: NextRequest): Promise<FormData> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new MediaValidationError("multipartRequired", 400);
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new MediaValidationError("multipartRequired", 400);
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MediaValidationError("fileTooLarge", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const boundedRequest = new Request(request.url, {
    method: "POST",
    headers: { "content-type": contentType },
    body: Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), size),
  });
  return boundedRequest.formData();
}

export async function POST(request: NextRequest) {
  const t = await getTranslations({ locale: "zh", namespace: "MediaErrors" });
  const auth = getAuth();
  if (!auth) {
    return NextResponse.json({ error: t("authServiceUnavailable") }, { status: 401 });
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json({ error: t("signInRequired") }, { status: 401 });
  }
  if (!isSiteOwner(session.user.email, session.user.emailVerified)) {
    return NextResponse.json({ error: t("siteOwnerOnly") }, { status: 403 });
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: t("fileTooLarge") }, { status: 413 });
    }
  }

  let formData: FormData;
  try {
    formData = await readBoundedFormData(request);
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ error: t(error.code) }, { status: error.status });
    }
    return NextResponse.json({ error: t("multipartRequired") }, { status: 400 });
  }

  const kindValue = formData.get("kind");
  const kind = typeof kindValue === "string" ? kindValue.trim() : "";
  const fileValue = formData.get("file");
  if (!(fileValue instanceof File)) {
    return NextResponse.json({ error: t("fileRequired") }, { status: 400 });
  }
  if (fileValue.size > MAX_MEDIA_UPLOAD_BYTES) {
    return NextResponse.json({ error: t("fileTooLarge") }, { status: 413 });
  }

  try {
    const buffer = Buffer.from(await fileValue.arrayBuffer());
    const stored = await storeUploadedImage(buffer, kind);
    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ error: t(error.code) }, { status: error.status });
    }
    return NextResponse.json({ error: t("uploadFailed") }, { status: 500 });
  }
}
