'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Trophy, Wifi, Clock, Layers, ExternalLink } from 'lucide-react';
import { Fragment, useEffect, useState, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { eventRequiresWind, isMultiEvent } from '../../lib/utils';

const normalizeForMatch = (value: string = '') =>
    value
        .toLowerCase()
        .replace(/\u0142/g, 'l')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const getCodeBase = (code?: string) =>
    normalizeForMatch(code || '').replace(/[^a-z0-9]/g, '');

const getIsField = (eventName?: string, model?: string, eventCode?: string) => {
    const technicalKeywords = [
        'kul', 'kula', 'dysk', 'mlot', 'oszczep', 'dal', 'trojskok', 'wieloskok', 'wzwyz', 'tycz', 'pilecz',
        'long jump', 'triple jump', 'shot put', 'discus', 'javelin', 'hammer',
        'high jump', 'pole vault'
    ];
    const technicalCodes = ['lj', 'tj', 'sp', 'dt', 'jt', 'ht', 'hj', 'pv', 'bx'];
    const lowerName = normalizeForMatch(eventName || '');
    const codeBase = getCodeBase(eventCode);
    const lowerModel = (model || '').toLowerCase();
    const isTechName = technicalKeywords.some((keyword) => lowerName.includes(keyword));
    const isTechCode = technicalCodes.some((code) => codeBase.startsWith(code));
    const isTechModel = ['field', 'vertical', 'qualification'].some((prefix) => lowerModel.startsWith(prefix));
    return isTechName || isTechCode || isTechModel;
};

interface Result {
    id: string;
    place: number;
    time: string;
    wind?: number;
    status: string;
    points?: number | null;
    isOverall?: boolean;
    totalPoints?: number;
    details?: {
        eventName: string;
        eventCode: string;
        performance: string;
        points: number;
    }[];
    verticalJSON?: string;
    fieldJSON?: string;
    round1Result?: string;
    round1Wind?: number | null;
    round2Result?: string;
    round2Wind?: number | null;
    round3Result?: string;
    round3Wind?: number | null;
    round4Result?: string;
    round4Wind?: number | null;
    round5Result?: string;
    round5Wind?: number | null;
    round6Result?: string;
    round6Wind?: number | null;
    bestResult?: string;
    entry: {
        athleteName: string;
        bib: string;
        heat: number;
        lane: number;
        tilastopajaId?: string;
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
    eventCode?: string;
    trialsMode?: string;
    completedTime?: string;
    meetingSeason?: string;
}

const getIsVertical = (eventName?: string, model?: string, eventCode?: string) => {
    const lowerName = normalizeForMatch(eventName || '');
    const codeBase = getCodeBase(eventCode);
    const lowerModel = (model || '').toLowerCase();
    const isVerticalName = ['wzwy', 'tycz', 'high jump', 'pole vault'].some((keyword) => lowerName.includes(keyword));
    const isVerticalCode = ['hj', 'pv'].some((code) => codeBase.startsWith(code));
    return lowerModel.startsWith('vertical') || isVerticalName || isVerticalCode;
};

const ATTEMPT_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const getAttemptLabel = (idx: number) => ATTEMPT_ROMAN[idx] || `P${idx + 1}`;

const getIsHorizontalJump = (eventName?: string, eventCode?: string) => {
    const lowerName = normalizeForMatch(eventName || '');
    const codeBase = getCodeBase(eventCode);
    return codeBase.startsWith('lj') ||
        codeBase.startsWith('tj') ||
        lowerName.includes('dal') ||
        lowerName.includes('trojskok') ||
        lowerName.includes('wieloskok') ||
        lowerName.includes('long jump') ||
        lowerName.includes('triple jump');
};

const formatWind = (wind: number) => {
    const normalized = Number.isInteger(wind) ? `${wind}.0` : wind.toFixed(1);
    return wind > 0 ? `+${normalized}` : normalized;
};

const getPzlaUrl = (entry: { athleteName?: string; tilastopajaId?: string }, meetingSeason?: string) => {
    const r = meetingSeason === 'INDOOR' ? 2 : 1;
    if (entry.tilastopajaId) {
        return `https://statystyka.pzla.pl/personal.php?page=profile&nr_zaw=${entry.tilastopajaId}&r=${r}`;
    }

    const fullName = (entry.athleteName || '').trim();
    const parts = fullName.split(/\s+/).filter(Boolean);
    const lastName = parts.length > 1 ? parts[parts.length - 1] : (parts[0] || '');
    const firstName = parts.length > 1 ? parts.slice(0, parts.length - 1).join(' ') : '';

    return `https://statystyka.pzla.pl/baza/index.php?file=Szukaj&zawodnik=${encodeURIComponent(lastName)}&zawodnik_imie=${encodeURIComponent(firstName)}`;
};

type FieldAttemptCard = { label: string; value: string; wind?: number | null };
type VerticalAttemptCard = { label: string; value: string };

const getRoundCount = (model?: string, trialsMode?: string, isFieldEvent?: boolean) => {
    if (!isFieldEvent) return 0;

    if (trialsMode) {
        if (trialsMode === '3') return 3;
        if (trialsMode === '4') return 4;
        if (trialsMode === '3+3' || trialsMode === '6') return 6;
    }

    const upperModel = (model || '').toUpperCase();
    if (upperModel.includes('FIELD_6') || upperModel.includes('STANDARD_FINAL')) return 6;
    if (upperModel.includes('FIELD_4')) return 4;
    if (upperModel.includes('MULTI') || upperModel.includes('QUALIFICATION')) return 3;
    return 6;
};

const getFieldAttemptCards = (result: Result, maxAttempts: number): FieldAttemptCard[] => {
    const rounds = [
        { value: result.round1Result, wind: result.round1Wind },
        { value: result.round2Result, wind: result.round2Wind },
        { value: result.round3Result, wind: result.round3Wind },
        { value: result.round4Result, wind: result.round4Wind },
        { value: result.round5Result, wind: result.round5Wind },
        { value: result.round6Result, wind: result.round6Wind },
    ];
    const limitedRounds = rounds.slice(0, Math.max(0, maxAttempts));

    const hasRoundValues = limitedRounds.some((r) =>
        (r.value !== undefined && r.value !== null && r.value.toString().trim() !== '') ||
        r.wind !== undefined && r.wind !== null
    );
    if (hasRoundValues) {
        return limitedRounds.map((r, idx) => ({
            label: getAttemptLabel(idx),
            value: r.value && r.value.toString().trim() ? r.value.toString().trim() : '-',
            wind: r.wind,
        }));
    }

    if (!result.fieldJSON) return [];
    try {
        const parsed = JSON.parse(result.fieldJSON);
        if (!Array.isArray(parsed)) return [];
        return parsed.slice(0, Math.max(0, maxAttempts)).map((value: unknown, idx: number) => ({
            label: getAttemptLabel(idx),
            value: typeof value === 'string' && value.trim() ? value.trim() : '-',
            wind: null,
        }));
    } catch {
        return [];
    }
};

const getVerticalAttemptCards = (result: Result): VerticalAttemptCard[] => {
    if (!result.verticalJSON) return [];
    try {
        const parsed = JSON.parse(result.verticalJSON) as Record<string, string>;
        const entries = Object.entries(parsed);
        return entries
            .sort(([a], [b]) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')))
            .map(([height, mark]) => ({ label: height, value: mark?.trim() ? mark : '-' }));
    } catch {
        return [];
    }
};
type ProcessedResults =
    | { type: 'FLAT'; data: Result[] }
    | { type: 'GROUPED'; data: { year: number; data: Result[] }[] };

interface ResultsTableHeaderProps {
    isOverall: boolean;
    isField: boolean;
    hasPoints: boolean;
}

function ResultsTableHeader({ isOverall, isField, hasPoints }: ResultsTableHeaderProps) {
    return (
        <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
                <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">LP</th>
                {!isOverall && (
                    <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-20">
                        {isField ? 'KOL' : 'SER/TOR'}
                    </th>
                )}
                <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">NUMER</th>
                <th className="px-5 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">ZAWODNIK</th>
                {!isOverall && <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">DATA UR.</th>}
                <th className="px-5 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">KLUB / KRAJ</th>
                {!isOverall && (
                    <>
                        <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">PB</th>
                        <th className="px-5 py-4 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">SB</th>
                    </>
                )}
                <th className="px-5 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-24">
                    {isOverall ? 'PUNKTY' : 'WYNIK'}
                </th>
                {!isOverall && hasPoints && (
                    <th className="px-5 py-4 text-right text-[10px] font-black text-blue-500 uppercase tracking-widest w-20">PUNKTY</th>
                )}
            </tr>
        </thead>
    );
}

interface ResultTableRowProps {
    result: Result;
    rank: number;
    isField: boolean;
    isVertical: boolean;
    isHorizontalJump: boolean;
    showAllAttempts: boolean;
    requiresWind: boolean;
    hasPoints: boolean;
    roundCount: number;
    meetingSeason?: string;
}

function ResultTableRow({ result, rank, isField, isVertical, isHorizontalJump, showAllAttempts, requiresWind, hasPoints, roundCount, meetingSeason }: ResultTableRowProps) {
    const isMedal = rank <= 3 && result.status !== 'START_LIST';
    const isStartList = result.status === 'START_LIST';
    const fieldCards = isField ? getFieldAttemptCards(result, roundCount) : [];
    const verticalCards = isVertical ? getVerticalAttemptCards(result) : [];
    const hasAttemptCards = (isField ? fieldCards.length : verticalCards.length) > 0;
    const shouldShowAttempts = showAllAttempts && (isField || isVertical) && !result.isOverall && !isStartList && hasAttemptCards;
    const technicalColSpan = hasPoints ? 10 : 9;
    const showGlobalWind = requiresWind && !isField && !isVertical;
    const athleteProfileUrl = getPzlaUrl(result.entry, meetingSeason);

    return (
        <Fragment>
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
            {!result.isOverall && (
                <td className="px-5 py-4 text-center font-bold text-slate-400 text-xs">
                    {isField ? result.entry.lane || '-' : `${result.entry.heat || 1}/${result.entry.lane || '-'}`}
                </td>
            )}
            <td className="px-5 py-4 text-center">
                <span className="bg-slate-100 px-2 py-1 rounded text-[11px] font-mono font-bold text-slate-600 border border-slate-200">
                    {result.entry.bib || '-'}
                </span>
            </td>
            <td className="px-5 py-4">
                <div className="flex items-center gap-2">
                    <div className="font-black text-slate-900 tracking-tight text-[15px] uppercase group-hover:text-blue-700 transition-colors">
                        {result.entry.athleteName}
                        {isStartList && <span className="ml-2 text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded font-bold tracking-widest">LISTA</span>}
                    </div>
                    {!result.isOverall && (
                        <a
                            href={athleteProfileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Profil statystyczny PZLA"
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 bg-white text-slate-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
                        >
                            <ExternalLink className="h-3 w-3" />
                        </a>
                    )}
                </div>
            </td>
            {!result.isOverall && (
                <td className="px-5 py-4 text-center font-medium text-slate-500 text-xs">
                    {result.entry.yearOfBirth || (result.entry.dateOfBirth ? new Date(result.entry.dateOfBirth).getFullYear() : '-')}
                </td>
            )}
            <td className="px-5 py-4"><span className="text-xs font-bold text-slate-500 truncate block max-w-[250px]">{result.entry.club || 'Brak klubu'}</span></td>
            {!result.isOverall && (
                <>
                    <td className="px-5 py-4 text-center text-[11px] font-medium text-slate-400">{result.entry.pb || '-'}</td>
                    <td className="px-5 py-4 text-center text-[11px] font-medium text-slate-400">{result.entry.sb || '-'}</td>
                </>
            )}
            <td className="px-5 py-4 text-right">
                <div className="flex flex-col items-end">
                    <span className={`text-[17px] font-black font-mono leading-none tracking-tighter ${result.isOverall ? 'text-blue-700' : (isStartList ? 'text-slate-300 italic text-sm' : (isMedal ? 'text-slate-900' : 'text-blue-700'))
                        }`}>
                        {result.isOverall ? result.totalPoints : (isStartList ? 'Brak wyniku' : (result.time || result.bestResult || '-'))}
                    </span>
                    {!isStartList && !result.isOverall && showGlobalWind && result.wind !== undefined && result.wind !== null && (
                        <span className="text-[10px] font-bold text-slate-400 mt-1">
                            {result.wind > 0 ? `+${result.wind}` : result.wind} m/s
                        </span>
                    )}
                </div>
            </td>
            {!result.isOverall && hasPoints && (
                <td className="px-5 py-4 text-right font-black text-blue-600 font-mono text-[15px]">
                    {result.points || '-'}
                </td>
            )}
            </tr>
            {shouldShowAttempts && (
                <tr className="bg-slate-50/60">
                    <td colSpan={technicalColSpan} className="px-4 pb-4 pt-1">
                        {isField && (
                            <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                                {fieldCards.map((card, idx) => (
                                    <div key={`${result.id}-attempt-card-${idx}`} className="rounded-md border border-slate-200 bg-white px-2 py-2">
                                        <div className="text-[10px] font-black text-slate-400 mb-1">{card.label}</div>
                                        <div className="w-full h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-slate-900">
                                            {card.value}
                                        </div>
                                        {isHorizontalJump && (
                                            <>
                                                <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 text-center">wiatr</div>
                                                <div className="w-full h-6 mt-0.5 flex items-center justify-center bg-white border border-slate-200 rounded text-[10px] font-mono text-slate-700">
                                                    {card.wind !== undefined && card.wind !== null ? (card.wind > 0 ? `+${card.wind}` : `${card.wind}`) : '-'}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                        {isVertical && (
                            <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))' }}>
                                {verticalCards.map((card, idx) => (
                                    <div key={`${result.id}-vertical-card-${idx}`} className="rounded-md border border-slate-200 bg-white px-2 py-2">
                                        <div className="text-[10px] font-black text-slate-500 mb-1 text-center">{card.label}</div>
                                        <div className="w-full h-8 flex items-center justify-center bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold text-slate-900">
                                            {card.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </Fragment>
    );
}

export default function PublicResultsView({ eventId, eventName, model, eventCode, trialsMode, completedTime, meetingSeason }: PublicResultsViewProps) {
    const requiresWind = eventRequiresWind(eventName || '', eventCode || '');
    const [isLive, setIsLive] = useState(false);
    const [activeTab, setActiveTab] = useState<string | number>('ALL');
    const [groupByYear, setGroupByYear] = useState(false);
    const [showAllAttempts, setShowAllAttempts] = useState(true);

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

    const heatWindMap = useMemo(() => {
        const map = new Map<number, number>();
        if (!results) return map;

        const buckets = new Map<number, number[]>();
        results.forEach((r) => {
            if (r.wind === undefined || r.wind === null || Number.isNaN(Number(r.wind))) return;
            const heat = r.entry.heat || 1;
            if (!buckets.has(heat)) buckets.set(heat, []);
            buckets.get(heat)?.push(Number(r.wind));
        });

        buckets.forEach((values, heat) => {
            if (values.length === 0) return;

            // Pick most frequent rounded value to avoid micro-differences from source files.
            const counts = new Map<string, number>();
            values.forEach((v) => {
                const key = (Math.round(v * 10) / 10).toFixed(1);
                counts.set(key, (counts.get(key) || 0) + 1);
            });

            let bestKey: string | null = null;
            let bestCount = -1;
            counts.forEach((count, key) => {
                if (count > bestCount) {
                    bestCount = count;
                    bestKey = key;
                }
            });

            if (bestKey !== null) {
                map.set(heat, Number(bestKey));
            }
        });

        return map;
    }, [results]);

    const isField = getIsField(eventName, model, eventCode);
    const isVertical = getIsVertical(eventName, model, eventCode);
    const isHorizontalJump = getIsHorizontalJump(eventName, eventCode);
    const roundCount = getRoundCount(model, trialsMode, isField);
    const hasTechnicalResultShape = results?.some((r) =>
        !!(r.bestResult || r.fieldJSON || r.verticalJSON || r.round1Result || r.round2Result || r.round3Result || r.round4Result || r.round5Result || r.round6Result)
    ) ?? false;
    const isTechnical = isField || isVertical || hasTechnicalResultShape;

    // If it's a field event and there's only one group, we don't need the "ALL" / "GROUP 1" tabs
    const showTabs = heats.length > 1 || !isField;

    const processedResults = useMemo<ProcessedResults>(() => {
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
    const isOverall = results?.[0]?.isOverall ?? false;
    const isMultiContext =
        isOverall ||
        isMultiEvent(eventName || '') ||
        (model || '').toUpperCase().includes('MULTI');
    const hasPoints =
        isMultiContext &&
        (results?.some((r) => r.points !== null || r.totalPoints !== undefined) ?? false);
    const showSeriesWind = !isField && (requiresWind || heatWindMap.size > 0);
    const activeHeatWind =
        activeTab === 'ALL' || typeof activeTab !== 'number'
            ? null
            : heatWindMap.get(activeTab) ?? null;

    if (!eventId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <Trophy className="h-16 w-16 mb-4 opacity-5 shadow-inner" />
                <p className="text-lg font-medium">{'Wybierz konkurencj\u0119, aby zobaczy\u0107 wyniki'}</p>
            </div>
        );
    }

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
                    {completedTime && (
                        <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1">
                            <Clock className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                {`Zakończono: ${completedTime}`}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 self-end sm:self-center">
                    {!isOverall && isTechnical && (
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-700">Próby</span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={showAllAttempts}
                                onClick={() => setShowAllAttempts((prev) => !prev)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${showAllAttempts ? 'bg-green-500' : 'bg-slate-300'}`}
                            >
                                <span
                                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${showAllAttempts ? 'translate-x-5' : 'translate-x-0.5'}`}
                                />
                            </button>
                        </div>
                    )}
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
                    {heats.map((hX: number) => (
                        <button
                            key={hX}
                            onClick={() => setActiveTab(hX)}
                            className={`px-6 py-3 text-xs font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === hX ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {isField ? `GRUPA ${hX}` : `BIEG ${hX}`}
                            {showSeriesWind && heatWindMap.has(hX) && (
                                <span className="ml-2 text-[10px] font-black normal-case tracking-normal">
                                    {`${formatWind(heatWindMap.get(hX) || 0)} m/s`}
                                </span>
                            )}
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
                        <p className="text-slate-400 font-medium animate-pulse">{'Pobieranie oficjalnych wynik\u00F3w...'}</p>
                    </div>
                ) : processedResults.type === 'FLAT' ? (
                    <>
                        {showSeriesWind && activeTab !== 'ALL' && activeHeatWind !== null && (
                            <div className="inline-flex items-center gap-2 rounded-lg bg-sky-50 border border-sky-200 px-3 py-1.5">
                                <span className="text-[10px] font-black uppercase tracking-widest text-sky-700">
                                    {`Wiatr serii ${activeTab}: ${formatWind(activeHeatWind)} m/s`}
                                </span>
                            </div>
                        )}
                        {processedResults.data.length === 0 ? (
                        <div className="py-24 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                            <Clock className="h-16 w-16 mx-auto mb-4 text-slate-100" />
                            <p className="font-bold text-slate-900 mb-1 tracking-tight">Oczekiwanie na start</p>
                            <p className="text-slate-400 text-sm">{'Wyniki pojawi\u0105 si\u0119 automatycznie po zako\u0144czeniu biegu.'}</p>
                        </div>
                    ) : (
                        <Card className="overflow-hidden border border-slate-200 shadow-2xl shadow-blue-900/5 bg-white rounded-2xl">
                            <CardContent className="p-0 overflow-x-auto scroller">
                                <table className="w-full text-sm">
                                    <ResultsTableHeader isOverall={isOverall} isField={isField} hasPoints={hasPoints} />
                                    <tbody className="divide-y divide-slate-50">
                                        {processedResults.data.map((r: Result, idx: number) => (
                                            <ResultTableRow key={r.id} result={r} rank={r.place || idx + 1} isField={isField} isVertical={isVertical} isHorizontalJump={isHorizontalJump} showAllAttempts={showAllAttempts} requiresWind={requiresWind} hasPoints={hasPoints} roundCount={roundCount} meetingSeason={meetingSeason} />
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                    )}
                    </>
                ) : (
                    <div className="space-y-8">
                        {processedResults.data.map((group) => (
                            <div key={group.year} className="space-y-3">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="h-8 w-1.5 bg-blue-600 rounded-full"></div>
                                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Rocznik {group.year || 'Nieznany'}</h3>
                                    <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md uppercase tracking-widest">{group.data.length}{' ZAWODNIK\u00D3W'}</span>
                                </div>
                                <Card className="overflow-hidden border border-slate-200 shadow-lg bg-white rounded-2xl">
                                    <CardContent className="p-0 overflow-x-auto scroller">
                                        <table className="w-full text-sm">
                                            <ResultsTableHeader isOverall={isOverall} isField={isField} hasPoints={hasPoints} />
                                            <tbody className="divide-y divide-slate-50">
                                                {group.data.map((r, idx: number) => (
                                                    <ResultTableRow key={r.id} result={r} rank={idx + 1} isField={isField} isVertical={isVertical} isHorizontalJump={isHorizontalJump} showAllAttempts={showAllAttempts} requiresWind={requiresWind} hasPoints={hasPoints} roundCount={roundCount} meetingSeason={meetingSeason} />
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
                        <span>STATUS: {isLive ? 'SYSTEM AKTYWNY' : 'PODGL\u0104D OFFLINE'}</span>
                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        <span>FREKWENCJA: {results?.length || 0} STARTUJ\u0104CYCH</span>
                        {groupByYear && <><span className="w-1 h-1 bg-slate-300 rounded-full"></span><span>TRYB: GRUPOWANIE ROCZNIKAMI</span></>}
                    </div>
                </div>
            </div>
        </div>
    );
}




