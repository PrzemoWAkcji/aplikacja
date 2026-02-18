'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import PublicResultsView from '../../../components/meetings/PublicResultsView';
import {
    Clock,
    Calendar,
    Trophy,
    LayoutGrid,
    ChevronRight,
    Filter,
    ArrowLeft,
    CalendarDays,
    MapPin
} from 'lucide-react';
import Link from 'next/link';

interface Meeting {
    id: string;
    name: string;
    date: string;
    location: string;
    organizerLogo?: string;
    sponsorLogos: string[];
    events: MeetingEvent[];
}

interface MeetingEvent {
    id: string;
    name: string;
    code: string;
    gender: string;
    startTime?: string;
    category?: string;
    ageGroup?: string;
    model?: string;
    requiresWind?: boolean;
}

export default function PublicMeetingResultsPage() {
    const params = useParams();
    const router = useRouter();
    const meetingId = params.id as string;
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const { data: meeting, isLoading } = useQuery<Meeting>({
        queryKey: ['meeting-live', meetingId],
        queryFn: async () => {
            const response = await api.get(`/meetings/${meetingId}`);
            return response.data;
        },
    });

    const selectedEvent = useMemo(() => {
        return meeting?.events.find(e => e.id === selectedEventId);
    }, [meeting, selectedEventId]);

    // Helper to extract age group for display
    const getEventLabel = (event: MeetingEvent) => {
        let label = event.code;

        // If ageGroup is defined, use it
        if (event.ageGroup) {
            const ageGroupStr = event.ageGroup.startsWith('U') ? event.ageGroup : `U${event.ageGroup}`;
            label += ` ${ageGroupStr}`;
        } else {
            // Fallback: try to extract from name if not in ageGroup but present in string (e.g. "60m U16")
            const match = event.name.match(/U\d+/i);
            if (match) {
                label += ` ${match[0].toUpperCase()}`;
            }
        }

        return label;
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-medium animate-pulse">Inicjalizacja systemu wyników na żywo...</p>
                </div>
            </div>
        );
    }

    if (!meeting) return <div>Nie znaleziono mitingu.</div>;

    // Group events by category/gender for top bar
    const groupedEvents = meeting.events.reduce((acc, event) => {
        const gender = (event.gender || '').toUpperCase().trim();
        let cat = 'MIX';

        if (gender === 'K' || gender === 'W' || gender === 'F') cat = 'Kobiety';
        else if (gender === 'M') cat = 'Mężczyźni';
        else if (gender === 'MIX' || gender === 'OPEN') cat = 'MIX';
        else cat = 'MIX';

        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(event);
        return acc;
    }, {} as Record<string, MeetingEvent[]>);

    return (
        <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
            {/* TOP HEADER */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16 sm:h-20">
                        <div className="flex items-center gap-4 sm:gap-6">
                            <Link href="/" className="p-2 hover:bg-slate-100 rounded-full transition-colors hidden sm:block">
                                <ArrowLeft className="h-5 w-5 text-slate-500" />
                            </Link>
                            <div className="flex items-center gap-3">
                                {meeting.organizerLogo ? (
                                    <img
                                        src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/meetings/uploads/${meeting.organizerLogo}`}
                                        alt="Logo"
                                        className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
                                    />
                                ) : (
                                    <div className="h-10 w-10 sm:h-12 sm:w-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-200">
                                        P
                                    </div>
                                )}
                                <div>
                                    <h1 className="text-lg sm:text-xl font-bold text-slate-900 leading-tight truncate max-w-[200px] sm:max-w-none">
                                        {meeting.name}
                                    </h1>
                                    <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-500 font-medium">
                                        <span className="flex items-center gap-1">
                                            <Calendar className="h-3.5 w-3.5" />
                                            {new Date(meeting.date).toLocaleDateString('pl-PL')}
                                        </span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <span className="flex items-center gap-1 ring-1 ring-slate-200 bg-slate-50 px-1.5 py-0.5 rounded">
                                            {meeting.location}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* LIVE INDICATOR */}
                        <div className="flex items-center gap-3">
                            <div className="hidden md:flex items-center bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 gap-4">
                                <div className="flex items-center gap-1.5 border-r border-slate-200 pr-4">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">SYSTEM LIVE</span>
                                </div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                    {new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* QUICK EVENT SELECTION (TOP BAR) - STACKED ROWS */}
                <div className="border-t border-slate-100 bg-white shadow-sm hidden sm:block">
                    <div className="max-w-[1600px] mx-auto px-4 py-1 flex flex-col divide-y divide-slate-50">
                        {['Kobiety', 'Mężczyźni', 'MIX'].filter(g => groupedEvents[g]).map(gender => (
                            <div key={gender} className="flex items-center gap-4 py-1.5 overflow-x-auto scroller-hide">
                                <div className="shrink-0 w-24">
                                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md block text-center ${gender === 'Kobiety' ? 'bg-pink-100 text-pink-700 border border-pink-200' :
                                        gender === 'Mężczyźni' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                            'bg-purple-100 text-purple-700 border border-purple-200'
                                        }`}>
                                        {gender === 'Kobiety' ? 'KOBIETY' : gender === 'Mężczyźni' ? 'MĘŻCZYŹNI' : 'MIX / OPEN'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {groupedEvents[gender].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map(event => (
                                        <button
                                            key={event.id}
                                            onClick={() => setSelectedEventId(event.id)}
                                            className={`px-3 py-1 rounded text-[11px] font-bold transition-all duration-200 whitespace-nowrap border ${selectedEventId === event.id
                                                ? 'bg-blue-600 text-white border-blue-700 shadow-sm'
                                                : 'text-slate-600 border-transparent hover:border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {getEventLabel(event)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* SIDEBAR: FULL SCHEDULE */}
                    <aside className="w-full lg:w-80 flex-shrink-0 group">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden sticky top-48">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-tight">
                                    <Clock className="h-4 w-4 text-blue-600" />
                                    Harmonogram
                                </h3>
                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded">LIVE</span>
                            </div>
                            <div className="max-h-[calc(100vh-320px)] overflow-y-auto overflow-x-hidden scroller font-medium">
                                {meeting.events.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm italic">Brak zaplanowanych konkurencji</div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {[...meeting.events].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')).map((event) => {
                                            const isActive = selectedEventId === event.id;
                                            return (
                                                <button
                                                    key={event.id}
                                                    onClick={() => setSelectedEventId(event.id)}
                                                    className={`w-full text-left p-4 transition-all duration-200 relative group flex items-start gap-4 ${isActive
                                                        ? 'bg-blue-50/50'
                                                        : 'hover:bg-slate-50'
                                                        }`}
                                                >
                                                    {isActive && (
                                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>
                                                    )}
                                                    <span className={`text-[11px] font-mono font-bold mt-0.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'
                                                        }`}>
                                                        {event.startTime ? new Date(event.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className={`text-[13px] font-bold leading-none ${isActive ? 'text-blue-900 font-black' : 'text-slate-700'
                                                            }`}>
                                                            {event.name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className={`text-[9px] font-black uppercase px-1 rounded ${event.gender === 'K' ? 'bg-pink-50 text-pink-600' :
                                                                event.gender === 'M' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                                }`}>
                                                                {event.gender === 'K' ? 'K' : event.gender === 'M' ? 'M' : 'MIX'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-1 rounded">
                                                                {event.code}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>

                    {/* MAIN CONTENT: RESULTS TABLE */}
                    <div className="flex-1 min-w-0">
                        {!selectedEventId ? (
                            <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed animate-in fade-in duration-700">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-50 scale-150 animate-pulse"></div>
                                    <LayoutGrid className="h-16 w-16 text-blue-600/20 relative" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">Platforma Wyników na Żywo</h2>
                                <p className="text-slate-500 max-w-sm text-center text-sm leading-relaxed">
                                    Wybierz konkurencję z górnego paska lub harmonogramu, aby śledzić rywalizację w czasie rzeczywistym.
                                </p>
                            </div>
                        ) : (
                            <div className="animate-in slide-in-from-bottom-2 duration-500 transition-all">
                                <PublicResultsView
                                    eventId={selectedEventId}
                                    eventName={selectedEvent?.name}
                                    model={selectedEvent?.model}
                                    requiresWind={selectedEvent?.requiresWind}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </main>

            <style jsx global>{`
                .scroller::-webkit-scrollbar {
                    width: 4px;
                }
                .scroller::-webkit-scrollbar-track {
                    background: transparent;
                }
                .scroller::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 20px;
                }
                .scroller::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
                .scroller-hide::-webkit-scrollbar {
                    display: none;
                }
                .scroller-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
