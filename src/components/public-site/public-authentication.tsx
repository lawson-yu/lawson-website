"use client";

import { createAuthClient } from "better-auth/react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

const authClient = createAuthClient();

export function usePublicAuthentication() {
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

  const signInButton = (
    <button
      className="public-authentication__sign-in"
      type="button"
      onClick={signIn}
      disabled={busy}
    >
      {t("signIn")}
    </button>
  );

  if (session?.user) {
    return {
      status: (
        <div className="public-authentication__status">
          <span>{t("signedIn")}</span>
          <SignOutButton label={t("signOut")} />
        </div>
      ),
    };
  }

  return {
    menu: (
      <div className="public-authentication__menu">
        {signInButton}
        {authError && <p role="status">{t("googleUnavailable")}</p>}
      </div>
    ),
    prompt: (promptVisible || authError) && (
      <aside className="public-login-prompt" aria-label={t("loginPromptLabel")}>
        <p role={authError ? "status" : undefined}>{authError ? t("googleUnavailable") : t("loginPrompt")}</p>
        {signInButton}
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
    ),
  };
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
