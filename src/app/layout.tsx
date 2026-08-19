import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SeleShop POS • Cerâmica Wabi-Sabi Edition',
  description: 'Sistema PWA de Punto de Venta, Gestión de Inventario y Control Bimonetario (USD/VES) Offline-First. Diseño accesible, limpio e intuitivo.',
  manifest: '/manifest.json',
  openGraph: {
    title: 'SeleShop POS • Control Bimonetario',
    description: 'Punto de Venta bimonetario intuitivo para bodegas y comercios.',
    siteName: 'SeleShop POS',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SeleShop POS',
  },
};

export const viewport: Viewport = {
  themeColor: '#A0522D',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-stone-950 text-stone-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
