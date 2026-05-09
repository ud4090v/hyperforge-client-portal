import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HyperForge Client Portal',
  description: 'Your gateway to HyperForge engineering services',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0a] text-[#ededed] antialiased">
        {children}
      </body>
    </html>
  )
}
