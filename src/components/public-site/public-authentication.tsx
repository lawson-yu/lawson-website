"use client";

import { createAuthClient } from "better-auth/react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const authClient = createAuthClient();

export function PublicAuthentication() {
  const t = useTranslations("Navigation");
  const { data: session } = authClient.useSession();
  const [promptVisible, setPromptVisible] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setAuthError(false);
    try {
      const currentUrl = new URL(window.location.href);
      const next = currentUrl.searchParams.get("next");
      const callbackURL =
        next?.startsWith("/") && !next.startsWith("//")
          ? new URL(next, window.location.origin).toString()
          : currentUrl.toString();
      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      });
      if (result.error) setAuthError(true);
    } catch {
      setAuthError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="public-authentication">
      {session?.user ? (
        <div className="public-authentication__status">
          <span>{t("signedIn")}</span>
          <SignOutButton label={t("signOut")} />
        </div>
      ) : (
        <button
          className="public-authentication__sign-in"
          type="button"
          onClick={signIn}
          disabled={busy}
        >
          {t("signIn")}
        </button>
      )}
      {!session?.user && (promptVisible || authError) && (
        <aside className="public-login-prompt" aria-label={t("loginPromptLabel")}>
          {promptVisible && <p>{t("loginPrompt")}</p>}
          {authError && <p role="status">{t("googleUnavailable")}</p>}
          <button
            className="public-login-prompt__close"
            type="button"
            aria-label={t("dismissLoginPrompt")}
            onClick={() => {
              setPromptVisible(false);
              setAuthError(false);
            }}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </aside>
      )}
    </div>
  );
}

export function SignOutButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await authClient.signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={signOut} disabled={busy}>
      {label}
    </button>
  );
}
