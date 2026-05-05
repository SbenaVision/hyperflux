import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "HyperFlux Admin",
  description: "Admin dashboard — vanilla benchmark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <Nav />
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
