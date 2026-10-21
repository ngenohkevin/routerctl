import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import { SwRegister } from '@/components/sw-register';
import { RAIL_SCRIPT } from '@/lib/rail';
import './globals.css';

// IBM Plex: an engineering typeface for an instrument panel — the mono cut
// carries IPs, MACs and live rates with tabular figures.
const plexSans = IBM_Plex_Sans({
  variable: '--font-plex-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const plexMono = IBM_Plex_Mono({
  variable: '--font-plex-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'RouterCtl - Router Management Dashboard',
  description: 'Manage your MikroTik router - devices, bandwidth, and more',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RouterCtl',
  },
};

// Next 16 requires themeColor/viewport in a dedicated viewport export;
// keeping it in `metadata` silently drops it.
export const viewport: Viewport = {
  themeColor: '#121419',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the rail script below sets data-rail on <html> before React hydrates.
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script dangerouslySetInnerHTML={{ __html: RAIL_SCRIPT }} />
      </head>
      <body
        className={`${plexSans.variable} ${plexMono.variable} antialiased min-h-screen bg-background`}
      >
        {children}
        <Toaster theme="dark" position="top-center" richColors closeButton={false} />
        <SwRegister />
      </body>
    </html>
  );
}
