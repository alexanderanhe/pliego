export type Entitlement =
  | "save_projects"
  | "high_page_limit"
  | "advanced_effects"
  | "cloud_images"
  | "export_zip"
  | "remove_branding"
  | "priority_processing";
export type Account = {
  plan: "free" | "premium";
  planStatus: string;
  planExpiresAt?: string | Date | null;
  entitlements?: string[];
};
export const PLAN_LIMITS = {
  guest: { savedProjects: 0, maxPages: 12 },
  free: { savedProjects: 5, maxPages: 30 },
  premium: { savedProjects: 100, maxPages: 200 },
};
export const DOWNLOAD_REQUIRES_ACCOUNT = false;
export function activePlan(user: Account | null | undefined) {
  return !user
    ? "guest"
    : user.plan === "premium" &&
        ["active", "trialing"].includes(user.planStatus) &&
        (!user.planExpiresAt || new Date(user.planExpiresAt) > new Date())
      ? "premium"
      : "free";
}
export function canUseFeature(
  user: Account | null | undefined,
  feature: Entitlement,
) {
  if (!user) return false;
  if (feature === "save_projects") return true;
  return (
    activePlan(user) === "premium" &&
    (feature === "high_page_limit" ||
      user.entitlements?.includes(feature) === true)
  );
}
