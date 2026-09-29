import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  description: "Maison-style full-stack starter for Howard agent projects.",
  title: "Workspace Template",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className={inter.variable} lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
