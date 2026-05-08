'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Calendar, MapPin, ChevronRight, LogIn, ExternalLink, Zap, Timer, Trophy, Activity, ListChecks, UserPlus, CircleDot } from 'lucide-react';

type MeetingStatus = 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'FINISHED' | 'CANCELLED';

interface Meeting {
  id: string;
  name: string;
  date: string;
  endDate?: string | null;
  location: string;
  city?: string | null;
  status?: MeetingStatus;
  season?: 'STADIUM' | 'INDOOR';
  type?: string;
  events?: Array<{ id: string }>;
  domtelOnlineUrl?: string;
}

export default function Home() {
  const { data: meetings, isLoading } = useQuery<Meeting[]>({
    queryKey: ['public-meetings'],
    queryFn: async () => {
      const response = await api.get('/meetings/public');
      return response.data;
    },
  });

  // Pomocnicze funkcje do statusu/sortowania
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const todayMs = startOfDay(new Date());

  const getMeetingState = (m: Meeting) => {
    const start = startOfDay(new Date(m.date));
    const end = m.endDate ? startOfDay(new Date(m.endDate)) : start;
    if (m.status === 'CANCELLED') return 'cancelled' as const;
    if (m.status === 'FINISHED' || end < todayMs) return 'finished' as const;
    if (start <= todayMs && todayMs <= end) return 'live' as const;
    if (m.status === 'OPEN') return 'open' as const;
    return 'upcoming' as const;
  };

  const sortedMeetings = (meetings ?? []).slice().sort((a, b) => {
    const order = { live: 0, open: 1, upcoming: 2, finished: 3, cancelled: 4 };
    const sa = order[getMeetingState(a)];
    const sb = order[getMeetingState(b)];
    if (sa !== sb) return sa - sb;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  const formatDateRange = (m: Meeting) => {
    const start = new Date(m.date);
    const end = m.endDate ? new Date(m.endDate) : null;
    const fmt = (d: Date) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    if (end && startOfDay(end) !== startOfDay(start)) {
      return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  };

  const getStateBadge = (state: ReturnType<typeof getMeetingState>) => {
    switch (state) {
      case 'live':
        return { label: 'TRWA DZIŚ', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200', dot: 'bg-red-500 animate-pulse' };
      case 'open':
        return { label: 'ZAPISY OTWARTE', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' };
      case 'finished':
        return { label: 'ZAKOŃCZONE', cls: 'bg-slate-100 text-slate-500 ring-1 ring-slate-200', dot: 'bg-slate-400' };
      case 'cancelled':
        return { label: 'ODWOŁANE', cls: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200', dot: 'bg-rose-400' };
      default:
        return { label: 'NADCHODZĄCE', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200', dot: 'bg-blue-500' };
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* Top Navigation */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center h-full">
            <img src="/it-timing-logo.png" alt="IT TIMING" className="h-10 w-auto object-contain" />
          </div>
          <div className="flex gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="font-bold text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                <LogIn className="h-4 w-4 mr-2" />
                Logowanie
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative py-28 px-6 overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-br from-blue-400/20 to-indigo-500/20 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-300/10 blur-[80px] rounded-full"></div>
          <div className="absolute top-20 right-0 w-[250px] h-[250px] bg-indigo-400/10 blur-[80px] rounded-full"></div>
          {/* Grid pattern */}
          <div className="absolute inset-0" style={{backgroundImage: 'radial-gradient(circle, #e2e8f0 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: 0.5}}></div>
        </div>

        <div className="max-w-7xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-blue-100">
            <span className="h-2 w-2 bg-blue-600 rounded-full animate-ping"></span>
            System Online
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-none">
            WYNIKI ZAWODÓW <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-600">NA ŻYWO</span>
          </h1>
          <p className="max-w-2xl mx-auto text-slate-500 text-lg md:text-xl font-medium leading-relaxed">
            Oficjalne wyniki, listy startowe i program minutowy zawodów lekkoatletycznych.
            Bezpośrednie połączenie z fotofiniszem FinishLynx.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <a href="#events">
              <Button className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 h-12 px-8 rounded-2xl font-black text-sm transition-all active:scale-95 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Zobacz Zawody
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Features Strip */}
      <section className="py-8 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { icon: Zap, label: 'Wyniki w czasie rzeczywistym', color: 'text-yellow-500 bg-yellow-50' },
              { icon: Timer, label: 'Pomiar FinishLynx', color: 'text-blue-500 bg-blue-50' },
              { icon: Trophy, label: 'Oficjalne wyniki', color: 'text-emerald-500 bg-emerald-50' },
              { icon: Calendar, label: 'Program minutowy', color: 'text-violet-500 bg-violet-50' },
            ].map(({ icon: Icon, label, color }) => (
              <div key={label} className="flex flex-col items-center text-center gap-3">
                <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-slate-600 leading-tight">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <main id="events" className="max-w-6xl mx-auto px-6 py-20 pb-32">
        <div className="flex items-center justify-between mb-12">
          <div>
            <p className="text-xs font-black uppercase tracking-widest text-blue-600 mb-1">Kalendarz 2026</p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              Nadchodzące Wydarzenia
            </h2>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-72 bg-slate-100 animate-pulse rounded-3xl"></div>
            ))}
          </div>
        ) : meetings?.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6">
              <Calendar className="h-10 w-10 text-slate-300" />
            </div>
            <p className="text-slate-700 font-black text-lg mb-1">Brak zaplanowanych zawodów</p>
            <p className="text-slate-400 text-sm font-medium">Sprawdź ponownie wkrótce.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedMeetings.map((meeting) => {
              const state = getMeetingState(meeting);
              const badge = getStateBadge(state);
              const eventsCount = meeting.events?.length ?? 0;
              const cityLabel = meeting.city || meeting.location;
              const isFinished = state === 'finished' || state === 'cancelled';
              const accent =
                state === 'live'
                  ? 'bg-red-500'
                  : state === 'open'
                  ? 'bg-emerald-500'
                  : state === 'finished'
                  ? 'bg-slate-300'
                  : state === 'cancelled'
                  ? 'bg-rose-400'
                  : 'bg-blue-500';

              return (
                <article
                  key={meeting.id}
                  className={`group relative flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 ${
                    isFinished ? 'opacity-90' : ''
                  }`}
                >
                  <div className="flex flex-col flex-1 p-6 space-y-4">
                    {/* Top row: date capsule + status */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-50 ring-1 ring-slate-200 text-[11px] font-bold text-slate-700">
                        <Calendar className="h-3 w-3 text-slate-400" />
                        {formatDateRange(meeting)}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${badge.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`}></span>
                        {badge.label}
                      </span>
                    </div>

                    {/* Title + accent line */}
                    <div>
                      <h3 className="text-lg font-black text-slate-900 leading-snug tracking-tight line-clamp-2 min-h-[3.5rem] group-hover:text-blue-700 transition-colors">
                        {meeting.name}
                      </h3>
                      <div className={`mt-3 h-0.5 w-10 rounded-full ${accent} group-hover:w-16 transition-all duration-300`}></div>
                    </div>

                    {/* Info grid 2x2 */}
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-[13px]">
                      <div className="flex items-start gap-2 min-w-0">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <dt className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Miejsce</dt>
                          <dd className="font-semibold text-slate-700 truncate">{cityLabel}</dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 min-w-0">
                        <ListChecks className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <dt className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Konkurencje</dt>
                          <dd className="font-semibold text-slate-700">{eventsCount > 0 ? eventsCount : '—'}</dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 min-w-0">
                        <CircleDot className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <dt className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Sezon</dt>
                          <dd className="font-semibold text-slate-700">
                            {meeting.season === 'INDOOR' ? 'Halowy' : 'Stadionowy'}
                          </dd>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 min-w-0">
                        <Trophy className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <dt className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Status</dt>
                          <dd className="font-semibold text-slate-700">{badge.label.charAt(0) + badge.label.slice(1).toLowerCase()}</dd>
                        </div>
                      </div>
                    </dl>

                    {/* Action row */}
                    <div className="mt-auto pt-3 border-t border-slate-100 flex items-center gap-2">
                      <Link href={`/results/${meeting.id}`} className="flex-1">
                        <Button className="w-full bg-slate-900 hover:bg-blue-600 rounded-lg h-10 font-bold text-[13px] flex items-center justify-between px-4 transition-colors">
                          <span>{isFinished ? 'Wyniki' : 'Wyniki Live'}</span>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      {!isFinished && (
                        <Link href={`/meetings/${meeting.id}/register`} title="Zapisz się">
                          <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-slate-200 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 hover:border-emerald-200">
                            <UserPlus className="h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                      {meeting.domtelOnlineUrl && (
                        <a href={meeting.domtelOnlineUrl} target="_blank" rel="noreferrer" title="Domtel Online">
                          <Button variant="outline" size="icon" className="h-10 w-10 rounded-lg border-slate-200 text-slate-600 hover:text-sky-700 hover:bg-sky-50 hover:border-sky-200">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/it-timing-logo.png" alt="IT TIMING" className="h-8 w-auto object-contain opacity-60" />
          <p className="text-slate-400 text-sm font-medium text-center">
            &copy; 2026 IT TIMING. Oficjalny system pomiaru czasu.
          </p>
        </div>
      </footer>
    </div>
  );
}
