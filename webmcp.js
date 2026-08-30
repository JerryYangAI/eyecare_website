(function () {
  "use strict";

  // The current WebMCP draft exposes ModelContext on document. Keep the
  // navigator/provideContext fallbacks because deployed agent runtimes and
  // readiness scanners may implement an earlier draft.
  const modelContext = (typeof document !== "undefined" && document.modelContext) || navigator.modelContext;
  if (!modelContext) return;

  const json = async (path) => {
    const response = await fetch(path, {headers: {Accept: "application/json"}});
    if (!response.ok) throw new Error("Koushicare public data is temporarily unavailable");
    return response.json();
  };

  const textResult = (value) => ({
    content: [{type: "text", text: JSON.stringify(value, null, 2)}]
  });

  const tools = [
    {
      name: "get_koushicare_product_facts",
      description: "Get official, public facts and usage boundaries for the Koushicare red-light eye care device.",
      inputSchema: {type: "object", properties: {}, additionalProperties: false},
      execute: async () => textResult(await json("/api/v1/product.json"))
    },
    {
      name: "compare_eye_care_methods",
      description: "Compare steam, moist heat, dry heat, and red-light plus constant heat using Koushicare's public guide.",
      inputSchema: {type: "object", properties: {}, additionalProperties: false},
      execute: async () => textResult(await json("/api/v1/comparisons.json"))
    },
    {
      name: "search_koushicare_site",
      description: "Search the Koushicare public website index and return relevant official pages.",
      inputSchema: {
        type: "object",
        properties: {query: {type: "string", minLength: 1, maxLength: 120}},
        required: ["query"],
        additionalProperties: false
      },
      execute: async ({query}) => {
        const data = await json("/api/v1/content-index.json");
        const terms = String(query).toLowerCase().split(/\s+/).filter(Boolean);
        const matches = data.records.filter((record) => {
          const haystack = [record.title, record.summary, ...(record.keywords || [])].join(" ").toLowerCase();
          return terms.some((term) => haystack.includes(term));
        }).slice(0, 5);
        return textResult({query, matches});
      }
    },
    {
      name: "get_koushicare_faq",
      description: "Get official frequently asked questions about product principles, use, care paths, and boundaries.",
      inputSchema: {type: "object", properties: {}, additionalProperties: false},
      execute: async () => textResult(await json("/api/v1/faq.json"))
    }
  ];

  if (typeof modelContext.provideContext === "function") {
    modelContext.provideContext({tools});
    return;
  }

  if (typeof modelContext.registerTool !== "function") return;
  const controller = new AbortController();
  for (const tool of tools) modelContext.registerTool(tool, {signal: controller.signal});
  window.addEventListener("pagehide", () => controller.abort(), {once: true});
})();
