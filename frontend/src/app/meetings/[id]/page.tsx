'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth-store';
import { useState, useEffect } from 'react';

import Link from 'next/link';
import EventsList from '../../../components/meetings/EventsList';
import EntriesTable from '../../../components/meetings/EntriesTable';
import ScheduleView from '../../../components/meetings/ScheduleView';
import ResultsView from '../../../components/meetings/ResultsView';
import ToolsView from '../../../components/meetings/ToolsView';
import {
    List,
    Calendar,
    Trophy,
    Settings,
    ChevronRight,
    Home,
    MapPin,
    CalendarDays,
    ArrowLeft,
    LogOut,
    LayoutDashboard
} from 'lucide-react';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
    startTime?: string;
    ageGroup?: string;
    stage?: string;
    requiresWind?: boolean;
    entries?: { heat: number | null }[];
}

interface Meeting {
    id: string;
    name: string;
    date: string;
    endDate?: string;
    location: string;
    city?: string;
    country?: string;
    season: 'STADIUM' | 'INDOOR';
    type: string;
    status: 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'FINISHED' | 'CANCELLED';
    events: Event[];
}

type Tab = 'entries' | 'schedule' | 'results' | 'tools';

export default function MeetingDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const _hasHydrated = useAuthStore((state) => state._hasHydrated);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('entries');

    useEffect(() => {
        if (_hasHydrated && !token && typeof window !== 'undefined') {
            router.push('/login');
        }
    }, [_hasHydrated, token, router]);

    const { data: meeting, isLoading, error } = useQuery<Meeting>({
        queryKey: ['meeting', params.id],
        queryFn: async () => {
            const response = await api.get(`/meetings/${params.id}`);
            return response.data;
        },
        enabled: !!params.id && !!token,
    });

    if (isLoading) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium">Ładowanie zawodów...</p>
            </div>
        </div>
    );

    if (error || !meeting) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8 text-center">
            <div className="max-w-md space-y-4">
                <div className="text-red-500 text-5xl font-bold">!</div>
                <h2 className="text-2xl font-bold text-slate-800">Wystąpił błąd</h2>
                <p className="text-slate-500">Nie udało się pobrać szczegółów zawodów. Upewnij się, że masz połączenie z internetem i odpowiednie uprawnienia.</p>
                <Button onClick={() => router.push('/dashboard')}>Wróć do Dashboardu</Button>
            </div>
        </div>
    );

    const selectedEvent = meeting.events.find(e => e.id === selectedEventId);
    const selectedEventName = selectedEvent?.name;
    const selectedEventStage = selectedEvent?.stage;

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'Wersja Robocza';
            case 'SCHEDULED': return 'Zaplanowane';
            case 'OPEN': return 'Otwarte (Live)';
            case 'FINISHED': return 'Zakończone';
            case 'CANCELLED': return 'Odwołane';
            default: return status;
        }
    };

    const getSeasonLabel = (season: string) => {
        return season === 'STADIUM' ? 'Stadion' : 'Hala';
    };

    return (
        <div className="flex min-h-screen bg-[#f8fafc]">
            {/* VERTICAL SIDEBAR */}
            <aside className="w-64 bg-white border-r border-slate-200 sticky top-0 h-screen flex flex-col z-40 shadow-[4px_0_24px_rgba(0,0,0,0.02)] shrink-0">
                {/* BRANDING */}
                <div className="p-5 border-b border-slate-50 flex items-center gap-3">
                    <div className="h-9 w-9 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 shrink-0">
                        <Trophy className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                        <span className="font-black text-base tracking-tighter text-slate-800 leading-none">ATHLETICS<span className="text-blue-600">PRO</span></span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Management</span>
                    </div>
                </div>

                {/* NAVIGATION */}
                <nav className="flex-1 p-3 space-y-1 overflow-y-auto mt-2">
                    <div className="px-3 mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Menu Główne</span>
                    </div>
                    <TabButton
                        active={activeTab === 'entries'}
                        label="Lista startowa"
                        icon={<List className="h-4.5 w-4.5" />}
                        onClick={() => setActiveTab('entries')}
                    />
                    <TabButton
                        active={activeTab === 'schedule'}
                        label="Program Minutowy"
                        icon={<Calendar className="h-4.5 w-4.5" />}
                        onClick={() => setActiveTab('schedule')}
                    />
                    <TabButton
                        active={activeTab === 'results'}
                        label="Wyniki Zawodów"
                        icon={<Trophy className="h-4.5 w-4.5" />}
                        onClick={() => setActiveTab('results')}
                    />
                    <TabButton
                        active={activeTab === 'tools'}
                        label="Ustawienia i Narzędzia"
                        icon={<Settings className="h-4.5 w-4.5" />}
                        onClick={() => setActiveTab('tools')}
                    />
                </nav>

                {/* BOTTOM ACTIONS */}
                <div className="p-3 border-t border-slate-50 bg-slate-50/50 space-y-1">
                    <Link href="/dashboard" className="block w-full">
                        <Button variant="ghost" className="w-full justify-start text-slate-600 hover:text-blue-600 hover:bg-blue-50 h-10 px-3 gap-3 font-bold text-xs transition-all">
                            <ArrowLeft className="h-3.5 w-3.5" />
                            Powrót do Listy
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 h-10 px-3 gap-3 font-bold text-xs transition-all"
                        onClick={() => {
                            useAuthStore.getState().logout();
                            router.push('/login');
                        }}
                    >
                        <LogOut className="h-3.5 w-3.5" />
                        Wyloguj
                    </Button>
                </div>
            </aside>

            {/* MAIN CONTENT AREA */}
            <main className="flex-1 flex flex-col min-w-0 relative h-screen overflow-y-auto">
                {/* TOP HEADER */}
                <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 px-6 py-5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="space-y-2">
                            {/* BREADCRUMBS */}
                            <nav className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                                <Link href="/dashboard" className="hover:text-blue-600 transition-colors">DASHBOARD</Link>
                                <ChevronRight className="h-2.5 w-2.5 opacity-30" />
                                <span className="text-blue-600">{meeting.name}</span>
                            </nav>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                                    {meeting.name}
                                </h1>
                                <div className="flex items-center gap-1.5">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm border ${meeting.season === 'STADIUM' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                        }`}>
                                        {getSeasonLabel(meeting.season)}
                                    </span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider shadow-sm border ${meeting.status === 'OPEN' ? 'bg-green-50 text-green-600 border-green-100 animate-pulse' :
                                        meeting.status === 'DRAFT' ? 'bg-slate-50 text-slate-600 border-slate-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                        }`}>
                                        {getStatusLabel(meeting.status)}
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-bold text-slate-500">
                                <span className="flex items-center gap-1.5 bg-slate-100/50 px-2 py-0.5 rounded-md">
                                    <CalendarDays className="h-3 w-3 text-blue-500" />
                                    {new Date(meeting.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    {meeting.endDate && (
                                        <>
                                            <span className="mx-1 opacity-30">-</span>
                                            {new Date(meeting.endDate).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </>
                                    )}
                                </span>
                                <span className="flex items-center gap-1.5 bg-slate-100/50 px-2 py-0.5 rounded-md">
                                    <MapPin className="h-3 w-3 text-red-500" />
                                    {meeting.location}{meeting.city ? `, ${meeting.city}` : ''} {meeting.country && <span className="text-[10px] opacity-40">({meeting.country})</span>}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Registration button removed */}
                            <Link href={`/results/${meeting.id}`} target="_blank">
                                <Button variant="outline" size="sm" className="bg-white border-slate-200 shadow-sm hover:border-amber-200 hover:bg-amber-50 text-slate-700 h-9 px-3 text-xs font-bold transition-all">
                                    <Trophy className="h-3.5 w-3.5 mr-2 text-amber-500" />
                                    Podgląd Wyników
                                </Button>
                            </Link>
                        </div>
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <div className="p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {(activeTab === 'entries' || activeTab === 'results') && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                            <div className="lg:col-span-3 xl:col-span-3 sticky top-[100px]">
                                <EventsList
                                    meetingId={meeting.id}
                                    events={meeting.events}
                                    selectedEventId={selectedEventId}
                                    onSelectEvent={setSelectedEventId}
                                />
                            </div>
                            <div className="lg:col-span-9 xl:col-span-9">
                                {activeTab === 'entries' ? (
                                    <EntriesTable
                                        selectedEventId={selectedEventId}
                                        event={selectedEvent}
                                        eventStage={selectedEventStage}
                                        meeting={meeting}
                                    />
                                ) : (
                                    <ResultsView
                                        meetingId={meeting.id}
                                        event={selectedEvent}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'schedule' && (
                        <div className="max-w-5xl mx-auto">
                            <ScheduleView meetingId={meeting.id} events={meeting.events} meeting={meeting} />
                        </div>
                    )}

                    {activeTab === 'tools' && (
                        <div className="max-w-6xl mx-auto">
                            <ToolsView meetingId={meeting.id} />
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

interface TabButtonProps {
    active: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

function TabButton({ active, label, icon, onClick }: TabButtonProps) {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 group
                ${active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-x-1'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 hover:translate-x-1'
                }
            `}
        >
            <span className={`transition-transform duration-300 group-hover:scale-110 ${active ? 'text-white' : 'text-slate-400 group-hover:text-blue-500'}`}>
                {icon}
            </span>
            <span className="flex-1 text-left">{label}</span>
            {active && (
                <div className="h-1.5 w-1.5 bg-white rounded-full animate-pulse shadow-sm"></div>
            )}
            {!active && (
                <ChevronRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            )}
        </button>
    );
}
