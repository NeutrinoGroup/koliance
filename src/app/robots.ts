import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://koliance.vercel.app";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/auth/", "/api/user/"],
      },
      {
        // Generative Engine Optimization (GEO): Full public index access for leading AI crawlers
        userAgent: [
          "GPTBot",
          "ChatGPT-User",
          "OAI-SearchBot",
          "ClaudeBot",
          "anthropic-ai",
          "Claude-Web",
          "PerplexityBot",
          "Google-Extended",
          "GoogleOther",
          "Applebot-Extended",
          "cohere-ai",
          "Meta-ExternalAgent",
          "FacebookBot",
          "DuckAssistBot",
          "Amazonbot",
          "Bytespider",
          "CCBot",
        ],
        allow: ["/", "/pricing", "/docs", "/terms", "/privacy", "/refund", "/market", "/perp", "/agentcard", "/token", "/llms.txt", "/llms-full.txt"],
        disallow: ["/api/auth/", "/api/user/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
