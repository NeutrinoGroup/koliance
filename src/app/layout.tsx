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
        "https://x.com",
      ],
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
