import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Link from "next/link"
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/auth"
import ProfileMenu from "@/components/profile-menu"
import ErrorScreen from "@/components/error-screen"
import { tryWithError } from "@/lib/try-with-error"

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [user, userError] = await tryWithError(() => getCurrentUser())
  if (userError) {
    return (
      <html lang="en" className="dark">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <ErrorScreen title="Database Unreachable" />
          <Toaster richColors />
        </body>
      </html>
    )
  }
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
              {user ? (
                <ProfileMenu user={user} />
              ) : (
                <Link href="/login" className="underline text-sm text-white">
                  Login
                </Link>
              )}
            </nav>
          </div>
        </header>
        {children}
        <Toaster richColors />
      </body>
    </html>
  )
}
