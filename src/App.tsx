import React, { useEffect, useState } from 'react';
import { PhoenixHeroGraphic } from './components/PhoenixHeroGraphic';
import { CertificateSection } from './components/CertificateSection';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  // Organizer page lives at  yoursite.vercel.app/#admin
  const [isAdmin, setIsAdmin] = useState<boolean>(window.location.hash === '#admin');

  useEffect(() => {
    const onHash = () => setIsAdmin(window.location.hash === '#admin');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden">
      {/* ── Background: Flying Phoenix Video & Embers Animation ── */}
      <PhoenixHeroGraphic />

      <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-6">
        {isAdmin ? <AdminPanel /> : <CertificateSection />}
      </main>
    </div>
  );
}
