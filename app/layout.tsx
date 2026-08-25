import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://lucas-empred.martinha123.chatgpt.site'),
  title: 'Lucas EMPRED — Gestão de empréstimos',
  description: 'Gestão simples e segura de clientes, empréstimos e cobranças semanais.',
  openGraph: {
    title: 'Lucas EMPRED — Gestão de empréstimos',
    description: 'Gestão de empréstimos, simples e segura.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Lucas EMPRED' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lucas EMPRED — Gestão de empréstimos',
    description: 'Gestão de empréstimos, simples e segura.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
