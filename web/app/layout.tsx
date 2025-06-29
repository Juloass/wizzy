import ErrorScreen from "@/components/error-screen";
import ProfileMenu from "@/components/profile-menu";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/auth";
import { tryWithError } from "@/lib/try-with-error";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

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
  children: React.ReactNode;
}>) {
  const [user, userError] = await tryWithError(() => getCurrentUser());

  if (userError) {
    return (
      <html lang="en" className="dark">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <ErrorScreen title="Database Unreachable" />
          <Toaster richColors />
        </body>
      </html>
    );
  }

  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased flex flex-col h-screen`}
      >
        <header className="w-full bg-[#9147FF]/20 flex-none">
          <div className="mx-auto flex items-center justify-between py-6 px-8">
            <Link
              href="/"
              className="flex items-center text-2xl gap-2 font-bold text-white"
            >
              <span role="img" aria-label="wizard">
                🧙‍♂️
              </span>
              <span className="font-bold">Wizzy</span>
            </Link>
            <nav className="flex items-center gap-8">
              <a href="#features" className="text-white hover:underline">
                Features
              </a>
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
  );
}
