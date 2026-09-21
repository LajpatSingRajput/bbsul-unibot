import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "BBSUL UniBot | Smart Campus Assistant",
  description:
    "A knowledge-first campus assistant for BBSUL students and faculty.",
  icons: {
    icon: "/logo.jpg",
    apple: "/logo.jpg",
    shortcut: "/logo.jpg",
  },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
