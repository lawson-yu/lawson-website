"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { requireSiteOwner } from "@/server/auth";
import { getPrisma } from "@/server/db";

function value(formData: FormData, name: string) {
  const item = formData.get(name);
  return typeof item === "string" ? item.trim() : "";
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function manageArticleTag(formData: FormData) {
  await requireSiteOwner();

  const intent = value(formData, "intent");
  const id = value(formData, "id");
  const name = value(formData, "name");
  const prisma = getPrisma();

  if (intent === "create") {
    if (!name) redirect("/admin/articles/tags?result=empty");
    try {
      await prisma.tag.create({ data: { name } });
    } catch (error) {
      if (isUniqueViolation(error)) redirect("/admin/articles/tags?result=duplicate");
      throw error;
    }
    updateTag("articles");
    redirect("/admin/articles/tags?result=created");
  }

  if ((intent !== "rename" && intent !== "delete") || !id) {
    redirect("/admin/articles/tags?result=invalid");
  }
  if (!await prisma.tag.findUnique({ where: { id }, select: { id: true } })) {
    redirect("/admin/articles/tags?result=missing");
  }

  if (intent === "delete") {
    await prisma.tag.delete({ where: { id } });
    updateTag("articles");
    redirect("/admin/articles/tags?result=removed");
  }

  if (!name) redirect("/admin/articles/tags?result=empty");
  try {
    await prisma.tag.update({ where: { id }, data: { name } });
  } catch (error) {
    if (isUniqueViolation(error)) redirect("/admin/articles/tags?result=duplicate");
    throw error;
  }
  updateTag("articles");
  redirect("/admin/articles/tags?result=renamed");
}
