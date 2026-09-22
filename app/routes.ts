import { type RouteConfig, index, route } from "@react-router/dev/routes";
export default [
  index("routes/home.tsx"),
  route("editor", "routes/editor.tsx"),
  route("calibration", "routes/calibration.tsx"),
  route("login", "routes/login.tsx"),
  route("verify", "routes/verify.tsx"),
  route("dashboard", "routes/dashboard.tsx"),
  route("projects/:projectId", "routes/project.tsx"),
  route("settings", "routes/settings.tsx"),
  route("logout", "routes/logout.tsx"),
  route("premium", "routes/premium.tsx"),
  route("privacy", "routes/privacy.tsx"),
  route("terms", "routes/terms.tsx"),
  route("api/projects", "routes/api-projects.ts"),
  route("api/export", "routes/api-export.ts"),
] satisfies RouteConfig;
