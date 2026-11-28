export function isSiteOwner(
  email: string | null | undefined,
  emailVerified: boolean,
  configuredEmails = process.env.ADMIN_EMAILS ?? "",
) {
  if (!email || !emailVerified) return false;
  const allowlist = configuredEmails
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.trim().toLowerCase());
}
