'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Trophy, RefreshCcw, Clock } from 'lucide-react';
import { Fragment, useState, useMemo } from 'react';
import { Button } from '../ui/button';
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

const getIsVertical = (eventName?: string, eventCode?: string, model?: string) => {
    const lowerName = normalizeForMatch(eventName || '');
    const codeBase = getCodeBase(eventCode);
    const lowerModel = (model || '').toLowerCase();
    const isVerticalName = ['wzwy', 'tycz', 'high jump', 'pole vault'].some((keyword) => lowerName.includes(keyword));
    const isVerticalCode = ['hj', 'pv'].some((code) => codeBase.startsWith(code));
    return lowerModel.startsWith('vertical') || isVerticalName || isVerticalCode;
};

const ATTEMPT_ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
const getAttemptLabel = (idx: number) => ATTEMPT_ROMAN[idx] || `P${idx + 1}`;

const parseVerticalMarks = (verticalJSON?: string): Record<string, string> => {
    if (!verticalJSON) return {};
    try {
        const parsed = JSON.parse(verticalJSON);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

const sortHeightValues = (values: string[]) =>
    [...values].sort((a, b) => parseFloat(a.replace(',', '.')) - parseFloat(b.replace(',', '.')));

const parseHeightsPlan = (raw?: string): string[] => {
    if (!raw || !raw.trim()) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed.map((h) => String(h).trim()).filter((h) => h.length > 0);
        }
    } catch {
        // fallback below for legacy CSV format
    }
    return raw
        .split(/[,;]+/)
        .map((h) => h.trim())
        .filter((h) => h.length > 0);
};

const VERTICAL_START_HEIGHT_KEY = '__startHeight';

const getVerticalStartHeight = (marks: Record<string, string>): string =>
    (marks[VERTICAL_START_HEIGHT_KEY] || '').trim();

const applyVerticalStartSkips = (
    heights: string[],
    marks: Record<string, string>,
    explicitStartHeight?: string,
): Record<string, string> => {
    if (!Array.isArray(heights) || heights.length === 0) return marks;

    const normalized = { ...marks };
    const configuredStart = (explicitStartHeight || '').trim();
    let firstAttemptIndex = configuredStart ? heights.findIndex((height) => height === configuredStart) : -1;

    if (firstAttemptIndex < 0) {
        firstAttemptIndex = heights.findIndex((height) => {
            const mark = (normalized[height] || '').trim();
            return mark.length > 0;
        });
    }

    if (firstAttemptIndex <= 0) return normalized;

    for (let i = 0; i < firstAttemptIndex; i++) {
        const h = heights[i];
        const current = (normalized[h] || '').trim();
        if (!current) {
            normalized[h] = '-';
        }
    }

    return normalized;
};
interface Result {
    id: string;
    place: number;
    time: string;
    wind?: number;
    status: string;
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
    points?: number | null;
    isOverall?: boolean;
    isDNF?: boolean;
    totalPoints?: number;
    details?: {
        eventCode: string;
        eventName: string;
        performance: string;
        points: number;
        cumulativeAfter: number;
        status?: string;
    }[];
    bestResult?: string;
    entry: {
        athleteName: string;
        bib: string;
        heat: number;
        lane: number;
    };
}

interface ResultsViewProps {
    meetingId: string;
    event: any;
}

export default function ResultsView({ meetingId, event }: ResultsViewProps) {
    const eventId = event?.id || null;
    const eventName = event?.name || '';
    const model = event?.model || 'STANDARD';
    const eventCode = event?.code || '';
    const requiresWind = eventRequiresWind(eventName, event?.code);

    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<string | number>('ALL');
    const [showAllAttempts, setShowAllAttempts] = useState(true);

    const { data: results, isLoading } = useQuery<Result[]>({
        queryKey: ['results', eventId],
        queryFn: async () => {
            const response = await api.get(`/results?eventId=${eventId}`);
            return response.data;
        },
        enabled: !!eventId,
    });

    const heats = useMemo(() => {
        if (!results) return [];
        const h = Array.from(new Set(results.map(r => r.entry.heat || 1))).sort((a, b) => a - b);
        return h;
    }, [results]);

    const filteredResults = useMemo(() => {
        if (!results) return [];
        if (activeTab === 'ALL') return results;
        return results.filter(r => (r.entry.heat || 1) === activeTab);
    }, [results, activeTab]);

    const heights = useMemo(() => parseHeightsPlan(event?.heights), [event?.heights]);

    const updateResultMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => {
            const response = await api.patch(`/results/${id}`, data);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['results', eventId] });
        },
        onError: (error: any) => {
            console.error('B\u0142\u0105d zapisu wyniku:', error?.response?.data || error.message);
            alert('B\u0142\u0105d zapisu wyniku: ' + (error?.response?.data?.message || error.message));
        }
    });

    const isVertical = getIsVertical(eventName, eventCode, model);
    const isField = getIsField(eventName, model, eventCode) && !isVertical;
    const normalizedEventName = normalizeForMatch(eventName);
    const codeBase = getCodeBase(eventCode);
    const isHorizontalJump =
        codeBase.startsWith('lj') ||
        codeBase.startsWith('tj') ||
        normalizedEventName.includes('dal') ||
        normalizedEventName.includes('trojskok') ||
        normalizedEventName.includes('wieloskok') ||
        normalizedEventName.includes('long jump') ||
        normalizedEventName.includes('triple jump');

    // Helper to get attempt count from model and trialsMode
    const getRoundCount = () => {
        // First check trialsMode from event settings
        const trialsMode = event?.trialsMode;
        if (trialsMode) {
            if (trialsMode === '3') return 3;
            if (trialsMode === '4') return 4;
            if (trialsMode === '3+3' || trialsMode === '6') return 6;
        }
        // Fallback to model-based detection
        if (model.includes('FIELD_6') || model.includes('STANDARD_FINAL')) return 6;
        if (model.includes('FIELD_4')) return 4;
        if (model.includes('MULTI') || model.includes('QUALIFICATION')) return 3;
        if (getIsField(eventName, model, eventCode)) return 6;
        return 0;
    };

    const updateHeatWindMutation = useMutation({
        mutationFn: async ({ eventId, heat, wind }: { eventId: string, heat: number, wind: any }) =>
            api.post('/results/wind', { eventId, heat, wind }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['results', eventId] });
        }
    });

    const roundCount = getRoundCount();
    const isOverall = results?.[0]?.isOverall ?? false;
    const isMultiContext =
        isOverall ||
        event?.stage === 'Multi-Event' ||
        isMultiEvent(eventName) ||
        (model || '').toUpperCase().includes('MULTI');
    const showPointsColumn =
        isMultiContext &&
        (results?.some((r) => r.points !== null || r.totalPoints !== undefined) ?? false);
    const hasAnyWindInResults =
        results?.some((r) => r.wind !== undefined && r.wind !== null && !Number.isNaN(Number(r.wind))) ?? false;
    const showGlobalWindColumn = !isField && !isVertical && (requiresWind || hasAnyWindInResults);
    const showTechnicalAttempts = showAllAttempts && (isField || isVertical);
    const technicalRowColSpan = 5 + (showGlobalWindColumn ? 1 : 0) + (showPointsColumn ? 1 : 0);
    const eventStartTime = event?.startTime
        ? new Date(event.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
        : null;

    if (!eventId) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Trophy className="h-12 w-12 mb-4 opacity-20" />
                <p>{'Wybierz konkurencj\u0119 z listy, aby zobaczy\u0107 wyniki.'}</p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-3 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-yellow-500" />
                        Wyniki: {eventName}
                    </CardTitle>
                    {eventStartTime && (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-200">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="text-[10px] font-black uppercase tracking-wider">Godzina</span>
                            <span className="text-sm font-black font-mono leading-none">{eventStartTime}</span>
                        </div>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    {activeTab !== 'ALL' && showGlobalWindColumn && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-1 py-1 mr-2">
                            <span className="text-[10px] font-black uppercase text-slate-500">Wiatr (Seria)</span>
                            <input
                                type="text"
                                className="w-12 h-7 bg-white border border-slate-100 rounded text-center text-xs font-mono font-bold outline-none focus:ring-1 focus:ring-blue-500"
                                placeholder="..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        updateHeatWindMutation.mutate({ eventId, heat: activeTab as number, wind: (e.target as HTMLInputElement).value });
                                        (e.target as HTMLInputElement).value = '';
                                    }
                                }}
                            />
                        </div>
                    )}
                    <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['results', eventId] })}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        {'Od\u015Bwie\u017C'}
                    </Button>
                    {(isField || isVertical) && (
                        <div className="flex items-center gap-2 ml-1">
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
                </div>
            </CardHeader>
            <div className="px-6 border-b border-slate-100 flex items-center gap-1 overflow-x-auto scroller-hide">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === 'ALL' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                    Wszystkie {getIsField(eventName, model, eventCode) ? 'Grupy' : 'Serie'}
                    {activeTab === 'ALL' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t"></div>}
                </button>
                {(heats || []).map((hX: any) => (
                    <button
                        key={hX}
                        onClick={() => setActiveTab(hX)}
                        className={`px-4 py-3 text-[10px] font-black uppercase tracking-widest transition-all relative whitespace-nowrap ${activeTab === hX ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        {getIsField(eventName, model, eventCode) ? `Grupa ${hX}` : `Seria ${hX}`}
                        {activeTab === hX && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t"></div>}
                    </button>
                ))}
            </div>
            <CardContent className="space-y-6">
                {isLoading ? (
                    <div className="py-8 text-center">{'\u0141adowanie wynik\u00F3w...'}</div>
                ) : results?.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">{'Brak wynik\u00F3w dla tej konkurencji.'}</div>
                ) : (
                    <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">M-ce</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-center">Bib</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Zawodnik</th>
                                    {!results?.[0]?.isOverall && (
                                        <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-center">
                                            {getIsField(eventName, model, eventCode) ? 'Gr / Kol.' : 'Seria / Tor'}
                                        </th>
                                    )}

                                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-28">
                                        {results?.[0]?.isOverall ? 'Punkty' : 'Wynik'}
                                    </th>
                                    {results?.[0]?.isOverall ? (
                                        <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-32">Detale</th>
                                    ) : (
                                        <>
                                            {showGlobalWindColumn && <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Wiatr</th>}
                                            {showPointsColumn && (
                                                <th className="px-6 py-3 text-right text-[10px] font-black text-blue-600 uppercase tracking-widest w-24">Punkty</th>
                                            )}
                                        </>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {([...(filteredResults || [])]).sort((a, b) => (a?.place || 999) - (b?.place || 999)).map((result) => {
                                    const showAttemptRow = showTechnicalAttempts && !result.isOverall;
                                    const verticalMarks = parseVerticalMarks(result.verticalJSON);
                                    const verticalHeights = heights.length > 0
                                        ? heights.map((h: string) => String(h))
                                        : sortHeightValues(Object.keys(verticalMarks).filter((k) => k !== VERTICAL_START_HEIGHT_KEY));

                                    return (
                                    <Fragment key={result.id}>
                                    <tr className={`group hover:bg-blue-50/20 transition-all ${result.place === 1 ? 'bg-yellow-50/30 font-bold' : ''}`}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 font-bold text-center">{result.place || '-'}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500 text-center font-mono font-bold">{result.entry.bib}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors uppercase">
                                                {result.entry.athleteName}
                                            </span>
                                        </td>
                                        {!result.isOverall && (
                                            <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-400 font-medium text-center">
                                                {getIsField(eventName, model, eventCode)
                                                    ? `G${result.entry.heat || 1} / K${result.entry.lane || '-'}`
                                                    : `S${result.entry.heat || 1} / T${result.entry.lane || '-'}`}
                                            </td>
                                        )}

                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            {result.isOverall ? (
                                                result.isDNF ? (
                                                    <span className="text-[15px] font-black font-mono text-red-600">DNF</span>
                                                ) : (
                                                    <span className="text-[17px] font-black font-mono text-blue-700">{result.totalPoints}</span>
                                                )
                                            ) : (
                                                <input
                                                    key={`${result.id}-main-result-${((isField || isVertical) ? result.bestResult : result.time) || ''}`}
                                                    type="text"
                                                    className="w-20 h-9 text-right bg-white border border-slate-200 rounded-lg px-2 text-[15px] font-black font-mono text-blue-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                    defaultValue={((isField || isVertical) ? result.bestResult : result.time) || ''}
                                                    onBlur={(e) => {
                                                        const newVal = e.target.value;
                                                        const oldVal = ((isField || isVertical) ? result.bestResult : result.time);
                                                        if (newVal !== (oldVal || '')) {
                                                            const field = (isField || isVertical) ? 'bestResult' : 'time';
                                                            updateResultMutation.mutate({ id: result.id, data: { [field]: newVal } });
                                                        }
                                                    }}
                                                />
                                            )}
                                        </td>
                                        {result.isOverall ? (
                                            <td className="px-6 py-4 text-right text-[10px] text-slate-400">
                                                <div className="flex flex-col gap-0.5 items-end">
                                                    {(result.details || []).map((det: any, idx: number) => {
                                                        const isDNFDet = det.status && ['DNS','DNF','DQ','NM'].includes(det.status);
                                                        return (
                                                            <div key={idx} className={`flex gap-2 items-center ${isDNFDet ? 'text-red-500' : ''}`}>
                                                                <span className="font-bold text-slate-500">{det.eventCode}:</span>
                                                                <span className={isDNFDet ? 'font-bold' : ''}>{det.performance}</span>
                                                                {!isDNFDet && det.points > 0 && (
                                                                    <>
                                                                        <span className="text-blue-600 font-bold">({det.points})</span>
                                                                        <span className="text-slate-300">Σ{det.cumulativeAfter}</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </td>
                                        ) : (
                                            <>
                                                {showGlobalWindColumn && (
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                                        <input
                                                            key={`${result.id}-wind`}
                                                            type="text"
                                                            className="w-12 h-8 text-center bg-transparent text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500 rounded border border-transparent hover:border-slate-200"
                                                            defaultValue={result.wind !== undefined && result.wind !== null ? result.wind : ''}
                                                            onBlur={(e) => {
                                                                const val = e.target.value;
                                                                const currentWindVal = result.wind?.toString() || '';
                                                                if (val !== currentWindVal) {
                                                                    updateResultMutation.mutate({ id: result.id, data: { wind: val === '' ? null : val } });
                                                                }
                                                            }}
                                                        />
                                                    </td>
                                                )}
                                                {showPointsColumn && (
                                                    <td className="px-6 py-4 whitespace-nowrap text-right font-black text-blue-600 font-mono">
                                                        {result.points !== null ? result.points : '-'}
                                                    </td>
                                                )}
                                            </>
                                        )}
                                    </tr>

                                    {showAttemptRow && (
                                        <tr className="bg-slate-50/60">
                                            <td colSpan={technicalRowColSpan} className="px-4 pb-4 pt-1">
                                                {isField && (
                                                    roundCount > 0 ? (
                                                        <div className="grid gap-2 mt-1" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                                                            {Array.from({ length: roundCount }).map((_, idx) => {
                                                                const fieldKey = `round${idx + 1}Result` as keyof Result;
                                                                const windKey = `round${idx + 1}Wind` as keyof Result;
                                                                const currentVal = (result as any)[fieldKey] || '';
                                                                const currentWind = (result as any)[windKey];
                                                                return (
                                                                    <div key={`${result.id}-attempt-card-${idx}`} className="rounded-md border border-slate-200 bg-white px-2 py-2">
                                                                        <div className="text-[10px] font-black text-slate-400 mb-1">{getAttemptLabel(idx)}</div>
                                                                        <input
                                                                            key={`${result.id}-${fieldKey}-${currentVal}`}
                                                                            type="text"
                                                                            placeholder="wynik"
                                                                            className="w-full h-8 text-center bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500 outline-none"
                                                                            defaultValue={currentVal}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                            }}
                                                                            onBlur={(e) => {
                                                                                const newVal = e.target.value.trim();
                                                                                if (newVal !== currentVal) {
                                                                                    updateResultMutation.mutate({ id: result.id, data: { [fieldKey]: newVal || null } });
                                                                                }
                                                                            }}
                                                                        />
                                                                        {isHorizontalJump && (
                                                                            <>
                                                                                <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-slate-400 text-center">wiatr</div>
                                                                                <input
                                                                                    key={`${result.id}-${windKey}-${currentWind ?? ''}`}
                                                                                    type="text"
                                                                                    inputMode="decimal"
                                                                                    placeholder="+0.0"
                                                                                    className="w-full h-6 mt-0.5 text-[10px] text-center bg-white border border-slate-200 rounded font-mono focus:border-blue-300 outline-none"
                                                                                    defaultValue={currentWind !== null && currentWind !== undefined ? currentWind : ''}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                                    }}
                                                                                    onBlur={(e) => {
                                                                                        const val = e.target.value.trim();
                                                                                        if (val !== (currentWind?.toString() || '')) {
                                                                                            updateResultMutation.mutate({ id: result.id, data: { [windKey]: val === '' ? null : val } });
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-500">Brak skonfigurowanej liczby prób.</div>
                                                    )
                                                )}
                                                {isVertical && (
                                                    verticalHeights.length > 0 ? (
                                                        <div className="mt-1">
                                                            <div className="mb-2 flex items-center gap-2">
                                                                <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">Wys. startowa</span>
                                                                <input
                                                                    type="text"
                                                                    placeholder="np. 1.80"
                                                                    className="h-7 w-24 rounded border border-slate-200 bg-white px-2 text-xs font-mono font-bold text-slate-700 outline-none focus:border-blue-400"
                                                                    defaultValue={getVerticalStartHeight(verticalMarks)}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                    }}
                                                                    onBlur={(e) => {
                                                                        const nextStartHeight = e.target.value.trim();
                                                                        const nextMarks = { ...verticalMarks };
                                                                        if (nextStartHeight) {
                                                                            nextMarks[VERTICAL_START_HEIGHT_KEY] = nextStartHeight;
                                                                        } else {
                                                                            delete nextMarks[VERTICAL_START_HEIGHT_KEY];
                                                                        }
                                                                        const normalizedMarks = applyVerticalStartSkips(verticalHeights, nextMarks, nextStartHeight);
                                                                        updateResultMutation.mutate({ id: result.id, data: { verticalJSON: JSON.stringify(normalizedMarks) } });
                                                                    }}
                                                                />
                                                            </div>
                                                            <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(95px, 1fr))' }}>
                                                            {verticalHeights.map((h: string) => {
                                                                const currentMark = verticalMarks[h] || '';
                                                                return (
                                                                    <div key={`${result.id}-vertical-card-${h}`} className="rounded-md border border-slate-200 bg-white px-2 py-2">
                                                                        <div className="text-[10px] font-black text-slate-500 mb-1 text-center">{h}</div>
                                                                        <input
                                                                            key={`${result.id}-v-${h}-${currentMark}`}
                                                                            type="text"
                                                                            placeholder="-"
                                                                            className={`w-full h-8 text-center rounded text-xs font-mono font-bold outline-none border ${currentMark?.includes('X')
                                                                                ? 'bg-red-50 border-red-200 text-red-600'
                                                                                : currentMark?.includes('O')
                                                                                    ? 'bg-green-50 border-green-200 text-green-600'
                                                                                    : 'bg-slate-50 border-slate-200 text-slate-600'
                                                                                } focus:bg-white focus:border-blue-500`}
                                                                            defaultValue={currentMark}
                                                                            onKeyDown={(e) => {
                                                                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                                                            }}
                                                                            onBlur={(e) => {
                                                                                const val = e.target.value.toUpperCase().trim();
                                                                                const previous = (currentMark || '').trim();
                                                                                if (val !== previous) {
                                                                                    const nextMarks = { ...verticalMarks, [h]: val };
                                                                                    const normalizedMarks = applyVerticalStartSkips(
                                                                                        verticalHeights,
                                                                                        nextMarks,
                                                                                        getVerticalStartHeight(verticalMarks),
                                                                                    );
                                                                                    updateResultMutation.mutate({ id: result.id, data: { verticalJSON: JSON.stringify(normalizedMarks) } });
                                                                                }
                                                                            }}
                                                                        />
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-slate-500">Brak ustawionych wysokości.</div>
                                                    )
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                    </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


