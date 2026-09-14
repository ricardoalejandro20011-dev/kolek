import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { brand } from '@/config/brand';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: `${brand.name} — ${brand.tagline}`,
    template: `%s · ${brand.name}`,
  },
  description:
    'Cobranza escolar preventiva para escuelas privadas de México: centraliza colegiaturas, automatiza recordatorios y concilia cada pago. Kínder, primaria, secundaria, prepa, universidad y academias.',
  keywords: [
    'cobranza escolar',
    'colegiaturas',
    'pagos escolares México',
    'cobranza preventiva',
    'software para escuelas',
  ],
  openGraph: {
    title: `${brand.name} — ${brand.tagline}`,
    description: 'Cobra colegiaturas sin perseguir pagos. Kolek automatiza recordatorios y concilia cada pago.',
    type: 'website',
    locale: 'es_MX',
    siteName: brand.name,
  },
  icons: {
    icon: [{ url: '/brand/kolek-icon.png', type: 'image/png' }],
    shortcut: '/brand/kolek-icon.png',
    apple: '/brand/kolek-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={inter.variable}>
      <body className="min-h-screen bg-white font-sans text-ink">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
