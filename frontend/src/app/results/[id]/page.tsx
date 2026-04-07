'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import api from '../../../lib/api';
import PublicResultsView from '../../../components/meetings/PublicResultsView';
import TeamStandingsView from '../../../components/meetings/TeamStandingsView';
import {
    Clock,
    Calendar,
    Trophy,
    LayoutGrid,
    ChevronRight,
    Filter,
    ArrowLeft,
    CalendarDays,
    MapPin,
    ExternalLink
} from 'lucide-react';
import Link from 'next/link';

interface Meeting {
    id: string;
    name: string;
    date: string;
    season?: string;
    location: string;
    organizerLogo?: string;
    sponsorLogos: string[];
    domtelOnlineUrl?: string;
    teamScoringEnabled?: boolean;
    events: MeetingEvent[];
}

interface MeetingEvent {
    id: string;
    name: string;
    code: string;
    gender: string;
    startTime?: string;
    completedTime?: string;
    category?: string;
    ageGroup?: string;
    model?: string;
    requiresWind?: boolean;
    trialsMode?: string;
    entries?: Array<{ heat?: number | null }>;
}

interface EventResultSummary {
    id: string;
    status?: string | null;
    place?: number | null;
    time?: string | null;
    bestResult?: string | null;
    resultRounded?: string | null;
    entry?: {
        eventId?: string | null;
    } | null;
}

export default function PublicMeetingResultsPage() {
    const WOMEN_GROUP = 'Kobiety';
    const MEN_GROUP = 'M\u0119\u017Cczy\u017Ani';
    const MIX_GROUP = 'MIX';
    const GENDER_GROUPS = [WOMEN_GROUP, MEN_GROUP, MIX_GROUP] as const;

    const params = useParams();
    const router = useRouter();
    const meetingId = params.id as string;
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [showDomtelEmbed, setShowDomtelEmbed] = useState(false);
    const [showTeamStandings, setShowTeamStandings] = useState(false);
    const resultsSectionRef = useRef<HTMLDivElement | null>(null);

    const { data: meeting, isLoading } = useQuery<Meeting>({
        queryKey: ['meeting-live', meetingId],
        queryFn: async () => {
            const response = await api.get(`/meetings/public/${meetingId}`);
            return response.data;
        },
    });

    const { data: allResults } = useQuery<EventResultSummary[]>({
        queryKey: ['meeting-results-summary', meetingId],
        queryFn: async () => {
            const response = await api.get('/results');
            return response.data;
        },
        enabled: !!meetingId,
        refetchInterval: 10000,
    });

    const selectedEvent = useMemo(() => {
        return meeting?.events?.find(e => e.id === selectedEventId);
    }, [meeting, selectedEventId]);

    const sortedEvents = useMemo(() => {
        const events = [...(meeting?.events || [])];
        return events.sort((a, b) => {
            const aStart = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
            const bStart = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
            if (aStart !== bStart) return aStart - bStart;
            return a.name.localeCompare(b.name, 'pl', { numeric: true, sensitivity: 'base' });
        });
    }, [meeting?.events]);

        const getGenderGroup = (gender?: string) => {
        const normalized = (gender || '').toUpperCase().trim();
        if (normalized === 'K' || normalized === 'F' || normalized === 'W') return WOMEN_GROUP;
        if (normalized === 'M') return MEN_GROUP;
        return MIX_GROUP;
    };

    const groupedEvents = useMemo(() => {
        const groups: Record<string, MeetingEvent[]> = {
            [WOMEN_GROUP]: [],
            [MEN_GROUP]: [],
            [MIX_GROUP]: [],
        };
        sortedEvents.forEach((event) => {
            groups[getGenderGroup(event.gender)].push(event);
        });
        return groups;
    }, [MEN_GROUP, MIX_GROUP, WOMEN_GROUP, sortedEvents]);

    const completedEventIds = useMemo(() => {
        const completed = new Set<string>();

        // 1) Explicit completion from event metadata (LIF or manual input)
        sortedEvents.forEach((event) => {
            if ((event.completedTime || '').trim()) {
                completed.add(event.id);
            }
        });

        // 2) Fallback: infer completion from results presence/status
        if (meeting?.events && allResults) {
            const statsByEventId = new Map<string, { finalized: number; total: number }>();
            const isFinalizedResult = (result: EventResultSummary) => {
                const status = (result.status || '').toUpperCase().trim();
                if (status && status !== 'START_LIST') return true;
                return Boolean(result.time || result.bestResult || result.resultRounded || result.place);
            };

            allResults.forEach((result) => {
                const eventId = result.entry?.eventId;
                if (!eventId) return;

                const current = statsByEventId.get(eventId) || { finalized: 0, total: 0 };
                current.total += 1;
                if (isFinalizedResult(result)) current.finalized += 1;
                statsByEventId.set(eventId, current);
            });

            meeting.events.forEach((event) => {
                const stats = statsByEventId.get(event.id);
                if (!stats) return;

                const seededCount = (event.entries || []).filter((entry) => (entry.heat || 0) > 0).length;
                const expectedCount = seededCount > 0 ? seededCount : stats.total;
                if (stats.finalized > 0 && stats.finalized >= expectedCount) {
                    completed.add(event.id);
                }
            });
        }

        return completed;
    }, [allResults, meeting?.events, sortedEvents]);

    const handleSelectEvent = (eventId: string) => {
        setSelectedEventId(eventId);
        setShowTeamStandings(false);
        setTimeout(() => {
            resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    const handleShowTeamStandings = () => {
        setShowTeamStandings(true);
        setSelectedEventId(null);
        setTimeout(() => {
            resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    const getEventStateClasses = (eventId: string) => {
        const isActive = selectedEventId === eventId;
        const isCompleted = completedEventIds.has(eventId);
        if (isActive) {
            return {
                button: 'bg-blue-600 text-white border-blue-700 shadow-sm',
                row: 'bg-blue-50/50',
                time: 'bg-blue-600 text-white shadow-sm shadow-blue-200',
                title: 'text-blue-900 font-black',
                stripe: 'bg-blue-600',
                code: 'text-blue-700 bg-blue-100',
            };
        }
        if (isCompleted) {
            return {
                button: 'bg-emerald-600 text-white border-emerald-700 shadow-sm',
                row: 'bg-emerald-50/60 hover:bg-emerald-50',
                time: 'bg-emerald-600 text-white shadow-sm shadow-emerald-200',
                title: 'text-emerald-900',
                stripe: 'bg-emerald-500',
                code: 'text-emerald-700 bg-emerald-100',
            };
        }
        return {
            button: 'text-slate-600 border-transparent hover:border-slate-200 hover:bg-slate-50',
            row: 'hover:bg-slate-50',
            time: 'bg-slate-100 text-slate-500',
            title: 'text-slate-700',
            stripe: '',
            code: 'text-slate-400 bg-slate-50',
        };
    };

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

    const getEventTimeLabel = (event: MeetingEvent) =>
        event.startTime
            ? new Date(event.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
            : '--:--';

    const getCompletedTimeLabel = (event: MeetingEvent) => (event.completedTime || '').trim();

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-slate-500 font-medium animate-pulse">{'Inicjalizacja systemu wynik\u00F3w na \u017Cywo...'}</p>
                </div>
            </div>
        );
    }

    if (!meeting) return <div>Nie znaleziono mitingu.</div>;

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
                                {meeting.organizerLogo && (
                                    <img
                                        src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/meetings/uploads/${meeting.organizerLogo}`}
                                        alt="Logo"
                                        className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
                                    />
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
                            {meeting.domtelOnlineUrl && (
                                <a
                                    href={meeting.domtelOnlineUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hidden md:inline-flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 transition-all"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    Domtel Online
                                </a>
                            )}
                            {meeting.domtelOnlineUrl && (
                                <button
                                    type="button"
                                    onClick={() => setShowDomtelEmbed((prev) => !prev)}
                                    className="hidden md:inline-flex items-center gap-1.5 border border-slate-200 rounded-lg px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 transition-all"
                                >
                                    {showDomtelEmbed ? 'Ukryj osadzony Domtel' : 'Pokaż osadzony Domtel'}
                                </button>
                            )}
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

                {/* QUICK EVENT SELECTION (TOP BAR) */}
                <div className="border-t border-slate-100 bg-white shadow-sm hidden sm:block">
                    <div className="max-w-[1600px] mx-auto px-4 py-1 flex flex-col divide-y divide-slate-50">
                                                {GENDER_GROUPS.map((gender) => (
                            groupedEvents[gender].length > 0 && (
                                <div key={gender} className="flex items-center gap-4 py-1.5 overflow-x-auto scroller-hide">
                                    <div className="shrink-0 w-24">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-md block text-center ${gender === WOMEN_GROUP ? 'bg-pink-100 text-pink-700 border border-pink-200' :
                                            gender === MEN_GROUP ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                                'bg-purple-100 text-purple-700 border border-purple-200'
                                            }`}>
                                            {gender === WOMEN_GROUP ? 'KOBIETY' : gender === MEN_GROUP ? 'M\u0118\u017BCZY\u0179NI' : 'MIX / OPEN'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {groupedEvents[gender].map((event) => {
                                            const state = getEventStateClasses(event.id);
                                            const completedTime = getCompletedTimeLabel(event);
                                            return (
                                                <button
                                                    key={event.id}
                                                    onClick={() => handleSelectEvent(event.id)}
                                                    className={`px-3 py-1 rounded text-[11px] font-bold transition-all duration-200 whitespace-nowrap border ${state.button}`}
                                                >
                                                    <span>{getEventLabel(event)}</span>
                                                    {completedTime && (
                                                        <span className="ml-2 text-[10px] font-black opacity-90">
                                                            {`KONIEC ${completedTime}`}
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            </header>

            {meeting.sponsorLogos && meeting.sponsorLogos.length > 0 && (
                <section className="border-b border-slate-100 bg-white/90">
                    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
                        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white px-4 sm:px-6 py-3 shadow-sm">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 text-center">PARTNERZY WYDARZENIA</h4>
                            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
                                {meeting.sponsorLogos.map((logo, idx) => (
                                    <img
                                        key={idx}
                                        src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/meetings/uploads/${logo}`}
                                        alt="Sponsor"
                                        className="h-12 sm:h-14 md:h-16 w-auto object-contain"
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </section>
            )}

            <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row gap-8">

                    {/* SIDEBAR: FULL SCHEDULE */}
                    <aside className="w-full lg:w-80 flex-shrink-0 group">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm uppercase tracking-tight">
                                    <Clock className="h-4 w-4 text-blue-600" />
                                    Harmonogram
                                </h3>
                                <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded">LIVE</span>
                            </div>
                            <div className="font-medium">
                                {sortedEvents.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-sm italic">Brak zaplanowanych konkurencji</div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {sortedEvents.map((event) => {
                                            const state = getEventStateClasses(event.id);
                                            const genderGroup = getGenderGroup(event.gender);
                                            const completedTime = getCompletedTimeLabel(event);
                                            return (
                                                <button
                                                    key={event.id}
                                                    onClick={() => handleSelectEvent(event.id)}
                                                    className={`w-full text-left p-4 transition-all duration-200 relative group flex items-start gap-4 ${state.row}`}
                                                >
                                                    {state.stripe && (
                                                        <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r ${state.stripe}`}></div>
                                                    )}
                                                    <span className={`mt-0.5 shrink-0 px-2 py-1 rounded-md text-[12px] font-mono font-black tracking-wide ${state.time}`}>
                                                        {getEventTimeLabel(event)}
                                                    </span>
                                                    <div className="flex-1">
                                                        <p className={`text-[13px] font-bold leading-none ${state.title}`}>
                                                            {event.name}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-1.5">
                                                            <span className={`text-[9px] font-black uppercase px-1 rounded ${genderGroup === WOMEN_GROUP ? 'bg-pink-50 text-pink-600' :
                                                                genderGroup === MEN_GROUP ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                                                                }`}>
                                                                {genderGroup === WOMEN_GROUP ? 'K' : genderGroup === MEN_GROUP ? 'M' : 'MIX'}
                                                            </span>
                                                            <span className={`text-[10px] font-bold px-1 rounded ${state.code}`}>
                                                                {event.code}
                                                            </span>
                                                            {completedTime && (
                                                                <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1 rounded">
                                                                    {`KONIEC ${completedTime}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Team standings button */}
                        {meeting.teamScoringEnabled && (
                            <button
                                onClick={handleShowTeamStandings}
                                className={`w-full mt-3 flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-bold transition-all ${showTeamStandings
                                    ? 'bg-yellow-500 text-white border-yellow-600 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-yellow-50 hover:border-yellow-200 hover:text-yellow-700'
                                    }`}
                            >
                                <Trophy className="h-4 w-4" />
                                Klasyfikacja drużynowa
                            </button>
                        )}

                    </aside>

                    {/* MAIN CONTENT: RESULTS TABLE */}
                    <div ref={resultsSectionRef} className="flex-1 min-w-0">
                        {meeting.domtelOnlineUrl && showDomtelEmbed && (
                            <div className="mb-6 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                                <div className="px-4 py-2 border-b border-slate-100 text-xs font-black uppercase tracking-wider text-slate-500">
                                    Domtel Online - widok osadzony
                                </div>
                                <iframe
                                    title="Domtel Online"
                                    src={meeting.domtelOnlineUrl}
                                    className="w-full h-[560px] bg-white"
                                />
                            </div>
                        )}
                        {showTeamStandings ? (
                            <div className="animate-in slide-in-from-bottom-2 duration-500 transition-all">
                                <TeamStandingsView meetingId={meetingId} />
                            </div>
                        ) : !selectedEventId ? (
                            <div className="h-[600px] flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed animate-in fade-in duration-700">
                                <div className="relative mb-8">
                                    <div className="absolute inset-0 bg-blue-100 rounded-full blur-3xl opacity-50 scale-150 animate-pulse"></div>
                                    <LayoutGrid className="h-16 w-16 text-blue-600/20 relative" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">{'Platforma Wynik\u00F3w na \u017Bywo'}</h2>
                                <p className="text-slate-500 max-w-sm text-center text-sm leading-relaxed">
                                    {'Wybierz konkurencj\u0119 z g\u00F3rnego paska lub harmonogramu, aby \u015Bledzi\u0107 rywalizacj\u0119 w czasie rzeczywistym.'}
                                </p>
                            </div>
                        ) : (
                            <div className="animate-in slide-in-from-bottom-2 duration-500 transition-all">
                                <PublicResultsView
                                    eventId={selectedEventId}
                                    eventName={selectedEvent?.name}
                                    model={selectedEvent?.model}
                                    eventCode={selectedEvent?.code}
                                    trialsMode={selectedEvent?.trialsMode}
                                    completedTime={selectedEvent?.completedTime}
                                    meetingSeason={meeting?.season}
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
