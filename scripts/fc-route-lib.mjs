const MANAGED_PATHS = ["/mcp", "/mcp/*"];
const MANAGED_FUNCTION = "koushicare-public-information-mcp";

const normalizeRoute = (route) => {
  const normalized = {
    path: route.path,
    functionName: route.functionName,
    qualifier: route.qualifier || "LATEST",
    methods: [...(route.methods || [])]
  };

  // Function Compute returns RewriteConfig as a model instance. Keep the
  // existing value verbatim so adding the MCP routes cannot change another
  // application's domain routing behavior.
  if (route.rewriteConfig) normalized.rewriteConfig = route.rewriteConfig;
  return normalized;
};

export function mergeMcpRoutes(existingRoutes = []) {
  for (const route of existingRoutes) {
    if (MANAGED_PATHS.includes(route.path) && route.functionName !== MANAGED_FUNCTION) {
      throw new Error(`Refusing to replace existing ${route.path} route for ${route.functionName}`);
    }
  }

  const preserved = existingRoutes
    .filter((route) => !MANAGED_PATHS.includes(route.path))
    .map(normalizeRoute);
  const managed = MANAGED_PATHS.map((path) => ({
    path,
    functionName: MANAGED_FUNCTION,
    qualifier: "LATEST",
    methods: ["GET", "POST", "OPTIONS", "HEAD"]
  }));

  // Specific routes must precede a pre-existing catch-all route.
  return [...managed, ...preserved];
}

export const routeConstants = {MANAGED_PATHS, MANAGED_FUNCTION};
