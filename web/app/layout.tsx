import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Link from "next/link"
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wizzy",
  description: "Quiz dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="sticky top-0 z-50 w-full bg-gradient-to-b from-black/70 to-transparent">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between py-6 px-8">
            <Link href="/" className="flex items-center gap-2 font-bold text-white">
              <span role="img" aria-label="wizard">🧙‍♂️</span>
              <span>Wizzy</span>
            </Link>
            <nav className="flex items-center gap-8">
              <a href="#features" className="text-white hover:underline">Features</a>
              <form action="/api/auth/logout" method="post">
                <button type="submit" className="underline text-sm text-white">
                  Logout
                </button>
              </form>
            </nav>
          </div>
        </header>
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
