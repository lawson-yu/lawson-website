"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { AdminIntlProvider } from "@/components/admin/admin-intl-provider";
import { VISITOR_RECORD_RETENTION_MONTHS } from "@/lib/visitor-retention";
import {
  deleteVisitorAccountAction,
  pruneExpiredVisitorRecordsAction,
  type VisitorAdminActionState,
} from "@/server/visitor-actions";

const idle: VisitorAdminActionState = { status: "idle" };

function Notice({ state }: { state: VisitorAdminActionState }) {
  if (!state.message) return null;
  return (
    <p className="admin-visitors__notice" role="status" data-status={state.status}>
      {state.message}
    </p>
  );
}

export function PruneVisitorRecordsForm() {
  return (
    <AdminIntlProvider>
      <PruneVisitorRecordsFormContent />
    </AdminIntlProvider>
  );
}

function PruneVisitorRecordsFormContent() {
  const t = useTranslations("Admin");
  const [state, action, pending] = useActionState(pruneExpiredVisitorRecordsAction, idle);
  return (
    <form action={action} data-action="prune-visitor-records" className="admin-visitors__prune">
      <button type="submit" disabled={pending}>{t("pruneVisitorRecords", { months: VISITOR_RECORD_RETENTION_MONTHS })}</button>
      <Notice state={state} />
    </form>
  );
}

export function DeleteVisitorForm({ visitorId, email }: { visitorId: string; email: string }) {
  return (
    <AdminIntlProvider>
      <DeleteVisitorFormContent visitorId={visitorId} email={email} />
    </AdminIntlProvider>
  );
}

function DeleteVisitorFormContent({ visitorId, email }: { visitorId: string; email: string }) {
  const t = useTranslations("Admin");
  const [state, action, pending] = useActionState(deleteVisitorAccountAction, idle);
  return (
    <form
      action={action}
      data-action="delete-visitor"
      className="admin-visitor__delete"
      onSubmit={(event) => {
        if (!window.confirm(t("confirmDeleteVisitor", { email }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="visitorId" value={visitorId} />
      <button type="submit" disabled={pending} aria-label={t("deleteVisitorLabel", { email })}>
        {t("deleteVisitor")}
      </button>
      <Notice state={state} />
    </form>
  );
}
