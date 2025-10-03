import clsx from "clsx";
import "@unocss/reset/tailwind.css";
import type { Metadata } from "next";
import { IBM_Plex_Mono, Roboto_Mono } from "next/font/google";

import "./global.css";
import Provider from "../providers";

const defaultFont = Roboto_Mono({
  variable: "--font-default",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "RhivaLens",
  description:
    "This tool was created to support your DLMM journey at saros.xyz",
  openGraph: {
    images: ["https://lens.rhiva.fun/illustration.png"],
  },
};

export default function RootLayout({ children }: React.PropsWithChildren) {
  return (
    <html
      className={clsx(defaultFont.variable, mono.variable)}
      lang="en"
    >
      <body className="absolute inset-0 flex flex-col bg-dark text-white text-sm font-[var(--font-default)]">
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
