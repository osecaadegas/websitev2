import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { SITE_NAME, SITE_DESCRIPTION, SITE_URL } from "@/lib/constants";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "casino streamer",
    "igaming",
    "bonus hunt",
    "slots",
    "SecaHub",
    "seca de adegas",
    "live stream",
    "casino bonus",
    "casino online portugal",
    "streamer casino",
    "Liga dos Secas",
    "torneio slots",
    "casino ao vivo",
  ],
  openGraph: {
    type: "website",
    locale: "pt_PT",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [{ url: "/images/og-image.jpg", width: 1200, height: 630, alt: SITE_NAME }],
    videos: [
      {
        url: `${SITE_URL}/hero.mp4`,
        secureUrl: `${SITE_URL}/hero.mp4`,
        type: "video/mp4",
        width: 1920,
        height: 1080,
      },
    ],
  },
  twitter: {
    card: "player",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/images/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large" as const,
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/images/fav/favicon.png", sizes: "192x192", type: "image/png" },
      { url: "/images/fav/favicon.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/images/fav/favicon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-arena-black text-arena-white">
        <AppShell>{children}</AppShell>
        {process.env.NEXT_PUBLIC_CHATBOT_ID && (
          <Script
            id="chatbase-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(){
  if(!window.chatbase||window.chatbase("getState")!=="initialized"){
    window.chatbase=(...args)=>{if(!window.chatbase.q){window.chatbase.q=[]}window.chatbase.q.push(args)};
    window.chatbase=new Proxy(window.chatbase,{get(t,p){if(p==="q")return t.q;return(...a)=>t(p,...a)}});
  }
  var s=document.createElement("script");
  s.src="https://www.chatbase.co/embed.min.js";
  s.id="${process.env.NEXT_PUBLIC_CHATBOT_ID}";
  s.defer=true;
  document.body.appendChild(s);
})();`,
            }}
          />
        )}
      </body>
    </html>
  );
}
