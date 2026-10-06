import React, { useEffect, useRef, useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import confetti from 'canvas-confetti';
import {
  Download,
  CheckCircle2,
  AlertCircle,
  Search,
  RotateCcw,
  Sparkles,
  Award,
  Building,
  Calendar,
  Layers,
  Edit3,
  ExternalLink,
  Check
} from 'lucide-react';

/* Categories & Events matching PIXEL-3.O */
export const CATEGORIES: Record<string, string[]> = {
  Technical: ['PaperQuest', 'AI FilmForge'],
  'Non-Technical': ['Checkmate', 'Mine Relay'],
};

const TEMPLATE_PATHS = ['/participation.png', '/Certificate-template.png'];

/* Precise pixel coordinates derived from the 1536 x 1024 certificate template:
   - Name line:    x ∈ [447, 1491], center cx = 969, line y = 612 -> baseline y = 605
   - College line: x ∈ [96, 1491],  center cx = 794, line y = 676 -> baseline y = 669
   - Event line:   x ∈ [479, 921],  center cx = 700, line y = 734 -> baseline y = 727
*/
const FIELDS = {
  name: { cx: 969, y: 605, w: 980, size: 42, style: 'italic 700' },
  college: { cx: 794, y: 669, w: 1350, size: 34, style: '700' },
  event: { cx: 700, y: 727, w: 420, size: 34, style: '700' },
};

const INK_COLOR = '#0a1e6e';
const SERIF_FONT = '"Times New Roman", Times, "Liberation Serif", serif';

export interface Person {
  name: string;
  college: string;
  event: string;
  category?: string;
}

const DEFAULT_PARTICIPANTS: Person[] = [
  { name: 'Vishnu', college: 'Adhiparasakthi Engineering College', event: 'PaperQuest' },
  { name: 'Pavithran', college: 'Adhiparasakthi Engineering College', event: 'PaperQuest' },
  { name: 'Sathya', college: 'Adhiparasakthi Engineering College', event: 'PaperQuest' },
  { name: 'Jupalli', college: 'Adhiparasakthi Engineering College', event: 'AI FilmForge' },
  { name: 'Sachin', college: 'Adhiparasakthi Engineering College', event: 'AI FilmForge' },
  { name: 'Vijay', college: 'Adhiparasakthi Engineering College', event: 'Checkmate' },
  { name: 'Bhaai', college: 'Adhiparasakthi Engineering College', event: 'Checkmate' },
  { name: 'Tarun', college: 'Adhiparasakthi Engineering College', event: 'Mine Relay' },
  { name: 'Vishnu', college: 'Adhiparasakthi Engineering College', event: 'Checkmate' },
  { name: 'Sachin', college: 'Adhiparasakthi Engineering College', event: 'Mine Relay' },
];

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

const tidyName = (s: string) => {
  if (!s) return '';
  if (s === s.toLowerCase() || s === s.toUpperCase()) {
    return s.toLowerCase().replace(/(^|[\s.])([a-z])/g, (_, a, b) => a + b.toUpperCase());
  }
  return s;
};

function parseCSV(text: string): Person[] {
  if (!text || !text.trim()) return [];
  const rows = text
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
  const nameIdx = Math.max(0, headers.indexOf('name'));
  const collegeIdx = headers.indexOf('college');
  const eventIdx = headers.indexOf('event');

  return rows
    .slice(1)
    .filter((r) => r[nameIdx])
    .map((r) => ({
      name: r[nameIdx],
      college: collegeIdx >= 0 ? r[collegeIdx] || '' : 'Adhiparasakthi Engineering College',
      event: eventIdx >= 0 ? r[eventIdx] || '' : '',
    }));
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
  const [participants, setParticipants] = useState<Person[]>(DEFAULT_PARTICIPANTS);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chosenPerson, setChosenPerson] = useState<Person | null>(null);
  const [isManualEdit, setIsManualEdit] = useState<boolean>(false);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [isDownloadingPng, setIsDownloadingPng] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const templateImgRef = useRef<HTMLImageElement | null>(null);

  // Load participants from participants.csv
  useEffect(() => {
    fetch('/participants.csv')
      .then((res) => (res.ok ? res.text() : ''))
      .then((txt) => {
        const parsed = parseCSV(txt);
        if (parsed.length > 0) {
          setParticipants(parsed);
        }
      })
      .catch(() => {
        setParticipants(DEFAULT_PARTICIPANTS);
      });

    // Preload certificate template image
    loadTemplateImage().then((img) => {
      templateImgRef.current = img;
    });
  }, []);

  // Determine category for an event
  const getEventCategory = (eventName: string): string => {
    for (const [cat, events] of Object.entries(CATEGORIES)) {
      if (events.some((e) => norm(e) === norm(eventName))) {
        return cat;
      }
    }
    return 'Technical';
  };

  // Search matches:
  // 1. If an event is selected, match within that event
  // 2. If no event is selected, match across all participants
  const q = norm(searchQuery);
  const searchMatches = useMemo(() => {
    if (q.length < 2) return [];
    if (selectedEvent) {
      return participants
        .filter((p) => norm(p.event) === norm(selectedEvent) && norm(p.name).includes(q))
        .slice(0, 10);
    }
    // Cross-event search
    return participants
      .filter((p) => norm(p.name).includes(q) || norm(p.college).includes(q))
      .slice(0, 10);
  }, [participants, selectedEvent, q]);

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

    // Set canvas dimensions to match template native dimensions (1536 x 1024)
    canvas.width = templateImg.naturalWidth || 1536;
    canvas.height = templateImg.naturalHeight || 1024;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsDrawing(false);
      return;
    }

    // Draw high quality background
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(templateImg, 0, 0, canvas.width, canvas.height);

    // Scale ratio (relative to 1536px design width)
    const scale = canvas.width / 1536;

    // Helper function to render text centered above underline
    const drawField = (
      field: typeof FIELDS.name,
      text: string,
      customSize?: number
    ) => {
      if (!text || !text.trim()) return;

      const baseSize = (customSize || field.size) * scale;
      let currentSize = baseSize;
      const targetWidth = field.w * scale;

      ctx.save();
      ctx.fillStyle = INK_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';

      // Dynamically fit text within underline boundary
      do {
        ctx.font = `${field.style} ${currentSize}px ${SERIF_FONT}`;
        currentSize -= 1;
      } while (ctx.measureText(text).width > targetWidth && currentSize > 14);

      ctx.fillText(text, field.cx * scale, field.y * scale);
      ctx.restore();
    };

    // Draw Name, College, and Event with exact alignment
    drawField(FIELDS.name, tidyName(person.name));
    drawField(FIELDS.college, person.college || 'Adhiparasakthi Engineering College');
    drawField(FIELDS.event, person.event);

    setIsDrawing(false);
  };

  // Re-draw when chosen person changes
  useEffect(() => {
    if (chosenPerson) {
      renderCertificate(chosenPerson);
    }
  }, [chosenPerson]);

  // Handle participant selection
  const handleSelectParticipant = (person: Person) => {
    setChosenPerson(person);
    const cat = getEventCategory(person.event);
    setSelectedCategory(cat);
    setSelectedEvent(person.event);
    setSearchQuery(person.name);

    // Confetti celebration
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#FF6A00', '#E51B23', '#FFC21A', '#E0008A'],
      });
    } catch {
      // ignore
    }
  };

  const handleReset = () => {
    setChosenPerson(null);
    setSearchQuery('');
    setIsManualEdit(false);
  };

  const certificateFileName = chosenPerson
    ? `${tidyName(chosenPerson.name)} - ${chosenPerson.event} - PIXEL3.O Certificate`
    : 'PIXEL-3.O-Certificate';

  // Download high-resolution PNG
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
    } catch (err) {
      console.error('Download PNG failed', err);
    } finally {
      setIsDownloadingPng(false);
    }
  };

  // Download high-resolution PDF
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
    } catch (err) {
      console.error('Download PDF failed', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

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
          Engineering · In Association with CSI Kanchipuram Chapter
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
                    handleReset();
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
                      handleReset();
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

        {/* STEP 3: SEARCH OR ENTER NAME */}
        <div>
          <div className="mb-3">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-phoenix-gold text-black text-xs font-black">
                {selectedCategory ? '3' : '✦'}
              </span>
              ENTER PARTICIPANT NAME
            </h2>
            <p className="text-xs text-white/60 ml-8">
              {selectedEvent
                ? `Type your name to find your registration for ${selectedEvent}`
                : 'Type your name directly or select a category above'}
            </p>
          </div>

          <div className="relative">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-4 text-white/40 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setChosenPerson(null);
                }}
                placeholder={
                  selectedEvent
                    ? `Start typing your name for ${selectedEvent}…`
                    : 'Start typing your name to find your certificate…'
                }
                autoComplete="off"
                className="w-full pl-12 pr-10 py-3.5 rounded-2xl border border-white/20 text-sm font-semibold text-white bg-white/[0.06] placeholder:text-white/40 focus:outline-none focus:border-phoenix-orange focus:ring-2 focus:ring-phoenix-orange/30 transition-all shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="absolute right-3 p-1 rounded-full text-white/40 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Dropdown suggestions */}
            {!chosenPerson && searchMatches.length > 0 && (
              <div className="mt-2 p-2 bg-[#17171d] border border-white/20 rounded-2xl shadow-2xl max-h-72 overflow-y-auto space-y-1 z-30">
                <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest uppercase text-white/40 border-b border-white/10">
                  Select Participant ({searchMatches.length} found)
                </div>
                {searchMatches.map((person, idx) => (
                  <button
                    key={`${person.name}-${person.event}-${idx}`}
                    type="button"
                    onClick={() => handleSelectParticipant(person)}
                    className="w-full text-left p-3 rounded-xl hover:bg-white/10 border border-transparent hover:border-phoenix-orange/40 transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div>
                      <div className="text-sm font-bold text-white group-hover:text-phoenix-orange transition-colors">
                        {person.name}
                      </div>
                      <div className="text-xs text-white/60 flex items-center gap-1.5 mt-0.5">
                        <Building className="w-3 h-3 text-white/40 shrink-0" />
                        <span className="truncate max-w-[280px] sm:max-w-md">
                          {person.college || 'Adhiparasakthi Engineering College'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-phoenix-orange/15 text-phoenix-orange border border-phoenix-orange/30">
                        {person.event}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Not found alert */}
            {!chosenPerson && q.length >= 3 && searchMatches.length === 0 && (
              <div className="mt-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold">
                    No participant found matching &quot;{searchQuery}&quot;
                    {selectedEvent ? ` in ${selectedEvent}` : ''}
                  </div>
                  <div className="text-white/70 text-xs">
                    Please check spelling or click below to enter details manually if you
                    registered on-spot.
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const manualPerson: Person = {
                        name: searchQuery,
                        college: 'Adhiparasakthi Engineering College',
                        event: selectedEvent || 'PaperQuest',
                      };
                      setChosenPerson(manualPerson);
                      setIsManualEdit(true);
                    }}
                    className="mt-2 text-xs font-bold text-phoenix-gold hover:underline flex items-center gap-1"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Generate certificate with &quot;
                    {searchQuery}&quot; manually
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STEP 4: CERTIFICATE PREVIEW & DOWNLOAD */}
        {chosenPerson && (
          <div className="animate-in fade-in duration-300 space-y-6 pt-2 border-t border-white/10">
            {/* Header info */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 block">
                    Certificate Generated Successfully
                  </span>
                  <span className="text-sm font-bold text-white">
                    {tidyName(chosenPerson.name)} · {chosenPerson.event}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualEdit(!isManualEdit)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-white/80 bg-white/10 hover:bg-white/20 border border-white/20 flex items-center gap-1.5 transition-colors"
                >
                  <Edit3 className="w-3.5 h-3.5 text-phoenix-orange" />
                  {isManualEdit ? 'Close Editor' : 'Edit Details'}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 rounded-full text-xs font-bold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  Choose Another
                </button>
              </div>
            </div>

            {/* Optional Manual Editor */}
            {isManualEdit && (
              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/15 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-phoenix-gold flex items-center gap-1.5">
                  <Edit3 className="w-3.5 h-3.5" /> Adjust Certificate Details &amp; Alignment
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 block mb-1">
                      Participant Name:
                    </label>
                    <input
                      type="text"
                      value={chosenPerson.name}
                      onChange={(e) =>
                        setChosenPerson({ ...chosenPerson, name: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-xs font-bold text-white focus:outline-none focus:border-phoenix-orange"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 block mb-1">
                      College Name:
                    </label>
                    <input
                      type="text"
                      value={chosenPerson.college}
                      onChange={(e) =>
                        setChosenPerson({ ...chosenPerson, college: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-xs font-bold text-white focus:outline-none focus:border-phoenix-orange"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-white/60 block mb-1">
                      Event Name:
                    </label>
                    <input
                      type="text"
                      value={chosenPerson.event}
                      onChange={(e) =>
                        setChosenPerson({ ...chosenPerson, event: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-xs font-bold text-white focus:outline-none focus:border-phoenix-orange"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Live Canvas Certificate Preview */}
            <div className="relative rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black/50 p-2 sm:p-3">
              <div className="relative w-full aspect-[1536/1024] bg-white rounded-xl overflow-hidden">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full object-contain block"
                  style={{ imageRendering: 'crisp-edges' }}
                />
                {isDrawing && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center text-white text-xs font-bold">
                    Rendering Certificate...
                  </div>
                )}
              </div>
              <div className="mt-2 text-center text-[10px] text-white/40 tracking-wider uppercase">
                High-Definition 1536 × 1024 Live Certificate Render
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
          </div>
        )}
      </div>

      {/* ── FOOTER CREDITS ── */}
      <div className="text-center mt-12 text-xs text-white/40 space-y-1">
        <p>PIXEL-3.O · National Level Technical Symposium · 14 October 2026</p>
        <p>Department of Computer Science and Engineering · Adhiparasakthi Engineering College</p>
      </div>
    </div>
  );
};
