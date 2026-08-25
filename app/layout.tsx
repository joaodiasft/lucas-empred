import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://lucas-empred.martinha123.chatgpt.site'),
  title: 'Lucas EMPRED — Gestão de empréstimos',
  description: 'Cadastro de clientes com foto, endereço, localização e três referências de contato.',
  openGraph: {
    title: 'Lucas EMPRED — Gestão de empréstimos',
    description: 'Gestão de empréstimos com foto do cliente, GPS e referências no WhatsApp.',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Lucas EMPRED' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lucas EMPRED — Gestão de empréstimos',
    description: 'Gestão de empréstimos com foto, endereço e referências.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
