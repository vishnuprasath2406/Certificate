import React from 'react';
import { PhoenixHeroGraphic } from './components/PhoenixHeroGraphic';
import { CertificateSection } from './components/CertificateSection';

export default function App() {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden">
      {/* ── Background: Flying Phoenix Video & Embers Animation ── */}
      <PhoenixHeroGraphic />

      {/* ── Certificate Section Content ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center py-6">
        <CertificateSection />
      </main>
    </div>
  );
}
