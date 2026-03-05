'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import Link from 'next/link';
import { Button } from '../components/ui/button';
import { Calendar, MapPin, ChevronRight, LogIn, ExternalLink } from 'lucide-react';

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
      const response = await api.get('/meetings');
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
              <Button variant="ghost" size="sm" className="font-bold text-slate-600">
                <LogIn className="h-4 w-4 mr-2" />
                Logowanie
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative py-24 px-6 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center space-y-8 relative z-10">
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border border-blue-100">
            <span className="h-2 w-2 bg-blue-600 rounded-full animate-ping"></span>
            Status: System Online
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tight leading-none">
            WYNIKI ZAWODÓW <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">NA ŻYWO</span>
          </h1>
          <p className="max-w-2xl mx-auto text-slate-500 text-lg md:text-xl font-medium leading-relaxed">
            Oficjalne wyniki, listy startowe i program minutowy zawodów lekkoatletycznych.
            Bezpośrednie połączenie z fotofiniszem FinishLynx.
          </p>
        </div>
        {/* Background Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-64 bg-blue-400 opacity-20 blur-[120px] -z-10"></div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 pb-32">
        <div className="flex items-center justify-between mb-12">
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <Calendar className="h-6 w-6 text-blue-600" />
            Nadchodzące Wydarzenia
          </h2>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-slate-200 animate-pulse rounded-3xl"></div>
            ))}
          </div>
        ) : meetings?.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-500 font-bold">Obecnie nie ma zaplanowanych zawodów.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {meetings?.map((meeting) => (
              <div key={meeting.id} className="group relative h-full min-h-[460px] bg-white rounded-[2rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 transition-all hover:-translate-y-2 hover:shadow-2xl hover:shadow-blue-200/40">
                <div className="flex h-full flex-col space-y-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-blue-600 text-[10px] font-black uppercase tracking-widest">
                      <Calendar className="h-3 w-3" />
                      {new Date(meeting.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                    </div>
                    <h3 className="min-h-[108px] text-2xl font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">
                      {meeting.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400 text-sm font-medium">
                    <MapPin className="h-4 w-4" />
                    {meeting.location}
                  </div>

                  <div className="mt-auto pt-4 flex flex-col gap-3">
                    <Link href={`/results/${meeting.id}`} className="w-full">
                      <Button className="w-full bg-slate-900 hover:bg-black rounded-xl h-12 font-bold flex items-center justify-between px-6 transition-all group-hover:scale-[1.02]">
                        Wyniki Live
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    {meeting.domtelOnlineUrl && (
                      <a href={meeting.domtelOnlineUrl} target="_blank" rel="noreferrer" className="w-full">
                        <Button variant="outline" className="w-full h-12 font-bold text-slate-600 hover:text-sky-700 hover:bg-sky-50 border-slate-200 hover:border-sky-200">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Domtel Online
                        </Button>
                      </a>
                    )}
                    <Link href={`/meetings/${meeting.id}/register`} className="w-full">
                      <Button variant="ghost" className="w-full h-12 font-bold text-slate-500 hover:text-blue-600 hover:bg-blue-50">
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
      <footer className="border-t border-slate-100 bg-white py-12 text-center">
        <p className="text-slate-400 text-sm font-medium">
          &copy; 2026 AthleticsPRO System. Powered by NestJS & Next.js.
        </p>
      </footer>
    </div>
  );
}
