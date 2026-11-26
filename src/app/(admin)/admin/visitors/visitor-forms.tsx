"use client";

import { useActionState } from "react";
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
  const [state, action, pending] = useActionState(pruneExpiredVisitorRecordsAction, idle);
  return (
    <form action={action} data-action="prune-visitor-records" className="admin-visitors__prune">
      <button type="submit" disabled={pending}>清理 24 个月前的访问记录</button>
      <Notice state={state} />
    </form>
  );
}

export function DeleteVisitorForm({ visitorId, email }: { visitorId: string; email: string }) {
  const [state, action, pending] = useActionState(deleteVisitorAccountAction, idle);
  return (
    <form
      action={action}
      data-action="delete-visitor"
      className="admin-visitor__delete"
      onSubmit={(event) => {
        if (!window.confirm(`确认删除 ${email} 及其全部登录和访问记录？此操作无法撤销。`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="visitorId" value={visitorId} />
      <button type="submit" disabled={pending} aria-label={`删除访客 ${email}`}>
        删除账号及记录
      </button>
      <Notice state={state} />
    </form>
  );
}
