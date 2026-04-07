'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Calendar, MapPin, ChevronRight, LogIn, ExternalLink, Zap, Timer, Trophy, Activity } from 'lucide-react';

interface Meeting {
  id: string;
  name: string;
  date: string;
  location: string;
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {meetings?.map((meeting) => (
              <div
                key={meeting.id}
                className="group relative flex flex-col bg-white rounded-[2rem] overflow-hidden shadow-lg shadow-slate-200/60 border border-slate-100 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-200/40"
              >
                {/* Card top accent */}
                <div className="h-1.5 w-full bg-gradient-to-r from-blue-500 to-indigo-500 group-hover:from-blue-600 group-hover:to-violet-600 transition-all duration-500"></div>

                <div className="flex flex-col flex-1 p-8 space-y-5">
                  {/* Date badge */}
                  <div className="flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase tracking-widest">
                    <div className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Calendar className="h-3 w-3" />
                    </div>
                    {new Date(meeting.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>

                  {/* Name */}
                  <h3 className="text-xl font-black text-slate-800 leading-tight group-hover:text-blue-600 transition-colors min-h-[60px]">
                    {meeting.name}
                  </h3>

                  {/* Location */}
                  <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span className="truncate">{meeting.location}</span>
                  </div>

                  {/* Divider */}
                  <div className="h-px w-full bg-slate-100"></div>

                  {/* Actions */}
                  <div className="mt-auto flex flex-col gap-2.5">
                    <Link href={`/results/${meeting.id}`} className="w-full">
                      <Button className="w-full bg-slate-900 hover:bg-blue-600 rounded-xl h-11 font-bold text-sm flex items-center justify-between px-5 transition-all duration-200">
                        <span>Wyniki Live</span>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    {meeting.domtelOnlineUrl && (
                      <a href={meeting.domtelOnlineUrl} target="_blank" rel="noreferrer" className="w-full">
                        <Button variant="outline" className="w-full h-11 font-bold text-slate-600 hover:text-sky-700 hover:bg-sky-50 border-slate-200 hover:border-sky-200 rounded-xl text-sm transition-all">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Domtel Online
                        </Button>
                      </a>
                    )}
                    <Link href={`/meetings/${meeting.id}/register`} className="w-full">
                      <Button variant="ghost" className="w-full h-11 font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl text-sm transition-all">
                        Zapisz się do zawodów
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
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
