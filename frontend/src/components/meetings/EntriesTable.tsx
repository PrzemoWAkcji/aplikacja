'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Users, FileText, ClipboardList } from 'lucide-react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { printSingle } from '../../lib/printUtils';
import { ArrowUpDown, Trash } from 'lucide-react';

// Helper to identify field events
const isFieldEvent = (name: string = '') => {
    const technicalKeywords = ['Kula', 'Dysk', 'Młot', 'Oszczep', 'W dal', 'Trójskok', 'Wzwyż', 'Tyczka'];
    return technicalKeywords.some(keyword => name.includes(keyword));
};

interface Entry {
    id: string;
    athleteName: string;
    status: string;
    bib?: string;
    heat?: number;
    lane?: number;
    club?: string;
    pb?: string;
    sb?: string;
}

type SeedingMethod = 'RANDOM' | 'SNAKE' | 'ZIGZAG' | 'BEST_FROM_LAST';
type Criterion = 'SB' | 'PB';

interface GenerateParams {
    lanes: number;
    method: SeedingMethod;
    criterion: Criterion;
}

interface EntriesTableProps {
    meeting: any; // Meeting details for print header
    selectedEventId: string | null;
    eventName?: string;
}

export default function EntriesTable({ meeting, selectedEventId, eventName }: EntriesTableProps) {
    const queryClient = useQueryClient();
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const { data: entries } = useQuery<Entry[]>({
        queryKey: ['entries', selectedEventId],
        queryFn: async () => {
            const response = await api.get(`/entries?eventId=${selectedEventId}`);
            return response.data;
        },
        enabled: !!selectedEventId,
    });

    const deleteMutation = useMutation({
        mutationFn: async (entryId: string) => {
            return api.delete(`/entries/${entryId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries', selectedEventId] });
        }
    });


    const updateEntryMutation = useMutation({
        mutationFn: async ({ id, ...data }: { id: string; heat?: number | null; lane?: number | null; bib?: string }) => {
            return api.patch(`/entries/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries', selectedEventId] });
        }
    });

    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [genOptions, setGenOptions] = useState<GenerateParams>({
        lanes: 8,
        method: 'SNAKE',
        criterion: 'SB'
    });

    const [sortConfig, setSortConfig] = useState<{ key: keyof Entry | 'perf'; direction: 'asc' | 'desc' } | null>(null);

    const isField = isFieldEvent(eventName);

    const clearSeedingMutation = useMutation({
        mutationFn: async (eventId: string) => {
            return api.delete(`/events/${eventId}/start-list`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries', selectedEventId] });
            alert('Rozstawienie usunięte.');
        }
    });

    const generateStartListMutation = useMutation({
        mutationFn: async (params: GenerateParams & { eventId: string }) => {
            return api.post(`/events/${params.eventId}/start-list`, params);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries', selectedEventId] });
            setShowGenerateModal(false);
            alert('Lista startowa została wygenerowana.');
        },
        onError: () => {
            alert('Wystąpił błąd podczas generowania listy.');
        }
    });

    const handlePrint = () => {
        if (!entries || !eventName) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const date = new Date().toLocaleDateString();

        // Group by heat
        const heats = [...new Set(entries.map(e => e.heat || 0))].sort((a, b) => a - b);
        let heatsHtml = '';

        heats.forEach(heat => {
            const heatEntries = entries.filter(e => (e.heat || 0) === heat).sort((a, b) => (a.lane || 0) - (b.lane || 0));
            const heatTitle = heat === 0 ? 'Lista Zgłoszeń' : `Seria ${heat}`;

            heatsHtml += `
                <div class="heat-section">
                    <h3>${heatTitle}</h3>
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 50px">Tor</th>
                                <th style="width: 60px">Nr</th>
                                <th>Zawodnik</th>
                                <th>Klub</th>
                                <th style="width: 80px">PB</th>
                                <th style="width: 80px">SB</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${heatEntries.map(e => `
                                <tr>
                                    <td style="text-align: center">${e.lane || '-'}</td>
                                    <td style="text-align: center">${e.bib || ''}</td>
                                    <td>${e.athleteName}</td>
                                    <td>${e.club || ''}</td>
                                    <td style="text-align: center">${e.pb || ''}</td>
                                    <td style="text-align: center">${e.sb || ''}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        });

        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Lista Startowa - ${eventName}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    h1 { text-align: center; font-size: 24px; margin-bottom: 5px; }
                    h2 { text-align: center; font-size: 18px; margin-top: 0; color: #555; }
                    .meta { text-align: center; font-size: 12px; margin-bottom: 20px; color: #777; }
                    .heat-section { margin-bottom: 30px; page-break-inside: avoid; }
                    h3 { font-size: 16px; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; }
                    table { w-full: 100%; border-collapse: collapse; width: 100%; font-size: 13px; }
                    th { border-bottom: 2px solid #000; text-align: left; padding: 5px; }
                    td { border-bottom: 1px solid #ddd; padding: 5px; }
                    @media print {
                        body { padding: 0; }
                    }
                </style>
            </head>
            <body>
                <h1>${eventName}</h1>
                <div class="meta">Wygenerowano: ${date}</div>
                ${heatsHtml}
                <script>
                    window.onload = function() { window.print(); }
                </script>
            </body>
            </html>
        `;

        printWindow.document.write(html);
        printWindow.document.close();
    };

    const statusBadge = (status: string) => {
        const colors = status === 'CONFIRMED'
            ? 'bg-green-100 text-green-800'
            : status === 'SCRATCHED'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800';
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
                {status}
            </span>
        );
    };

    const parsePerformance = (perf: string | undefined): number => {
        if (!perf) return Infinity;
        const p = perf.trim().toUpperCase().replace(',', '.');
        if (['NM', 'DNF', 'DNS', 'DQ', 'X', '-'].includes(p)) return Infinity;

        const parts = p.split(':');
        let seconds = 0;
        if (parts.length === 2) {
            seconds = parseInt(parts[0]) * 60 + parseFloat(parts[1]);
        } else if (parts.length === 1) {
            seconds = parseFloat(parts[0]);
        } else {
            return Infinity;
        }
        return isNaN(seconds) ? Infinity : seconds;
    };

    const handleSort = (key: keyof Entry | 'perf') => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedEntries = [...(entries || [])].sort((a, b) => {
        if (!sortConfig) return 0;

        let valA: any = a[sortConfig.key as keyof Entry];
        let valB: any = b[sortConfig.key as keyof Entry];

        if (sortConfig.key === 'perf') {
            // Sort by PB or SB depending on what? Let's sort by PB column click or SB column click.
            // Actually we pass key as column name.
            return 0;
        }

        // Special handling for time/distance strings if sorting by PB/SB directly
        if (sortConfig.key === 'pb' || sortConfig.key === 'sb') {
            const perfA = parsePerformance(a[sortConfig.key]);
            const perfB = parsePerformance(b[sortConfig.key]);
            // For field events, higher is better (descending sort default).
            // For track events, lower is better (ascending sort default).
            // Let's stick to simple numeric comparison.
            if (perfA === perfB) return 0;
            // If infinity (no result), push to end
            if (perfA === Infinity) return 1;
            if (perfB === Infinity) return -1;

            if (isField) {
                return sortConfig.direction === 'asc' ? perfA - perfB : perfB - perfA; // Wait, higher distance = better.
                // If we want "Best results" on top:
                // Field: Descending.
                // Track: Ascending.
                // Logic here is strictly sorting values.
                // Let user decide direction.
                // But usually we sort "Best to Worst".
                // Asc (Track): 10.0 < 10.5.
                // Desc (Field): 20.0 > 19.5.
            }

            return sortConfig.direction === 'asc' ? perfA - perfB : perfB - perfA;
        }

        if (valA < valB) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between py-2">
                <CardTitle className="text-lg">
                    {selectedEventId ? eventName || 'Zgłoszenia' : 'Zgłoszenia'}
                </CardTitle>
                {selectedEventId && (
                    <div className="flex flex-wrap gap-2 w-full xl:w-auto xl:justify-end">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                const event = { name: eventName, category: '' }; // Mock event structure for print util
                                printSingle(event, entries || [], meeting, 'START_LIST');
                            }}
                        >
                            <FileText className="h-4 w-4 mr-2" />
                            Drukuj Listę
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                const event = { name: eventName, category: '' };
                                printSingle(event, entries || [], meeting, 'PROTOCOL');
                            }}
                        >
                            <ClipboardList className="h-4 w-4 mr-2" />
                            Drukuj Protokół
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => {
                                if (confirm('Czy na pewno chcesz usunąć całe rozstawienie (serie/tory)?')) {
                                    if (selectedEventId) clearSeedingMutation.mutate(selectedEventId);
                                }
                            }}
                        >
                            <Trash className="h-4 w-4 mr-2" />
                            Usuń rozstawienie
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setGenOptions(prev => ({ ...prev, lanes: isField ? 1 : 8, method: 'SNAKE' }));
                                setShowGenerateModal(true);
                            }}
                            disabled={generateStartListMutation.isPending}
                        >
                            Generuj Listę Startową
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                {showGenerateModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                        <div className="bg-white p-6 rounded-lg shadow-xl w-96 relative">
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="absolute top-2 right-2 text-gray-500 hover:text-gray-700"
                            >
                                <X className="h-5 w-5" />
                            </button>
                            <h3 className="font-bold text-lg mb-4">Generuj Listę Startową</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Metoda rozstawiania</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-md p-2 text-sm"
                                        value={genOptions.method}
                                        onChange={(e) => setGenOptions({ ...genOptions, method: e.target.value as SeedingMethod })}
                                    >
                                        <option value="SNAKE">Wężyk (Równy poziom serii)</option>
                                        <option value="BEST_FROM_LAST">Standard (Serie na czas)</option>
                                        <option value="ZIGZAG">Zygzak</option>
                                        <option value="RANDOM">Losowo</option>
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {genOptions.method === 'SNAKE' && 'Najlepsze zbalansowanie poziomu serii.'}
                                        {genOptions.method === 'BEST_FROM_LAST' && 'Serie uszeregowane od najwolniejszej do najszybszej.'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Kryterium</label>
                                    <select
                                        className="w-full border border-gray-300 rounded-md p-2 text-sm"
                                        value={genOptions.criterion}
                                        onChange={(e) => setGenOptions({ ...genOptions, criterion: e.target.value as Criterion })}
                                    >
                                        <option value="SB">Season Best (SB)</option>
                                        <option value="PB">Personal Best (PB)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Liczba torów</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={12}
                                        className="w-full border border-gray-300 rounded-md p-2 text-sm disabled:bg-gray-100 disabled:text-gray-400"
                                        value={genOptions.lanes}
                                        onChange={(e) => setGenOptions({ ...genOptions, lanes: parseInt(e.target.value) || 8 })}
                                        disabled={isField}
                                    />
                                    {isField && <p className="text-xs text-gray-500 mt-1">Dla konkurencji technicznych: brak torów.</p>}
                                </div>

                                <div className="pt-4 flex justify-end gap-2">
                                    <Button variant="outline" onClick={() => setShowGenerateModal(false)}>Anuluj</Button>
                                    <Button onClick={() => {
                                        if (selectedEventId) {
                                            generateStartListMutation.mutate({
                                                eventId: selectedEventId,
                                                ...genOptions
                                            });
                                        }
                                    }}>Generuj</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {!selectedEventId ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <Users className="h-12 w-12 mb-4 opacity-20" />
                        <p>Wybierz konkurencję z listy, aby zobaczyć zgłoszenia.</p>
                    </div>
                ) : entries?.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Brak zgłoszeń dla tej konkurencji.</p>
                ) : (
                    <div className="rounded-md border overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        {isField ? 'Lp.' : 'Seria / Tor'}
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nr Bib</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" onClick={() => handleSort('athleteName')} style={{ cursor: 'pointer' }}>
                                        Zawodnik <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Klub</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100 cursor-pointer" onClick={() => handleSort('pb')}>
                                        PB <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hover:bg-gray-100 cursor-pointer" onClick={() => handleSort('sb')}>
                                        SB <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sortedEntries.map((entry) => (
                                    <tr key={entry.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                {!isField && (
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-gray-400">Seria</span>
                                                        <input
                                                            type="number"
                                                            className="w-12 h-6 text-sm border rounded px-1"
                                                            defaultValue={entry.heat || ''}
                                                            onBlur={(e) => {
                                                                const val = e.target.value ? parseInt(e.target.value) : null;
                                                                if (val !== entry.heat) {
                                                                    updateEntryMutation.mutate({ id: entry.id, heat: val });
                                                                }
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] text-gray-400">{isField ? 'Kol' : 'Tor'}</span>
                                                    <input
                                                        type="number"
                                                        className="w-12 h-6 text-sm border rounded px-1"
                                                        defaultValue={entry.lane || ''}
                                                        onBlur={(e) => {
                                                            const val = e.target.value ? parseInt(e.target.value) : null;
                                                            if (val !== entry.lane) {
                                                                updateEntryMutation.mutate({ id: entry.id, lane: val });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            <input
                                                type="text"
                                                className="w-16 h-8 text-sm border rounded px-1"
                                                defaultValue={entry.bib || ''}
                                                onBlur={(e) => {
                                                    const val = e.target.value;
                                                    if (val !== entry.bib) {
                                                        updateEntryMutation.mutate({ id: entry.id, bib: val });
                                                    }
                                                }}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.athleteName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.club || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.pb || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.sb || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{statusBadge(entry.status)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => deleteMutation.mutate(entry.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                Usuń
                                            </button>
                                        </td>
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
