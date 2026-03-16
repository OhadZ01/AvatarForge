import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AvatarForge — 3D Avatar Creator',
  description: 'Premium web-based 3D avatar creator with real-time customization',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-surface-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
