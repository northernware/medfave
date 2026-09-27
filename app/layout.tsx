import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * The two companion typefaces from the medfave guidelines, self-hosted from
 * their npm packages rather than fetched from Google at build time, so a build
 * never depends on reaching fonts.googleapis.com.
 */
const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const jakarta = localFont({
  src: "../node_modules/@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-jakarta",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "medfave",
    template: "%s · medfave",
  },
  description: "Appointments and medical records for family practice, organised by household.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fff9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#1d0b19" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
