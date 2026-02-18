'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Trophy, Wifi, Clock, Layers } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

const getIsField = (eventName?: string, model?: string) => {
    const technicalKeywords = [
        'kul', 'dysk', 'młot', 'oszczep', 'dal', 'trójskok', 'wzwyż', 'tycz', 'piłecz',
        'lj', 'tj', 'sp', 'dt', 'jt', 'ht', 'hj', 'pv'
    ];
    const lowerName = (eventName || '').toLowerCase();
    const isTechName = technicalKeywords.some(keyword => lowerName.includes(keyword));
    const isTechModel = !!(model && (model.startsWith('FIELD') || model.startsWith('VERTICAL') || model.startsWith('QUALIFICATION')));
    return isTechName || isTechModel;
};

interface Result {
    id: string;
    place: number;
    time: string;
    wind?: number;
    status: string;
    entry: {
        athleteName: string;
        bib: string;
        heat: number;
        lane: number;
        club?: string;
        pb?: string;
        sb?: string;
        yearOfBirth?: number;
        dateOfBirth?: string | Date;
    };
}

interface PublicResultsViewProps {
    eventId: string | null;
    eventName?: string;
    model?: string;
    requiresWind?: boolean;
}

export default function PublicResultsView({ eventId, eventName, model, requiresWind }: PublicResultsViewProps) {
    const [isLive, setIsLive] = useState(false);
    const [activeTab, setActiveTab] = useState<string | number>('ALL');
    const [groupByYear, setGroupByYear] = useState(false);

    const { data: results, isLoading, refetch } = useQuery<Result[]>({
        queryKey: ['public-results', eventId],
        queryFn: async () => {
            const response = await api.get(`/results?eventId=${eventId}`);
            return response.data;
        },
        enabled: !!eventId,
    });

    // Socket.io for Live Updates
    useEffect(() => {
        if (!eventId) return;

        const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');

        socket.on('connect', () => {
            setIsLive(true);
            socket.emit('joinEvent', eventId);
        });

        socket.on('resultsUpdated', () => {
            refetch();
        });

        socket.on('disconnect', () => setIsLive(false));

        return () => {
            socket.disconnect();
        };
    }, [eventId, refetch]);

    const heats = useMemo(() => {
        if (!results) return [];
        // For field events with only one group, we don't need tabs if it's just group 1
        const h = Array.from(new Set(results.map(r => r.entry.heat || 1))).sort((a, b) => a - b);
        return h;
    }, [results]);

    const isField = getIsField(eventName, model);

    // If it's a field event and there's only one group, we don't need the "ALL" / "GROUP 1" tabs
    const showTabs = heats.length > 1 || !isField;

    const processedResults = useMemo(() => {
        if (!results) return { type: 'FLAT', data: [] as Result[] };

        // 1. Filter by current tab (Heat or ALL)
        let filtered = results;
        if (activeTab !== 'ALL') {
            filtered = results.filter(r => (r.entry.heat || 1) === activeTab);
        }

        // 2. Sort by performance
        const sorted = [...filtered].sort((a, b) => {
            // Place is primary if available, otherwise time
            if (a.place && b.place) return a.place - b.place;
            if (!a.time && !b.time) return 0;
            if (!a.time) return 1;
            if (!b.time) return -1;
            return a.time.localeCompare(b.time);
        });

        // 3. Handle Grouping
        if (groupByYear && activeTab === 'ALL') {
            const groups: Record<number, Result[]> = {};
            sorted.forEach(r => {
                const year = r.entry.yearOfBirth || (r.entry.dateOfBirth ? new Date(r.entry.dateOfBirth).getFullYear() : 0);
                if (!groups[year]) groups[year] = [];
                groups[year].push(r);
            });

            // Return as sorted entries but with recalculated ranks for the UI mapping
            const groupedArray: { year: number, data: Result[] }[] = Object.keys(groups)
                .map(Number)
                .sort((a, b) => b - a) // Recent years first
                .map(year => ({
                    year,
                    data: groups[year].sort((a, b) => {
                        if (!a.time && !b.time) return 0;
                        if (!a.time) return 1;
                        if (!b.time) return -1;
                        return a.time.localeCompare(b.time);
                    })
                }));

            return { type: 'GROUPED', data: groupedArray };
        }

        return { type: 'FLAT', data: sorted };
    }, [results, activeTab, groupByYear]);

    if (!eventId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Trophy className="h-16 w-16 mb-4 opacity-5 shadow-inner" />
                <p className="text-lg font-medium">Wybierz konkurencję, aby zobaczyć wyniki</p>
            </div>
        );
    }

    const TableHeader = () => (
        <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">LP</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">
                    {getIsField(eventName, model) ? 'KOL' : 'TOR'}
                </th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">NUMER</th>
                <th className="px-5 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ZAWODNIK</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">DATA UR.</th>
                <th className="px-5 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">KLUB / KRAJ</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">PB</th>
                <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">SB</th>
                <th className="px-5 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">WYNIK</th>
            </tr>
        </thead>
    );

    const ResultRow = ({ result, rank }: { result: Result, rank: number }) => {
        const isMedal = rank <= 3 && result.status !== 'START_LIST';
        const isStartList = result.status === 'START_LIST';

        return (
            <tr className={`transition-all duration-300 hover:bg-blue-50/30 group ${rank === 1 && !isStartList ? 'bg-yellow-50/30' :
                rank === 2 && !isStartList ? 'bg-slate-50/40' :
                    rank === 3 && !isStartList ? 'bg-orange-50/30' : ''
                } ${isStartList ? 'opacity-80' : ''}`}>
                <td className="px-5 py-4 text-center">
                    <div className={`flex items-center justify-center h-8 w-8 mx-auto rounded-full font-black text-xs shadow-sm ${rank === 1 && !isStartList ? 'bg-yellow-400 text-yellow-900 border-2 border-white' :
                        rank === 2 && !isStartList ? 'bg-slate-300 text-slate-800 border-2 border-white' :
                            rank === 3 && !isStartList ? 'bg-orange-300 text-orange-900 border-2 border-white' :
                                'bg-white text-slate-400 border border-slate-100'
                        }`}>
                        {rank || '-'}
                    </div>
                </td>
                <td className="px-5 py-4 text-center font-bold text-slate-400">
                    {getIsField(eventName, model) ? result.entry.lane || '-' : result.entry.lane || '-'}
                </td>
                <td className="px-5 py-4 text-center">
                    <span className="bg-slate-100 px-2 py-1 rounded text-[11px] font-mono font-bold text-slate-600 border border-slate-200">
                        {result.entry.bib || '-'}
                    </span>
                </td>
                <td className="px-5 py-4">
                    <div className="font-black text-slate-900 tracking-tight text-[15px] uppercase group-hover:text-blue-700 transition-colors">
                        {result.entry.athleteName}
                        {isStartList && <span className="ml-2 text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold tracking-widest">LISTA</span>}
                    </div>
                </td>
                <td className="px-5 py-4 text-center font-medium text-slate-500 text-xs">
                    {result.entry.yearOfBirth || (result.entry.dateOfBirth ? new Date(result.entry.dateOfBirth).getFullYear() : '-')}
                </td>
                <td className="px-5 py-4"><span className="text-xs font-bold text-slate-500 truncate block max-w-[250px]">{result.entry.club || 'Brak klubu'}</span></td>
                <td className="px-5 py-4 text-center text-[11px] font-medium text-slate-400">{result.entry.pb || '-'}</td>
                <td className="px-5 py-4 text-center text-[11px] font-medium text-slate-400">{result.entry.sb || '-'}</td>
                <td className="px-5 py-4 text-right">
                    <div className="flex flex-col items-end">
                        <span className={`text-[17px] font-black font-mono leading-none tracking-tighter ${isStartList ? 'text-slate-300 italic text-sm' : (isMedal ? 'text-slate-900' : 'text-blue-700')
                            }`}>
                            {isStartList ? 'Brak wyniku' : result.time}
                        </span>
                        {!isStartList && requiresWind && result.wind !== undefined && (
                            <span className="text-[10px] font-bold text-slate-400 mt-1">
                                {result.wind > 0 ? `+${result.wind}` : result.wind} m/s
                            </span>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* EVENT HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-yellow-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-yellow-200 shrink-0">
                            <Trophy className="h-5 w-5" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {eventName}
                        </h2>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                    {activeTab === 'ALL' && (
                        <button
                            onClick={() => setGroupByYear(!groupByYear)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${groupByYear ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100' : 'bg-white border-slate-200 text-slate-500 hover:border-blue-400'
                                }`}
                        >
                            <Layers className="h-3.5 w-3.5" />
                            Klasyfikacja Rocznikami
                        </button>
                    )}
                    {isLive && (
                        <span className="flex items-center gap-2 text-[10px] bg-red-50 text-red-600 px-3 py-1.5 rounded-full animate-pulse border border-red-100 font-black tracking-[0.1em] uppercase shadow-sm">
                            <div className="w-1.5 h-1.5 bg-red-600 rounded-full"></div>
                            Live Updates
                        </span>
                    )}
                </div>
            </div>

            {/* HEAT TABS */}
            {showTabs && (
                <div className="flex items-center border-b border-slate-200 overflow-x-auto scroller-hide gap-1">
                    <button
                        onClick={() => setActiveTab('ALL')}
                        className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'ALL' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {isField ? 'ZBIORCZA' : 'Wszystkie serie'}
                        {activeTab === 'ALL' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t shadow-lg shadow-blue-200"></div>}
                    </button>
                    {heats.map((hX: any) => (
                        <button
                            key={hX}
                            onClick={() => setActiveTab(hX)}
                            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === hX ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {isField ? `GRUPA ${hX}` : `BIEG ${hX}`}
                            {activeTab === hX && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t shadow-lg shadow-blue-200"></div>}
                        </button>
                    ))}
                </div>
            )}

            {/* TABLE CONTAINER */}
            <div className="space-y-3">
                {isLoading ? (
                    <div className="py-24 text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-400 font-medium animate-pulse">Pobieranie oficjalnych wyników...</p>
                    </div>
                ) : processedResults.type === 'FLAT' ? (
                    processedResults.data.length === 0 ? (
                        <div className="py-24 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <Clock className="h-16 w-16 mx-auto mb-4 text-slate-100" />
                            <p className="font-bold text-slate-900 mb-1 tracking-tight">Oczekiwanie na start</p>
                            <p className="text-slate-400 text-sm">Wyniki pojawią się automatycznie po zakończeniu biegu.</p>
                        </div>
                    ) : (
                        <Card className="overflow-hidden border border-slate-200 shadow-2xl shadow-blue-900/5 bg-white rounded-2xl">
                            <CardContent className="p-0 overflow-x-auto scroller">
                                <table className="w-full text-sm">
                                    <TableHeader />
                                    <tbody className="divide-y divide-slate-50">
                                        {processedResults.data.map((r: any, idx: number) => (
                                            <ResultRow key={r.id} result={r} rank={r.place || idx + 1} />
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )
                ) : (
                    <div className="space-y-8">
                        {processedResults.data.map((group: any) => (
                            <div key={group.year} className="space-y-3">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="h-8 w-1.5 bg-blue-600 rounded-full"></div>
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Rocznik {group.year || 'Nieznany'}</h3>
                                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-widest">{group.data.length} ZAWODNIKÓW</span>
                                </div>
                                <Card className="overflow-hidden border border-slate-200 shadow-lg bg-white rounded-2xl">
                                    <CardContent className="p-0 overflow-x-auto scroller">
                                        <table className="w-full text-sm">
                                            <TableHeader />
                                            <tbody className="divide-y divide-slate-50">
                                                {group.data.map((r: any, idx: number) => (
                                                    <ResultRow key={r.id} result={r} rank={idx + 1} />
                                                ))}
                                            </tbody>
                                        </table>
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 pt-4">
                    <div className="flex items-center gap-4">
                        <span>STATUS: {isLive ? 'SYSTEM AKTYWNY' : 'PODGLĄD OFFLINE'}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span>FREKWENCJA: {results?.length || 0} STARTUJĄCYCH</span>
                        {groupByYear && <><span className="w-1 h-1 bg-slate-300 rounded-full"></span><span>TRYB: GRUPOWANIE ROCZNIKAMI</span></>}
                    </div>
                </div>
            </div>
        </div>
    );
}

