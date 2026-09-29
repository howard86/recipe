import { appConfig } from "@workspace-template/data";
import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import "@workspace-template/ui/globals.css";
import { cn } from "@workspace-template/ui/lib/utils";
import { Providers } from "./providers";

const dmSans = DM_Sans({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-sans",
});

// Instrument Serif ships one weight: headings stay at 400, never faux-bold.
const instrumentSerif = Instrument_Serif({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-heading",
  weight: "400",
});

export const metadata: Metadata = {
  description: appConfig.description,
  title: appConfig.name,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={cn(
        "font-sans antialiased",
        dmSans.variable,
        instrumentSerif.variable
      )}
      lang="en"
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
