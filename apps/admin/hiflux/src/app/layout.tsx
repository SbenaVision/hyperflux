import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "../components/Providers";
import { Nav } from "../components/Nav";

export const metadata: Metadata = {
  title: "HiFlux",
  description: "HyperFlux native admin — dogfood instance",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="hf-shell">
            <Nav />
            <div className="hf-body">
              <main className="hf-main">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
