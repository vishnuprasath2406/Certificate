import React, { useEffect, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import {
  Download,
  CheckCircle2,
  RotateCcw,
  Award,
  Calendar,
  Check,
  Share2,
} from 'lucide-react';

/* Categories & Events matching PIXEL-3.O */
export const CATEGORIES: Record<string, string[]> = {
  Technical: ['PaperQuest', 'AI FilmForge'],
  'Non-Technical': ['Checkmate', 'Mime Relay'],
};

const TEMPLATE_PATHS = [
  '/Participation.png',
  '/participation.png',
  '/Certificate-template.png',
  '/certificate-template.png',
];

/* Coordinates measured on the 3456 x 2304 certificate template, converted to a
   1536 x 1024 design grid (the code scales to any 3:2 image).
   y = text baseline, sitting just above each blue underline.
   To nudge a field: increase y to move it DOWN, decrease to move it UP;
   increase cx to move it RIGHT, decrease to move it LEFT. */
const FIELDS = {
  name: { cx: 970, y: 634, w: 1020, size: 42, style: 'italic 700' },
  college: { cx: 806, y: 711, w: 1350, size: 34, style: '700' },
  event: { cx: 677, y: 787, w: 425, size: 34, style: '700' },
};

const INK_COLOR = '#0a1e6e';
const SERIF_FONT = '"Times New Roman", Times, "Liberation Serif", serif';

export interface Person {
  name: string;
  college: string;
  event: string;
}

const tidyName = (s: string) => {
  if (!s) return '';
  if (s === s.toLowerCase() || s === s.toUpperCase()) {
    return s.toLowerCase().replace(/(^|[\s.])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  }
  return s;
};

/* Phoenix touch: embers and feathers rising from the bottom of the screen */
function phoenixBurst() {
  try {
    const feather = confetti.shapeFromPath({
      path: 'M10 0 C18 6 18 16 10 30 C2 16 2 6 10 0 Z',
    });
    const colors = ['#FF6A00', '#E51B23', '#FFC21A', '#E0008A'];
    confetti({
      particleCount: 70,
      angle: 90,
      spread: 100,
      startVelocity: 55,
      gravity: 0.7,
      scalar: 1.4,
      ticks: 260,
      origin: { x: 0.5, y: 1 },
      shapes: [feather, 'circle'],
      colors,
    });
    confetti({
      particleCount: 30,
      angle: 90,
      spread: 160,
      startVelocity: 35,
      gravity: 0.4,
      scalar: 0.8,
      ticks: 320,
      origin: { x: 0.5, y: 0.9 },
      shapes: ['circle'],
      colors,
    });
  } catch {
    // ignore
  }
}

function loadTemplateImage(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    let index = 0;
    const tryNext = () => {
      if (index >= TEMPLATE_PATHS.length) {
        resolve(null);
        return;
      }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        index++;
        tryNext();
      };
      img.src = TEMPLATE_PATHS[index];
    };
    tryNext();
  });
}

export const CertificateSection: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [college, setCollege] = useState<string>('');
  const [chosenPerson, setChosenPerson] = useState<Person | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState<boolean>(false);
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const templateImgRef = useRef<HTMLImageElement | null>(null);

  // Preload certificate template image
  useEffect(() => {
    loadTemplateImage().then((img) => {
      templateImgRef.current = img;
    });
  }, []);

  // Render certificate on canvas with precise alignment
  const renderCertificate = async (person: Person) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);

    let templateImg = templateImgRef.current;
    if (!templateImg) {
      templateImg = await loadTemplateImage();
      templateImgRef.current = templateImg;
    }

    if (!templateImg) {
      setIsDrawing(false);
      return;
    }

    canvas.width = templateImg.naturalWidth || 1536;
    canvas.height = templateImg.naturalHeight || 1024;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsDrawing(false);
      return;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

    const scale = canvas.width / 1536;

    const drawField = (field: typeof FIELDS.name, text: string) => {
      if (!text || !text.trim()) return;

      let currentSize = field.size * scale;
      const targetWidth = field.w * scale;

      ctx.save();
      ctx.fillStyle = INK_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      do {
        ctx.font = `${field.style} ${currentSize}px ${SERIF_FONT}`;
        currentSize -= 1;
      } while (ctx.measureText(text).width > targetWidth && currentSize > 14);

      ctx.fillText(text, field.cx * scale, field.y * scale);
      ctx.restore();
    };

    drawField(FIELDS.name, tidyName(person.name));
    drawField(FIELDS.college, person.college);
    drawField(FIELDS.event, person.event);

    setIsDrawing(false);
  };

  // Re-draw whenever a new certificate is generated
  useEffect(() => {
    if (chosenPerson) {
      renderCertificate(chosenPerson);
    }
  }, [chosenPerson]);

  const canGenerate =
    selectedEvent !== '' && nameInput.trim().length >= 2 && college.trim().length >= 2;

  const handleGenerate = () => {
    if (!canGenerate) return;
    setChosenPerson({
      name: nameInput.trim(),
      college: college.trim(),
      event: selectedEvent,
    });
    setHasDownloaded(false);
    phoenixBurst();
  };

  const handleReset = () => {
    setChosenPerson(null);
    setNameInput('');
    setHasDownloaded(false);
  };

  const certificateFileName = chosenPerson
    ? `${tidyName(chosenPerson.name)} - ${chosenPerson.event} - PIXEL3.O Certificate`
    : 'PIXEL-3.O-Certificate';

  const markDownloaded = () => {
    setHasDownloaded(true);
    phoenixBurst();
  };

  const handleDownloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDownloadingPng(true);
    try {
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      link.download = `${certificateFileName}.png`;
      link.href = dataUrl;
      link.click();
      markDownloaded();
    } catch (err) {
      console.error('Download PNG failed', err);
    } finally {
      setIsDownloadingPng(false);
    }
  };

  const handleDownloadPdf = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDownloadingPdf(true);
    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.96);
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${certificateFileName}.pdf`);
      markDownloaded();
    } catch (err) {
      console.error('Download PDF failed', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareMessage = chosenPerson
    ? `I just collected my ${chosenPerson.event} certificate at PIXEL 3.0, Adhiparasakthi Engineering College! 🔥`
    : '';
  const canNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;
  const handleNativeShare = () => {
    navigator
      .share({ title: 'PIXEL 3.0 Certificate', text: shareMessage, url: siteUrl })
      .catch(() => {});
  };
  const shareBtn =
    'px-4 py-2 rounded-full text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 inline-flex items-center gap-1.5 transition-colors';

  const isTech = selectedCategory === 'Technical';

  return (
    <div className="relative z-10 w-full max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* ── HEADER BANNER ── */}
      <div className="text-center mb-8 space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/60 border border-phoenix-orange/40 backdrop-blur-md text-[11px] sm:text-xs font-bold tracking-wider text-white uppercase shadow-phoenix-glow">
          <span className="w-2 h-2 rounded-full bg-phoenix-orange animate-ping" />
          <span>ADHIPARASAKTHI ENGINEERING COLLEGE</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white select-none">
          <span>PIXEL</span>
          <span className="bg-gradient-to-r from-phoenix-orange via-phoenix-red to-phoenix-magenta bg-clip-text text-transparent">
            -3.O
          </span>{' '}
          <span className="text-white/90">E-CERTIFICATE</span>
        </h1>

        <p className="text-xs sm:text-sm text-white/70 max-w-xl mx-auto font-medium">
          Official Participation E-Certificate Portal · Department of Computer Science &amp;
          Engineering · Department of Computer Science &amp; Design · In Association with CSI
          Kanchipuram Chapter
        </p>

        <div className="flex items-center justify-center gap-4 text-[11px] sm:text-xs text-phoenix-gold font-semibold pt-1">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-phoenix-orange" /> 14 OCTOBER 2026
          </span>
          <span className="text-white/30">•</span>
          <span className="flex items-center gap-1">
            <Award className="w-3.5 h-3.5 text-phoenix-red" /> VERIFIED PARTICIPATION
          </span>
        </div>
      </div>

      {/* ── MAIN CARD (Glassmorphic) ── */}
      <div className="bg-[#0f0f13]/85 backdrop-blur-xl rounded-3xl border border-white/15 shadow-2xl p-6 sm:p-8 space-y-8">
        {/* STEP 1: CATEGORY SELECTION */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-phoenix-orange text-black text-xs font-black">
                  1
                </span>
                SELECT CATEGORY
              </h2>
              <p className="text-xs text-white/60 ml-8">
                Choose whether you participated in a Technical or Non-Technical arena
              </p>
            </div>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('');
                  setSelectedEvent('');
                  handleReset();
                }}
                className="text-[11px] font-semibold text-white/50 hover:text-phoenix-orange flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {Object.keys(CATEGORIES).map((c) => {
              const isSelected = selectedCategory === c;
              const isTechCat = c === 'Technical';
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(c);
                    setSelectedEvent('');
                    setChosenPerson(null);
                    setHasDownloaded(false);
                  }}
                  className={`p-4 sm:p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer relative overflow-hidden group ${
                    isSelected
                      ? isTechCat
                        ? 'border-phoenix-orange bg-phoenix-orange/15 shadow-phoenix-glow ring-2 ring-phoenix-orange/30'
                        : 'border-phoenix-magenta bg-phoenix-magenta/15 shadow-phoenix-active ring-2 ring-phoenix-magenta/30'
                      : 'border-white/10 bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.06]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-extrabold tracking-widest uppercase ${
                        isTechCat ? 'text-phoenix-orange' : 'text-phoenix-magenta'
                      }`}
                    >
                      {c} ARENA
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <div className="text-base sm:text-lg font-bold text-white mt-1">
                    {c} Events
                  </div>
                  <div className="text-xs text-white/50 mt-1 flex items-center gap-2">
                    <span>{CATEGORIES[c].join(' • ')}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* STEP 2: EVENT SELECTION */}
        {selectedCategory && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-3">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-phoenix-red text-white text-xs font-black">
                  2
                </span>
                SELECT YOUR EVENT
              </h2>
              <p className="text-xs text-white/60 ml-8">
                Choose the specific competition event you took part in
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES[selectedCategory].map((e) => {
                const isSelected = selectedEvent === e;
                return (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setSelectedEvent(e);
                      setChosenPerson(null);
                      setHasDownloaded(false);
                    }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all duration-200 flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? isTech
                          ? 'border-phoenix-orange bg-phoenix-orange/20 shadow-phoenix-glow'
                          : 'border-phoenix-magenta bg-phoenix-magenta/20 shadow-phoenix-active'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/30'
                    }`}
                  >
                    <div>
                      <span className="text-sm sm:text-base font-bold text-white uppercase tracking-wider block">
                        {e}
                      </span>
                      <span className="text-[11px] text-white/50">
                        {isTech ? 'Technical Competition' : 'Non-Technical Arena'}
                      </span>
                    </div>
                    {isSelected && (
                      <CheckCircle2
                        className={`w-5 h-5 shrink-0 ${
                          isTech ? 'text-phoenix-orange' : 'text-phoenix-magenta'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: ENTER NAME → GENERATE */}
        {selectedEvent && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-3">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-phoenix-gold text-black text-xs font-black">
                  3
                </span>
                ENTER YOUR DETAILS
              </h2>
              <p className="text-xs text-white/60 ml-8">
                Type your name and college exactly as you want them printed on your {selectedEvent} certificate
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={nameInput}
                maxLength={60}
                onChange={(e) => {
                  setNameInput(e.target.value);
                  setChosenPerson(null);
                  setHasDownloaded(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleGenerate();
                }}
                placeholder="Your full name"
                autoComplete="off"
                className="w-full px-5 py-3.5 rounded-2xl border border-white/20 text-sm font-semibold text-white bg-white/[0.06] placeholder:text-white/40 focus:outline-none focus:border-phoenix-orange focus:ring-2 focus:ring-phoenix-orange/30 transition-all shadow-inner"
              />

              <label className="block text-[11px] font-semibold text-white/60">
                College name
                <input
                  type="text"
                  value={college}
                  maxLength={80}
                  onChange={(e) => {
                    setCollege(e.target.value);
                    setChosenPerson(null);
                    setHasDownloaded(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGenerate();
                  }}
                  placeholder="Your college name"
                  autoComplete="off"
                  className="mt-1 w-full px-5 py-3 rounded-2xl border border-white/15 text-sm font-semibold text-white bg-white/[0.04] focus:outline-none focus:border-phoenix-orange transition-all"
                />
              </label>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canGenerate}
                className="phoenix-gradient-btn w-full py-4 rounded-full text-white font-extrabold tracking-wider uppercase text-sm shadow-phoenix-glow disabled:opacity-40 cursor-pointer"
              >
                Generate My Certificate
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: CERTIFICATE PREVIEW & DOWNLOAD */}
        {chosenPerson && (
          <div className="animate-in fade-in duration-300 space-y-6 pt-2 border-t border-white/10">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 block">
                    Your certificate is ready
                  </span>
                  <span className="text-sm font-bold text-white">
                    {tidyName(chosenPerson.name)} · {chosenPerson.event}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-full text-xs font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
              >
                Start Over
              </button>
            </div>

            {/* Live Canvas Certificate Preview */}
            <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black/50 p-2 sm:p-3">
              <div
                className={`relative w-full aspect-[1536/1024] bg-white rounded-xl overflow-hidden transition-all duration-1000 ${
                  isDrawing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
                }`}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain block"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              </div>
            </div>

            {/* DOWNLOAD ACTIONS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={isDownloadingPng}
                className="phoenix-gradient-btn py-4 px-6 rounded-full text-white font-extrabold tracking-wider uppercase text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-phoenix-glow cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloadingPng ? 'Generating PNG…' : 'Download PNG Certificate'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="phoenix-secondary-btn py-4 px-6 rounded-full text-white font-extrabold tracking-wider uppercase text-xs sm:text-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-phoenix-orange" />
                <span>{isDownloadingPdf ? 'Generating PDF…' : 'Download PDF Certificate'}</span>
              </button>
            </div>

            {/* THANK-YOU NOTE + SHARE (shown after a download) */}
            {hasDownloaded && (
              <div
                role="status"
                className="animate-in fade-in duration-500 p-5 rounded-2xl bg-phoenix-orange/10 border border-phoenix-orange/40 text-center space-y-1"
              >
                <Award className="w-6 h-6 text-phoenix-gold mx-auto" />
                <p className="text-base sm:text-lg font-extrabold text-white">
                  Thank you for participating in PIXEL 3.0!
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-3">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`${shareMessage} ${siteUrl}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={shareBtn}
                  >
                    <Share2 className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(siteUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={shareBtn}
                  >
                    <Share2 className="w-3.5 h-3.5" /> LinkedIn
                  </a>
                  {canNativeShare && (
                    <button type="button" onClick={handleNativeShare} className={shareBtn}>
                      <Share2 className="w-3.5 h-3.5" /> More…
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── FOOTER CREDITS ── */}
      <div className="text-center mt-12 text-xs text-white/40 space-y-1">
        <p>PIXEL-3.O · National Level Technical Symposium · 14 October 2026</p>
        <p>
          Department of Computer Science and Engineering &amp; Department of Computer Science and
          Design · Adhiparasakthi Engineering College
        </p>
      </div>
    </div>
  );
};
