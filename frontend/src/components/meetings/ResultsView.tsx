'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Trophy, Upload, RefreshCcw, Wifi, Settings, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
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
    verticalJSON?: string;
    fieldJSON?: string;
    round1Result?: string;
    round2Result?: string;
    round3Result?: string;
    round4Result?: string;
    round5Result?: string;
    round6Result?: string;
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

const COMPETITION_MODELS = [
    { value: 'STANDARD', label: 'Standard (Biegi)' },
    { value: 'FIELD_4_ROUNDS', label: 'Cztery rundy (Bez zmiany kol.)' },
    { value: 'FIELD_CONSECUTIVE_4', label: 'Kolejne próby: 4 rundy' },
    { value: 'FIELD_CONSECUTIVE_6', label: 'Kolejne próby: 6 rund (wszyscy)' },
    { value: 'FIELD_CONSECUTIVE_3_3', label: 'Kolejne próby: 3 + finał' },
    { value: 'QUALIFICATION_3', label: 'Kwalifikacje: 3 próby' },
    { value: 'UNLIMITED', label: 'Nielimitowana liczba rund' },
    { value: 'STANDARD_FINAL', label: 'Standardowy finał (Top 8)' },
    { value: 'WA_12_10_8_6', label: 'WA (12-10-8-6)' },
    { value: 'WA_12_8_6_4', label: 'WA (12-8-6-4)' },
    { value: 'STANDARD_FINAL_4', label: 'Standardowy finał (4 rundy)' },
    { value: 'STANDARD_FINAL_X', label: 'Standardowy finał (X zawodników)' },
    { value: 'STANDARD_FINAL_3_5', label: 'Finał (zmiana po 3 i 5)' },
    { value: 'FIELD_6_ROUNDS', label: 'Sześć rund (Bez zmiany kol.)' },
    { value: 'FIELD_MULTI', label: 'Wielobój: 3 próby (FIELD)' },
    { value: 'VERTICAL_STANDARD', label: 'Skoki pionowe (Standard)' },
    { value: 'VERTICAL_MULTI', label: 'Wielobój: Skoki pionowe' },
];

export default function ResultsView({ meetingId, event }: ResultsViewProps) {
    const eventId = event?.id || null;
    const eventName = event?.name || '';
    const model = event?.model || 'STANDARD';
    const requiresWind = event?.requiresWind || false;

    const queryClient = useQueryClient();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isLive, setIsLive] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [newHeight, setNewHeight] = useState('');

    // Socket.io Connection
    useEffect(() => {
        const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setIsLive(true);
            if (eventId) {
                newSocket.emit('joinEvent', eventId);
            }
        });

        newSocket.on('resultsUpdated', (data) => {
            console.log('Results updated via WebSocket:', data);
            queryClient.invalidateQueries({ queryKey: ['results', eventId] });
        });

        newSocket.on('disconnect', () => setIsLive(false));

        return () => {
            newSocket.disconnect();
        };
    }, [eventId, queryClient]);

    const { data: results, isLoading } = useQuery<Result[]>({
        queryKey: ['results', eventId],
        queryFn: async () => {
            const response = await api.get(`/results?eventId=${eventId}`);
            return response.data;
        },
        enabled: !!eventId,
    });

    const importLifMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return api.post(`/results/import/lif/${eventId}`, formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['results', eventId] });
            alert('Wyniki z pliku LIF zostały zaimportowane.');
        },
        onError: () => {
            alert('Błąd podczas importu pliku LIF.');
        }
    });

    const importEvtMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return api.post(`/results/import/evt/${eventId}`, formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['results', eventId] });
            alert('Rozstawienie z pliku EVT zostało zaimportowane.');
        },
        onError: () => {
            alert('Błąd podczas importu pliku EVT.');
        }
    });

    const updateEventMutation = useMutation({
        mutationFn: async (data: any) => api.patch(`/events/${eventId}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
        }
    });

    const heights = useMemo(() => {
        try {
            return event?.heights ? JSON.parse(event.heights) : [];
        } catch (e) {
            return [];
        }
    }, [event?.heights]);

    const addHeight = () => {
        if (!newHeight) return;
        const updated = [...heights, newHeight].sort((a, b) => parseFloat(a) - parseFloat(b));
        updateEventMutation.mutate({ heights: JSON.stringify(updated) });
        setNewHeight('');
    };

    const removeHeight = (h: string) => {
        const updated = heights.filter((item: string) => item !== h);
        updateEventMutation.mutate({ heights: JSON.stringify(updated) });
    };

    const updateResultMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string, data: any }) => api.patch(`/results/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['results', eventId] });
        }
    });

    const isVertical = model.includes('VERTICAL') || (eventName.toLowerCase().includes('wzwyż') || eventName.toLowerCase().includes('tycz') || eventName.toLowerCase().includes('pv') || eventName.toLowerCase().includes('hj'));
    const isField = getIsField(eventName, model) && !isVertical;

    // Helper to get attempt count from model
    const getRoundCount = () => {
        if (model.includes('FIELD_6') || model.includes('STANDARD_FINAL')) return 6;
        if (model.includes('FIELD_4')) return 4;
        if (model.includes('MULTI_EVENT') || model.includes('QUALIFICATION')) return 3;
        return 0;
    };

    const roundCount = getRoundCount();

    if (!eventId) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Trophy className="h-12 w-12 mb-4 opacity-20" />
                <p>Wybierz konkurencję z listy, aby zobaczyć wyniki.</p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Wyniki: {eventName}
                    {isLive && (
                        <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full animate-pulse uppercase font-bold ml-2">
                            <Wifi className="h-3 w-3" />
                            Live
                        </span>
                    )}
                </CardTitle>
                <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowSettings(!showSettings)}>
                        <Settings className={`h-4 w-4 mr-2 ${showSettings ? 'text-blue-600' : ''}`} />
                        Model & Parametry
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['results', eventId] })}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Odśwież
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-bold gap-2"
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.evt';
                            input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) importEvtMutation.mutate(file);
                            };
                            input.click();
                        }}
                    >
                        Importuj EVT (Lynx)
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="text-xs font-bold gap-2"
                        onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.lif';
                            input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) importLifMutation.mutate(file);
                            };
                            input.click();
                        }}
                    >
                        Importuj LIF (Lynx)
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* QUICK HEIGHT MANAGEMENT FOR VERTICAL JUMPS */}
                {isVertical && (
                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 mb-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-1">Zarządzanie Wysokościami (Tyczka / Wzwyż)</span>
                                <span className="text-xs text-blue-400">Dodaj wysokości, na których zawodnicy będą oddawać próby.</span>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Wpisz wysokość (np. 3.40)"
                                    className="w-48 bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm font-bold text-blue-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                                    value={newHeight}
                                    onChange={(e) => setNewHeight(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addHeight()}
                                />
                                <Button size="sm" onClick={addHeight} className="bg-blue-600 hover:bg-blue-700 shadow-md">
                                    <Plus className="h-4 w-4 mr-1" />
                                    Dodaj
                                </Button>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-4">
                            {heights.map((h: string) => (
                                <span
                                    key={h}
                                    className="bg-white text-blue-700 px-3 py-1.5 rounded-lg text-sm font-black border border-blue-200 flex items-center gap-2 shadow-sm hover:border-red-200 transition-all hover:text-red-600 group"
                                >
                                    {h}
                                    <button onClick={() => removeHeight(h)} title="Usuń wysokość">
                                        <Trash2 className="h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
                                    </button>
                                </span>
                            ))}
                            {heights.length === 0 && <span className="text-xs text-blue-300 italic py-1.5 px-3">Brak zdefiniowanych wysokości - dodaj pierwszą powyżej.</span>}
                        </div>
                    </div>
                )}

                {showSettings && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Model Konkurencji</label>
                                <select
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    value={model}
                                    onChange={(e) => updateEventMutation.mutate({ model: e.target.value })}
                                >
                                    {COMPETITION_MODELS.map(m => (
                                        <option key={m.value} value={m.value}>{m.label}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-slate-400">Określa sposób liczenia prób, awansu do finału i zmiany kolejności.</p>
                            </div>
                        </div>
                    </div>
                )}
                {isLoading ? (
                    <div className="py-8 text-center">Ładowanie wyników...</div>
                ) : results?.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">Brak wyników dla tej konkurencji. Zaimportuj plik LIF.</div>
                ) : (
                    <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white shadow-sm">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">M-ce</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-16 text-center">Bib</th>
                                    <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Zawodnik</th>
                                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-24 text-center">
                                        {getIsField(eventName, model) ? 'Gr / Kol.' : 'Seria / Tor'}
                                    </th>

                                    {/* DYNAMIC ATTEMPT/HEIGHT COLUMNS */}
                                    {isField && roundCount > 0 && Array.from({ length: roundCount }).map((_, i) => (
                                        <th key={i} className="px-2 py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">P{i + 1}</th>
                                    ))}
                                    {isVertical && heights.map((h: string) => (
                                        <th key={h} className="px-2 py-3 text-center text-[10px] font-bold text-slate-500 w-16 bg-blue-50/30">{h}</th>
                                    ))}

                                    <th className="px-6 py-3 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-28">Result</th>
                                    {requiresWind && <th className="px-6 py-3 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">Wiatr</th>}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-100">
                                {results?.sort((a, b) => (a.place || 999) - (b.place || 999)).map((result) => (
                                    <tr key={result.id} className={`group hover:bg-blue-50/20 transition-all ${result.place === 1 ? 'bg-yellow-50/30 font-bold' : ''}`}>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-900 font-bold text-center">{result.place || '-'}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500 text-center font-mono font-bold">{result.entry.bib}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-slate-900 group-hover:text-blue-700 transition-colors uppercase">{result.entry.athleteName}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-400 font-medium text-center">
                                            {getIsField(eventName, model)
                                                ? `G${result.entry.heat || 1} / O${result.entry.lane || '-'}`
                                                : `S${result.entry.heat || 1} / T${result.entry.lane || '-'}`}
                                        </td>

                                        {/* ATTEMPT INPUTS */}
                                        {isField && roundCount > 0 && Array.from({ length: roundCount }).map((_, i) => {
                                            const fieldKey = `round${i + 1}Result`;
                                            return (
                                                <td key={i} className="px-1 py-4 text-center">
                                                    <input
                                                        type="text"
                                                        className="w-12 h-8 text-center bg-slate-50 border border-slate-200 rounded text-xs font-mono font-bold focus:ring-1 focus:ring-blue-500 outline-none hover:bg-white transition-all"
                                                        defaultValue={(result as any)[fieldKey] || ''}
                                                        onBlur={(e) => {
                                                            if (e.target.value !== ((result as any)[fieldKey] || '')) {
                                                                updateResultMutation.mutate({ id: result.id, data: { [fieldKey]: e.target.value } });
                                                            }
                                                        }}
                                                    />
                                                </td>
                                            );
                                        })}

                                        {/* VERTICAL MARKS INPUTS */}
                                        {isVertical && heights.map((h: string) => {
                                            const verticalData = result.verticalJSON ? JSON.parse(result.verticalJSON) : {};
                                            return (
                                                <td key={h} className="px-1 py-4 text-center">
                                                    <input
                                                        type="text"
                                                        placeholder="-"
                                                        className={`w-12 h-8 text-center border-b-2 rounded text-xs font-mono font-bold outline-none transition-all ${verticalData[h]?.includes('X') ? 'bg-red-50 border-red-200 text-red-600' :
                                                            verticalData[h]?.includes('O') ? 'bg-green-50 border-green-200 text-green-600' : 'bg-transparent border-transparent text-slate-400'
                                                            } focus:bg-white focus:border-blue-500`}
                                                        defaultValue={verticalData[h] || ''}
                                                        onBlur={(e) => {
                                                            const val = e.target.value.toUpperCase();
                                                            if (val !== (verticalData[h] || '')) {
                                                                const newData = { ...verticalData, [h]: val };
                                                                updateResultMutation.mutate({ id: result.id, data: { verticalJSON: JSON.stringify(newData) } });
                                                            }
                                                        }}
                                                    />
                                                </td>
                                            );
                                        })}

                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <input
                                                type="text"
                                                className="w-20 h-9 text-right bg-white border border-slate-200 rounded-lg px-2 text-[15px] font-black font-mono text-blue-700 shadow-sm outline-none focus:ring-2 focus:ring-blue-500"
                                                defaultValue={result.time || ''}
                                                onBlur={(e) => {
                                                    if (e.target.value !== (result.time || '')) {
                                                        updateResultMutation.mutate({ id: result.id, data: { time: e.target.value } });
                                                    }
                                                }}
                                            />
                                        </td>
                                        {requiresWind && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                                                <input
                                                    type="text"
                                                    className="w-12 h-8 text-center bg-transparent text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500 rounded border border-transparent hover:border-slate-200"
                                                    defaultValue={result.wind !== undefined ? result.wind : ''}
                                                    onBlur={(e) => {
                                                        const val = parseFloat(e.target.value);
                                                        if (!isNaN(val) && val !== result.wind) {
                                                            updateResultMutation.mutate({ id: result.id, data: { wind: val } });
                                                        } else if (e.target.value === '' && result.wind !== null) {
                                                            updateResultMutation.mutate({ id: result.id, data: { wind: null } });
                                                        }
                                                    }}
                                                />
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
