import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  Search,
  Building,
  AlertCircle,
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

/* Letters-only lowercase key, so "R. Karthikeyan", "r karthikeyan" and "R.KARTHIKEYAN" all match */
const keyOf = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

function parseCSV(text: string): Person[] {
  if (!text || !text.trim()) return [];
  const rows = text
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .filter((r) => r.trim())
    .map((r) => {
      const out: string[] = [];
      let current = '';
      let inQuotes = false;
      for (const ch of r) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === ',' && !inQuotes) {
          out.push(current.trim());
          current = '';
        } else current += ch;
      }
      out.push(current.trim());
      return out;
    });

  if (!rows.length) return [];
  const headers = rows[0].map((x) => x.toLowerCase());
  const nameIdx = headers.indexOf('name');
  const collegeIdx = headers.indexOf('college');
  const eventIdx = headers.indexOf('event');
  if (nameIdx < 0 || eventIdx < 0 || collegeIdx < 0) return [];

  return rows
    .slice(1)
    .filter((r) => r[nameIdx] && r[eventIdx])
    .map((r) => ({
      name: r[nameIdx],
      college: r[collegeIdx] || '',
      event: r[eventIdx],
    }));
}

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
  const [participants, setParticipants] = useState<Person[]>([]);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [chosenPerson, setChosenPerson] = useState<Person | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState<boolean>(false);
  const [hasDownloaded, setHasDownloaded] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const templateImgRef = useRef<HTMLImageElement | null>(null);

  // Load participants.csv and preload the certificate template image
  useEffect(() => {
    fetch('/participants.csv', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('participants.csv not found');
        return res.text();
      })
      .then((txt) => {
        setParticipants(parseCSV(txt));
        setLoadStatus('ready');
      })
      .catch(() => {
        setParticipants([]);
        setLoadStatus('error');
      });

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

  // Only people listed for the selected event can get a certificate
  const qKey = keyOf(nameInput);
  const eventPeople = useMemo(
    () => participants.filter((p) => p.event.toLowerCase() === selectedEvent.toLowerCase()),
    [participants, selectedEvent]
  );
  const searchMatches = useMemo(
    () => (qKey.length < 2 ? [] : eventPeople.filter((p) => keyOf(p.name).includes(qKey)).slice(0, 12)),
    [eventPeople, qKey]
  );
  const exactMatches = useMemo(
    () => eventPeople.filter((p) => keyOf(p.name) === qKey),
    [eventPeople, qKey]
  );
  const canGenerate = exactMatches.length === 1;

  const handleSelectParticipant = (person: Person) => {
    setNameInput(person.name);
    setChosenPerson(person);
    setHasDownloaded(false);
    phoenixBurst();
  };

  const handleGenerate = () => {
    if (canGenerate) handleSelectParticipant(exactMatches[0]);
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

        {/* STEP 3: ENTER NAME (must be in the participant list) */}
        {selectedEvent && (
          <div className="animate-in fade-in duration-300">
            <div className="mb-3">
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-phoenix-gold text-black text-xs font-black">
                  3
                </span>
                ENTER YOUR NAME
              </h2>
              <p className="text-xs text-white/60 ml-8">
                Type your name as registered for {selectedEvent} to get your certificate
              </p>
            </div>

            {loadStatus === 'error' && (
              <div className="mb-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                <div>
                  The participant list could not be loaded. Please refresh the page or contact the
                  organizers.
                </div>
              </div>
            )}

            <div className="relative space-y-3">
              <div className="relative flex items-center">
                <Search className="w-5 h-5 absolute left-4 text-white/40 pointer-events-none" />
                <input
                  type="text"
                  value={nameInput}
                  maxLength={60}
                  disabled={loadStatus !== 'ready'}
                  onChange={(e) => {
                    setNameInput(e.target.value);
                    setChosenPerson(null);
                    setHasDownloaded(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleGenerate();
                  }}
                  placeholder="Start typing your name…"
                  autoComplete="off"
                  className="w-full pl-12 pr-5 py-3.5 rounded-2xl border border-white/20 text-sm font-semibold text-white bg-white/[0.06] placeholder:text-white/40 focus:outline-none focus:border-phoenix-orange focus:ring-2 focus:ring-phoenix-orange/30 transition-all shadow-inner disabled:opacity-50"
                />
              </div>

              {/* Suggestions from the participant list */}
              {!chosenPerson && searchMatches.length > 0 && (
                <div className="p-2 bg-[#17171d] border border-white/20 rounded-2xl shadow-2xl max-h-72 overflow-y-auto space-y-1 z-30">
                  <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-white/40 border-b border-white/10">
                    Tap your name ({searchMatches.length} found)
                  </div>
                  {searchMatches.map((person, idx) => (
                    <button
                      key={`${person.name}-${person.college}-${idx}`}
                      type="button"
                      onClick={() => handleSelectParticipant(person)}
                      className="w-full text-left p-3 rounded-xl hover:bg-white/10 border border-transparent hover:border-phoenix-orange/40 transition-all group cursor-pointer"
                    >
                      <div className="text-sm font-bold text-white group-hover:text-phoenix-orange transition-colors">
                        {person.name}
                      </div>
                      <div className="text-xs text-white/60 flex items-center gap-1.5 mt-0.5">
                        <Building className="w-3 h-3 text-white/40 shrink-0" />
                        <span className="truncate">{person.college}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Not in the list */}
              {!chosenPerson && loadStatus === 'ready' && qKey.length >= 3 && searchMatches.length === 0 && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-bold">
                      No record found for &quot;{nameInput}&quot; in {selectedEvent}
                    </div>
                    <div className="text-white/70 text-xs">
                      Check the spelling and the event you selected. If you still can&apos;t find your
                      name, contact the organizers.
                    </div>
                  </div>
                </div>
              )}

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
