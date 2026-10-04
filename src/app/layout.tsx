import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "A.P Realty Group Inc.",
  description: "Brokerage management for A.P Realty Group Inc.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
