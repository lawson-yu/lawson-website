"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession, requireSiteOwner } from "@/server/auth";
import {
  deleteVisitorAccount,
  pruneExpiredVisitorRecords,
  recordArticleVisit,
  recordProjectVisit,
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
    return { recorded };
  } catch {
    return { recorded: false };
  }
}

export async function pruneExpiredVisitorRecordsAction(): Promise<VisitorAdminActionState> {
  await requireSiteOwner();
  try {
    const result = await pruneExpiredVisitorRecords();
    revalidatePath("/admin/visitors");
    return {
      status: "success",
      message: `已清理 24 个月前的访问记录：文章 ${result.deletedArticleVisits} 条，作品 ${result.deletedProjectVisits} 条。`,
    };
  } catch {
    return { status: "error", message: "清理失败，请稍后重试。" };
  }
}

export async function deleteVisitorAccountAction(
  _previousState: VisitorAdminActionState,
  formData: FormData,
): Promise<VisitorAdminActionState> {
  const session = await requireSiteOwner();
  const visitorId = formData.get("visitorId");
  if (typeof visitorId !== "string" || !visitorId.trim()) {
    return { status: "error", message: "缺少访客标识。" };
  }

  try {
    const result = await deleteVisitorAccount(visitorId.trim(), session.user.id);
    if (!result.ok) {
      return {
        status: "error",
        message:
          result.reason === "self"
            ? "不能删除当前登录的站长账号。"
            : result.reason === "owner"
              ? "不能删除白名单中的站长账号。"
              : "访客账号不存在或已被删除。",
      };
    }
    revalidatePath("/admin/visitors");
    return { status: "success", message: "已删除该访客账号及全部关联记录。" };
  } catch {
    return { status: "error", message: "删除失败，请稍后重试。" };
  }
}
