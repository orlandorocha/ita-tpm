import type { Metadata, Viewport } from 'next'
import { Inter, Geist_Mono } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: 'Manutenção ITA',
  description: 'Sistema completo para gestão de manutenção industrial, ordens de serviço, equipamentos e equipes técnicas.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/pepsico-logo.png', sizes: 'any' },
      { url: '/pepsico-logo.png', type: 'image/svg+xml' },
    ],
    apple: '/pepsico-logo.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#248B9A',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground min-h-screen">
        {children}
      </body>
    </html>
  )
}
