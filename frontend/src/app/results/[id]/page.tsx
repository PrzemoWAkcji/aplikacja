'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { MapPin, Calendar, ChevronRight } from 'lucide-react';
import PublicResultsView from '../../../components/meetings/PublicResultsView';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
    startTime?: string;
}

interface Meeting {
    id: string;
    name: string;
    date: string;
    location: string;
    events: Event[];
}

export default function PublicMeetingResultsPage() {
    const params = useParams();
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    const { data: meeting, isLoading, error } = useQuery<Meeting>({
        queryKey: ['public-meeting', params.id],
        queryFn: async () => {
            const response = await api.get(`/meetings/${params.id}`);
            return response.data;
        },
        enabled: !!params.id,
    });

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-slate-500 font-medium">Przygotowywanie wyników...</span>
            </div>
        </div>
    );

    if (error || !meeting) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center p-8 bg-white rounded-2xl shadow-xl">
                <h1 className="text-2xl font-bold text-red-500 mb-2">Błąd</h1>
                <p className="text-slate-600">Nie udało się pobrać danych zawodów.</p>
            </div>
        </div>
    );

    const selectedEventName = meeting.events.find(e => e.id === selectedEventId)?.name;

    return (
        <div className="min-h-screen bg-[#f8fafc] pb-20">
            {/* Hero Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white pt-12 pb-24 px-8 shadow-2xl relative overflow-hidden">
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-3">
                            <span className="bg-blue-400/30 text-blue-100 text-[10px] uppercase font-black tracking-widest px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                                Live Competition Results
                            </span>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none uppercase">
                                {meeting.name}
                            </h1>
                            <div className="flex flex-wrap gap-6 text-blue-100/80 text-sm font-medium">
                                <span className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4 text-blue-300" />
                                    {new Date(meeting.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                                <span className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-blue-300" />
                                    {meeting.location}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 -mt-20 -mr-20 h-64 w-64 bg-white/5 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 left-0 -mb-20 -ml-20 h-64 w-64 bg-blue-400/10 rounded-full blur-3xl"></div>
            </div>

            <div className="max-w-7xl mx-auto px-8 -mt-12 group">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                    {/* Event List Sidebar */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                            <div className="p-5 border-b border-slate-50 bg-slate-50/50">
                                <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest flex items-center gap-2">
                                    <ChevronRight className="h-4 w-4 text-blue-500" />
                                    Konkurencje
                                </h3>
                            </div>
                            <div className="divide-y divide-slate-50 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                {meeting.events.map((event) => (
                                    <button
                                        key={event.id}
                                        onClick={() => setSelectedEventId(event.id)}
                                        className={`w-full p-4 text-left transition-all relative overflow-hidden group ${selectedEventId === event.id
                                                ? 'bg-blue-50/50'
                                                : 'hover:bg-slate-50'
                                            }`}
                                    >
                                        {selectedEventId === event.id && (
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600"></div>
                                        )}
                                        <div className="flex flex-col gap-1">
                                            <span className={`text-sm font-bold tracking-tight uppercase ${selectedEventId === event.id ? 'text-blue-700' : 'text-slate-700'
                                                }`}>
                                                {event.name}
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                    {event.code}
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                                                    {event.gender === 'M' ? 'Mężczyźni' : event.gender === 'K' ? 'Kobiety' : 'Open'}
                                                </span>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Summary Info */}
                        <div className="bg-indigo-900 text-indigo-100 p-6 rounded-2xl shadow-lg relative overflow-hidden">
                            <h4 className="font-bold text-sm mb-2 relative z-10">O systemie</h4>
                            <p className="text-xs text-indigo-200/80 leading-relaxed relative z-10">
                                Wyniki są pobierane w czasie rzeczywistym bezpośrednio z aparatury FinishLynx.
                                Odświeżanie następuje automatycznie.
                            </p>
                            <div className="absolute -bottom-8 -right-8 h-24 w-24 bg-white/5 rounded-full"></div>
                        </div>
                    </div>

                    {/* Results Table Area */}
                    <div className="lg:col-span-3">
                        <PublicResultsView eventId={selectedEventId} eventName={selectedEventName} />
                    </div>
                </div>
            </div>

            <style jsx global>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                }
            `}</style>
        </div>
    );
}
