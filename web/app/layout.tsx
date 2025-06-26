import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="p-4 border-b">
          <a href="/" className="font-bold">Wizzy</a>
          <form className="float-right" action="/api/auth/logout" method="post">
            <button type="submit" className="underline text-sm">Logout</button>
          </form>
        </header>
        {children}
      </body>
    </html>
  );
}
