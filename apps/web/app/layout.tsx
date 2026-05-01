import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/navbar";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "Exchange",
  description: "Turborepo + Tailwind + shadcn/ui",
  icons: {
    icon: "https://cdn.dribbble.com/userupload/45977907/file/6c9ac88b0b8e86d0cabf474a21f187e6.jpg?resize=1600x1200&vertical=center",
    shortcut:
      "https://cdn.dribbble.com/userupload/45977907/file/6c9ac88b0b8e86d0cabf474a21f187e6.jpg?resize=1600x1200&vertical=center",
    apple:
      "https://cdn.dribbble.com/userupload/45977907/file/6c9ac88b0b8e86d0cabf474a21f187e6.jpg?resize=1600x1200&vertical=center",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
