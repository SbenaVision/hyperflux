import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "../components/Nav";
import { Providers } from "../components/Providers";

export const metadata: Metadata = {
  title: "HyperFlux Admin",
  description: "HyperFlux benchmark admin dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="page-shell">
            <div className="container">{children}</div>
          </main>
        </Providers>
      </body>
    </html>
  );
}
