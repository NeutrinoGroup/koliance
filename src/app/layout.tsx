import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#836EF9",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://koliance.vercel.app"),
  title: "Koliance | Decentralized Identity & Trust Infrastructure on Monad",
  description:
    "Next-generation verifiable on-chain identity and cryptographic trust attestations powered by Monad 10,000 TPS parallel EVM.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/brand-icon.png", type: "image/png" },
    ],
    apple: "/brand-icon.png",
  },
  openGraph: {
    title: "Koliance | Decentralized Identity & Trust Infrastructure",
    description: "Verifiable on-chain identity and trust attestations powered by Monad Testnet (10143).",
    url: "https://koliance.vercel.app",
    siteName: "Koliance",
    type: "website",
    images: [
      {
        url: "/brand-icon-512.png",
        width: 512,
        height: 512,
        alt: "Koliance Brand Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Koliance | Decentralized Identity & Trust Infrastructure on Monad",
    description:
      "Next-generation verifiable on-chain identity and cryptographic trust attestations powered by Monad.",
    images: ["/brand-icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://koliance.vercel.app/#website",
      url: "https://koliance.vercel.app",
      name: "Koliance",
      description:
        "Decentralized Identity & Cryptographic Trust Infrastructure on Monad parallel EVM.",
      publisher: {
        "@id": "https://koliance.vercel.app/#organization",
      },
    },
    {
      "@type": "Organization",
      "@id": "https://koliance.vercel.app/#organization",
      name: "Koliance",
      url: "https://koliance.vercel.app",
      logo: "https://koliance.vercel.app/brand-icon-512.png",
      sameAs: [
        "https://github.com/NeutrinoGroup/koliance",
        "https://github.com/moonhotline/koliance",
        "https://testnet.monadexplorer.com",
        "https://x.com",
      ],
      knowsAbout: [
        "Autonomous AI Agent Trust",
        "EIP-712 Delegated Session Keys",
        "Monad 10,000 TPS Parallel EVM",
        "On-Chain Agent Cards",
        "Decentralized Identity Infrastructure",
        "High-Frequency Perpetual Solvency",
      ],
      contactPoint: {
        "@type": "ContactPoint",
        email: "developer@koliance.io",
        contactType: "technical support",
        availableLanguage: ["English", "Chinese"],
      },
    },
    {
      "@type": "DefinedTermSet",
      "@id": "https://koliance.vercel.app/#glossary",
      name: "Koliance Protocol Technical Terms",
      hasDefinedTerm: [
        {
          "@type": "DefinedTerm",
          name: "Agent Card",
          description: "Dynamic neural identity NFT verifiable on-chain, aggregating developer commits, social proofs, and capability scores on Monad.",
        },
        {
          "@type": "DefinedTerm",
          name: "EIP-712 Session Key",
          description: "Cryptographically delegated spending authority enabling autonomous AI agents to transact on-chain with strict per-transaction and daily USD ceilings.",
        },
        {
          "@type": "DefinedTerm",
          name: "Monad Parallel EVM",
          description: "High-throughput blockchain execution layer delivering 10,000 TPS and 1-second finality on Chain ID 10143.",
        },
        {
          "@type": "DefinedTerm",
          name: "KOL Token",
          description: "Native protocol utility and governance token with a 2^30 fixed max supply, piecewise halving schedule, and staking rewards.",
        },
      ],
    },
    {
      "@type": "Dataset",
      "@id": "https://koliance.vercel.app/#market-dataset",
      name: "Koliance Multi-Asset Oracle Quotes",
      description: "Real-time Alpaca and Pyth high-frequency market quotes and verifiable on-chain solvency metrics.",
      license: "https://opensource.org/licenses/MIT",
      creator: {
        "@id": "https://koliance.vercel.app/#organization",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://koliance.vercel.app/#software",
      name: "Koliance Protocol",
      applicationCategory: "BlockchainApplication",
      operatingSystem: "Web3 / EVM (Monad)",
      description:
        "Next-generation verifiable on-chain identity and cryptographic trust attestations powered by Monad 10,000 TPS parallel EVM.",
      offers: [
        {
          "@type": "Offer",
          name: "Starter Free Trial",
          price: "0",
          priceCurrency: "USD",
          url: "https://koliance.vercel.app/pricing",
          description: "100 API Calls Included per claim with 3 free claims per account",
        },
        {
          "@type": "Offer",
          name: "Growth Pro",
          price: "19.90",
          priceCurrency: "USD",
          url: "https://koliance.vercel.app/pricing",
          description: "10,000 API Calls Included with 300 RPM Peak Concurrency",
        },
        {
          "@type": "Offer",
          name: "Enterprise Scale",
          price: "149.00",
          priceCurrency: "USD",
          url: "https://koliance.vercel.app/pricing",
          description: "100,000 API Calls Included with 1,200 RPM Dedicated Queue",
        },
      ],
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        ratingCount: "128",
        bestRating: "5",
        worstRating: "1",
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://koliance.vercel.app/#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is Koliance?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Koliance is a decentralized identity and cryptographic trust infrastructure built on Monad parallel EVM. It enables verifiable social attestations, on-chain developer verification, and autonomous agent identities.",
          },
        },
        {
          "@type": "Question",
          name: "How does Koliance benefit from Monad parallel EVM?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Monad delivers 10,000 TPS and 1-second finality, providing Koliance with instantaneous attestation minting, low gas costs, and seamless high-frequency trust endorsements.",
          },
        },
        {
          "@type": "Question",
          name: "What are Koliance Agent Cards?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Agent Cards are cryptographically signed, dynamic neural identity cards that aggregate developer reputation, social proofs, and AI agent capability scores on-chain.",
          },
        },
        {
          "@type": "Question",
          name: "How does EIP-712 Session Key Delegation work in Koliance?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Koliance enables autonomous AI agents to execute transactions without holding human master private keys. Users sign an EIP-712 structured delegation grant bound by strict maxPerTxUSD and dailyLimitUSD ceilings, enforced by SessionKeyRegistry.sol with instant on-chain circuit breakers.",
          },
        },
        {
          "@type": "Question",
          name: "What are the Koliance API pricing packages and is there a free trial?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Koliance offers three predictable tiers: Starter Pack ($0.00 with 3 free claims / 300 calls total, 60 RPM), Growth Pro ($19.90 for 10,000 calls, 300 RPM, 15% discount when paying via KOL token), and Enterprise Scale ($149.00 for 100,000 calls, 1,200 RPM dedicated queue).",
          },
        },
        {
          "@type": "Question",
          name: "What official smart contracts are deployed on Monad Testnet?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "On Monad Testnet (Chain ID 10143), Koliance deploys: Core Trust Registry (0x6291C790dbB41198c69781B2B7a01d674843b0C5), SessionKeyRegistry (0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D), and PositionManager (0x3fCeD0662657e0C3a2aF8A80e3A4cDb8A7d1d2C4).",
          },
        },
        {
          "@type": "Question",
          name: "What is the Koliance refund and vulnerability disclosure policy?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Koliance offers a 14-day pro-rata refund window for unconsumed API subscription quotas by emailing developer@koliance.io. For security researchers, Koliance enforces a 48-hour SLA Safe Harbor responsible disclosure policy.",
          },
        },
      ],
    },
  ],
};

import { I18nProvider } from "@/lib/i18n";
import { Providers } from "@/components/Providers";
import { KolianceAuthProvider } from "@/components/KolianceAuthProvider";
import { GoogleAuthCallback } from "@/components/GoogleAuthCallback";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="author" href="/llms.txt" />
        <link rel="alternate" type="text/plain" href="/llms-full.txt" title="Full LLM Knowledge Base" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased selection:bg-monad-500 selection:text-white">
        {/* SSR Semantic Content for Search Engines and AI Crawlers (Non-intrusive) */}
        <noscript>
          <div style={{ padding: "2rem", backgroundColor: "#0d1017", color: "#f3f4f6" }}>
            <h1>Koliance — Decentralized Identity &amp; Trust Infrastructure on Monad</h1>
            <p>
              Next-generation verifiable on-chain identity and cryptographic trust attestations powered by Monad 10,000 TPS parallel EVM.
            </p>
            <h2>Core Features</h2>
            <ul>
              <li><strong>Agent Cards:</strong> Verifiable neural identity passports with on-chain reputation scoring.</li>
              <li><strong>Universal Identity Linkage:</strong> Seamless verification across Web3 wallets, Google OAuth 2.0, GitHub, and Steam.</li>
              <li><strong>Developer Wall:</strong> Cryptographic proof of GitHub commits, repository stars, and open-source contributions.</li>
              <li><strong>Steam Gaming Attestation:</strong> On-chain verification of gamer reputation and game achievements.</li>
              <li><strong>Monad Parallel EVM Speed:</strong> Sub-second finality with zero latency and negligible gas fees.</li>
            </ul>
            <h2>Transparent SaaS Capacity &amp; Pricing</h2>
            <ul>
              <li><strong>Starter Pack:</strong> $0.00 forever (100 API Calls per claim, up to 3 claims / 300 calls total, 60 RPM, EIP-712 Session Key support).</li>
              <li><strong>Growth Pro:</strong> $19.90 (10,000 API Calls, 300 RPM Peak Concurrency, -15% with KOL token, 99.9% Uptime SLA).</li>
              <li><strong>Enterprise Scale:</strong> $149.00 (100,000 API Calls, 1,200 RPM Dedicated Queue, custom Monad execution lane, 99.98% SLA).</li>
            </ul>
            <h2>Authoritative Smart Contracts on Monad Testnet (Chain ID 10143)</h2>
            <ul>
              <li><strong>Core Trust Registry:</strong> <code>0x6291C790dbB41198c69781B2B7a01d674843b0C5</code></li>
              <li><strong>SessionKeyRegistry (EIP-712):</strong> <code>0xCb7f01F6E9B9b33aC5161FEaA28eB8Ce3b5fB09D</code></li>
              <li><strong>PositionManager (Perp Engine):</strong> <code>0x3fCeD0662657e0C3a2aF8A80e3A4cDb8A7d1d2C4</code></li>
            </ul>
            <h2>AI &amp; Generative Engine Documentation</h2>
            <p>
              Machine-readable roadmaps and complete technical context are available for AI models and search indexers at <a href="/llms.txt">/llms.txt</a> and <a href="/llms-full.txt">/llms-full.txt</a>.
            </p>
            <h2>Frequently Asked Questions</h2>
            <h3>What is Koliance?</h3>
            <p>Koliance is an open decentralized identity protocol that bridges AI agents, Web3 accounts, and developer credentials onto the Monad blockchain.</p>
            <h3>What chain does Koliance run on?</h3>
            <p>Koliance is deployed on Monad Testnet (Chain ID: 10143) with native MON gas token support.</p>
          </div>
        </noscript>
        <I18nProvider>
          <Providers>
            {/* Account state sits above the Privy/Wagmi providers so the navbar
                and the OAuth walls (both inside `children`) share one writer. */}
            <KolianceAuthProvider>
              {/* Completes a Google sign-in wherever Google lands. It has to sit
                  in the layout rather than on a page: the registered redirect
                  URI is the site root, so the callback arrives at `/` whatever
                  page the user clicked "Sign In" from, and a handler that lives
                  on one page is a handler that is usually not mounted when the
                  code arrives (issue #34, second round). It is inside
                  `KolianceAuthProvider` so the profile it records notifies the
                  navbar in the same tree. */}
              <GoogleAuthCallback />
              {children}
            </KolianceAuthProvider>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
