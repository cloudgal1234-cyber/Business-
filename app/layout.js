import './globals.css';

export const metadata = {
  title: 'Investor Pitch Simulator — סימולטור פגישת משקיעים',
  description: 'תרגול פגישת משקיעים שמבוסס על האתר של העסק שלך: שאלות מותאמות, מאמן אישי, ציונים ודוח מוכנות.',
};

export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#4f46e5' };

export default function RootLayout({ children }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
