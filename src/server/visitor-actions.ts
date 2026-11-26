"use server";

import { getTranslations } from "next-intl/server";
import { VISITOR_RECORD_RETENTION_MONTHS } from "@/lib/visitor-retention";
import { revalidatePath, updateTag } from "next/cache";
import { getCurrentSession, requireSiteOwner } from "@/server/auth";
import {
  deleteVisitorAccount,
  pruneExpiredVisitorRecords,
  recordArticleVisit,
  recordProjectVisit,
  VISITOR_RECORDS_CACHE_TAG,
} from "@/server/visitors";

export interface VisitorAdminActionState {
  status: "idle" | "success" | "error";
  message?: string;
}

export async function recordArticleVisitAction(articleId: string) {
  const session = await getCurrentSession();
  if (!session?.user?.id) return { recorded: false };

  try {
    const recorded = await recordArticleVisit(session.user.id, articleId);
    if (recorded) updateTag(VISITOR_RECORDS_CACHE_TAG);
    return { recorded };
  } catch {
    return { recorded: false };
  }
}

export async function recordProjectVisitAction(projectId: string) {
  const session = await getCurrentSession();
  if (!session?.user?.id) return { recorded: false };

  try {
    const recorded = await recordProjectVisit(session.user.id, projectId);
    if (recorded) updateTag(VISITOR_RECORDS_CACHE_TAG);
    return { recorded };
  } catch {
    return { recorded: false };
  }
}

export async function pruneExpiredVisitorRecordsAction(): Promise<VisitorAdminActionState> {
  await requireSiteOwner();
  const t = await getTranslations({ locale: "zh", namespace: "AdminActions" });
  try {
    const result = await pruneExpiredVisitorRecords();
    updateTag(VISITOR_RECORDS_CACHE_TAG);
    revalidatePath("/admin/visitors");
    return {
      status: "success",
      message: t("pruneSuccess", {
        articles: result.deletedArticleVisits,
        projects: result.deletedProjectVisits,
        months: VISITOR_RECORD_RETENTION_MONTHS,
      }),
    };
  } catch {
    return { status: "error", message: t("pruneFailure") };
  }
}

export async function deleteVisitorAccountAction(
  _previousState: VisitorAdminActionState,
  formData: FormData,
): Promise<VisitorAdminActionState> {
  const session = await requireSiteOwner();
  const t = await getTranslations({ locale: "zh", namespace: "AdminActions" });
  const visitorId = formData.get("visitorId");
  if (typeof visitorId !== "string" || !visitorId.trim()) {
    return { status: "error", message: t("missingVisitorId") };
  }

  try {
    const result = await deleteVisitorAccount(visitorId.trim(), session.user.id);
    if (!result.ok) {
      return {
        status: "error",
        message:
          result.reason === "self"
            ? t("cannotDeleteSelf")
            : result.reason === "owner"
              ? t("cannotDeleteOwner")
              : t("visitorNotFound"),
      };
    }
    updateTag(VISITOR_RECORDS_CACHE_TAG);
    revalidatePath("/admin/visitors");
    return { status: "success", message: t("deleteSuccess") };
  } catch {
    return { status: "error", message: t("deleteFailure") };
  }
}
