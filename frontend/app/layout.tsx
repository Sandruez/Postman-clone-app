import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Postman Clone (API Client)",
  description: "Advanced API Client workspace and proxy request runner",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
