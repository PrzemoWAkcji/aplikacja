'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Users, FileText, ClipboardList, ArrowUpDown, Trash, LayoutGrid, Zap, RotateCcw, Printer, CloudDownload, Search, ExternalLink } from 'lucide-react';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { printSingle } from '../../lib/printUtils';
import SeedingDnD from './SeedingDnD';

// Helper to identify field events
const isFieldEvent = (name: string = '') => {
    const technicalKeywords = [
        'kul', 'dysk', 'młot', 'oszczep', 'dal', 'trójskok', 'wzwyż', 'tycz', 'piłecz',
        'lj', 'tj', 'sp', 'dt', 'jt', 'ht', 'hj', 'pv'
    ];
    const lowerName = (name || '').toLowerCase();
    return technicalKeywords.some(keyword => lowerName.includes(keyword));
};

const isMultiEvent = (name: string = '') => {
    const keywords = ['Pięciobój', 'Siedmiobój', 'Dziesięciobój', 'Pentathlon', 'Heptathlon', 'Decathlon', 'bój'];
    return keywords.some(keyword => name.includes(keyword));
};

const isRelayEvent = (code: string = '') => {
    return code?.toLowerCase().includes('4x'); // e.g. 4x100, 4x400
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
    yearOfBirth?: number;
    dateOfBirth?: string | Date;

    tilastopajaId?: string; // We use this to store PZLA ID
    relaySquad?: string | any[]; // JSON string or array
}

interface RelayMember {
    firstName: string;
    lastName: string;
    bib?: string;
    yearOfBirth?: number;
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

interface PzlaCandidate {
    pzlaId: string;
    name: string;
    birthYear: number;
    profileUrl: string;
}

interface EntriesTableProps {
    meeting: any; // Meeting details for print header
    selectedEventId: string | null;
    event?: any;
    eventStage?: string;
}

// Helper for PZLA links
const getPzlaUrl = (entry: any, meetingSeason?: string) => {
    const r = meetingSeason === 'INDOOR' ? 2 : 1;
    if (entry.tilastopajaId) {
        return `https://statystyka.pzla.pl/personal.php?page=profile&nr_zaw=${entry.tilastopajaId}&r=${r}`;
    }

    // Split name for better search results
    const parts = entry.athleteName.trim().split(/\s+/);
    // Usually First Last or LAST First. We'll take last word as last name, rest as first name
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const firstName = parts.length > 1 ? parts.slice(0, parts.length - 1).join(' ') : '';

    return `https://statystyka.pzla.pl/baza/index.php?file=Szukaj&zawodnik=${encodeURIComponent(lastName)}&zawodnik_imie=${encodeURIComponent(firstName)}`;
};

export default function EntriesTable({ meeting, selectedEventId, event, eventStage }: EntriesTableProps) {
    const eventName = event?.name || '';
    const queryClient = useQueryClient();
    const [isSeedingMode, setIsSeedingMode] = useState(false);

    const { data: entries, isLoading } = useQuery<Entry[]>({
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
        mutationFn: async ({ id, ...data }: { id: string; heat?: number | null; lane?: number | null; bib?: string; pb?: string; sb?: string; tilastopajaId?: string; relaySquad?: string }) => {
            return api.patch(`/entries/${id}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries', selectedEventId] });
        }
    });

    const splitMutation = useMutation({
        mutationFn: async () => api.post(`/events/${selectedEventId}/split`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meeting.id] });
            alert('Wielobój został rozpisany na poszczególne konkurencje.');
        },
        onError: () => alert('Błąd podczas rozpisywania wieloboju.')
    });

    const isField = isFieldEvent(eventName);
    const splitNeeded = isMultiEvent(eventName) && eventStage !== 'Multi-Event';

    // Group entries by Heat
    const groupedEntries = (entries || []).reduce((acc, entry) => {
        const heat = entry.heat || 0; // 0 for no heat
        if (!acc[heat]) acc[heat] = [];
        acc[heat].push(entry);
        return acc;
    }, {} as Record<number, Entry[]>);

    // Sort heats
    const sortedHeats = Object.keys(groupedEntries).map(Number).sort((a, b) => {
        if (a === 0) return 1;
        if (b === 0) return -1;
        return a - b;
    });

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isNameFocused, setIsNameFocused] = useState(false);

    const [newEntry, setNewEntry] = useState({
        athleteName: '',
        club: '',
        bib: '',
        pb: '',
        sb: '',
        birthDate: '',

        tilastopajaId: '',
        relaySquad: [] as RelayMember[]
    });

    const isRelay = isRelayEvent(event?.code);

    // Relay squad management (new entry)
    const [currentSquadMember, setCurrentSquadMember] = useState<RelayMember>({ firstName: '', lastName: '' });

    const addSquadMember = () => {
        if (!currentSquadMember.firstName || !currentSquadMember.lastName) return;
        setNewEntry({
            ...newEntry,
            relaySquad: [...newEntry.relaySquad, currentSquadMember]
        });
        setCurrentSquadMember({ firstName: '', lastName: '', bib: '', yearOfBirth: undefined });
    };

    const removeSquadMember = (index: number) => {
        const newSquad = [...newEntry.relaySquad];
        newSquad.splice(index, 1);
        setNewEntry({ ...newEntry, relaySquad: newSquad });
    };

    // Relay squad editing (existing entry)
    const [editingSquadEntryId, setEditingSquadEntryId] = useState<string | null>(null);
    const [editingSquad, setEditingSquad] = useState<RelayMember[]>([]);
    const [editingSquadMember, setEditingSquadMember] = useState<RelayMember>({ firstName: '', lastName: '', bib: '', yearOfBirth: undefined, pb: '', sb: '' });
    const [editingSquadClub, setEditingSquadClub] = useState<string>('');
    const [showManualAdd, setShowManualAdd] = useState(false);
    const [clubAthleteFilter, setClubAthleteFilter] = useState('');

    const openSquadEditor = (entry: Entry) => {
        let squad: RelayMember[] = [];
        try {
            if (Array.isArray(entry.relaySquad)) {
                squad = entry.relaySquad;
            } else if (typeof entry.relaySquad === 'string') {
                squad = JSON.parse(entry.relaySquad);
            }
        } catch (e) { /* ignore */ }
        setEditingSquad(squad);
        setEditingSquadEntryId(entry.id);
        setEditingSquadClub(entry.club || '');
        setEditingSquadMember({ firstName: '', lastName: '', bib: '', yearOfBirth: undefined, pb: '', sb: '' });
        setShowManualAdd(false);
        setClubAthleteFilter('');
    };

    const saveSquadEdit = () => {
        if (!editingSquadEntryId) return;
        updateEntryMutation.mutate({
            id: editingSquadEntryId,
            relaySquad: JSON.stringify(editingSquad)
        });
        setEditingSquadEntryId(null);
    };

    // Fetch athletes from the same club when editing squad
    const { data: clubAthletes } = useQuery<any[]>({
        queryKey: ['clubAthletes', editingSquadClub],
        queryFn: async () => {
            const res = await api.get(`/entries/athletes/by-club?club=${encodeURIComponent(editingSquadClub)}`);
            return res.data;
        },
        enabled: !!editingSquadEntryId && !!editingSquadClub,
        staleTime: 60000
    });

    // Search query
    const { data: athleteSuggestions } = useQuery({
        queryKey: ['athleteSearch', newEntry.athleteName],
        queryFn: async () => {
            if (!newEntry.athleteName || newEntry.athleteName.length < 2) return [];
            const res = await api.get(`/entries/athletes/search?q=${newEntry.athleteName}`);
            return res.data;
        },
        enabled: isAddModalOpen && newEntry.athleteName.length >= 2,
        staleTime: 60000
    });

    const addEntryMutation = useMutation({
        mutationFn: async (data: typeof newEntry) => {
            return api.post('/entries', {
                ...data,
                eventId: selectedEventId,
                status: 'CONFIRMED'
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries', selectedEventId] });
            setIsAddModalOpen(false);
            setIsAddModalOpen(false);
            setNewEntry({ athleteName: '', club: '', bib: '', pb: '', sb: '', birthDate: '', tilastopajaId: '', relaySquad: [] });
        },
        onError: () => {
            alert('Błąd podczas dodawania zawodnika');
        }
    });

    // PZLA Integration State
    const [pzlaCandidates, setPzlaCandidates] = useState<PzlaCandidate[]>([]);
    const [isPzlaModalOpen, setIsPzlaModalOpen] = useState(false);
    const [targetEntryId, setTargetEntryId] = useState<string | null>(null); // null = new entry form
    const [isSearchingPzla, setIsSearchingPzla] = useState(false);

    const normalizeEventName = (name: string) => {
        let n = name
            .replace(/Kobiet/gi, '')
            .replace(/Mężczyzn/gi, '')
            .replace(/Women/gi, '')
            .replace(/Men/gi, '')
            .replace(/U\d+/gi, '')
            .replace(/Halowy/gi, '')
            // Usuwamy nazwy wielobojów TYLKO jeśli są w nawiasach, np. "Kula (Siedmiobój)"
            .replace(/\((Siedmiobój|Pięciobój|Dziesięciobój|Pentathlon|Heptathlon|Decathlon)[^\)]*\)/gi, '')
            .replace(/\((5kg|6kg|7.26kg|4kg|3kg|2kg|0.75kg|1kg|1.5kg|1.75kg)\)/gi, '')
            .replace(/\([\d\w., ]+\)/gi, '')
            .trim();

        if (n.includes('ppł')) n = n.replace('ppł', ' pł');
        n = n.replace(/(\d+)m/gi, '$1 m');
        n = n.replace(/\s+/g, ' ').trim();

        return n;
    }

    const handlePzlaSearch = async (name: string, year?: number, entryId: string | null = null) => {
        if (!name || name.length < 3) return alert('Wpisz co najmniej 3 znaki nazwiska/imienia.');

        setIsSearchingPzla(true);
        setTargetEntryId(entryId);

        try {
            const response = await api.get(`/pzla/search`, {
                params: { query: name, birthYear: year }
            });

            const candidates = response.data;

            if (candidates.length === 0) {
                alert('Nie znaleziono zawodnika w bazie PZLA.');
            } else if (candidates.length === 1) {
                await applyPzlaData(candidates[0], entryId);
            } else {
                setPzlaCandidates(candidates);
                setIsPzlaModalOpen(true);
            }

        } catch (err) {
            console.error(err);
            alert('Błąd podczas wyszukiwania w PZLA.');
        } finally {
            setIsSearchingPzla(false);
        }
    };

    const applyPzlaData = async (candidate: PzlaCandidate, entryId: string | null, silent = false): Promise<boolean> => {
        try {
            const res = await api.get(`/pzla/athlete/${candidate.pzlaId}/results`);
            const { pb: pbs, sb: sbs } = res.data;

            const currentEventName = normalizeEventName(eventName || '');
            if (!currentEventName || currentEventName.length < 2) return false;

            // Try to find exact or partial match
            // Creating a simple matcher
            const findResult = (resultsObj: Record<string, string>) => {
                // 1. Exact match (raw)
                if (resultsObj[currentEventName]) return resultsObj[currentEventName];

                const keys = Object.keys(resultsObj);
                const currLower = currentEventName.toLowerCase();

                // 2. Normalized EXACT match (e.g. "Kula (6)" -> "Pchnięcie kulą")
                const foundKey = keys.find(k => {
                    const normK = normalizeEventName(k).toLowerCase();
                    return normK === currLower && normK.length > 1;
                });
                if (foundKey) return resultsObj[foundKey];

                // 3. Special handling for multi-events
                const isMultiEvent = /siedmiob|dziesięciob|pięciob|pentathlon|heptathlon|decathlon/i.test(currentEventName);

                if (isMultiEvent) {
                    const multiKey = keys.find(k => {
                        const kl = k.toLowerCase();
                        const nk = normalizeEventName(k).toLowerCase();
                        // Musi zawierać nazwę wieloboju
                        const matchesName = (kl.includes(currLower) || nk.includes(currLower));
                        if (!matchesName) return false;

                        // Ale NIE może zawierać nazw konkretnych konkurencji cząstkowych
                        const hasSubDiscipline = kl.includes('kula') || kl.includes('tyczka') ||
                            kl.includes('wzwyż') || kl.includes('dal') ||
                            kl.includes('płot') || kl.includes('oszczep') ||
                            kl.includes('dysk') || kl.includes('młot') ||
                            kl.includes('60 m') || kl.includes('100 m') ||
                            kl.includes('400 m') || kl.includes('800 m') ||
                            kl.includes('1000 m') || kl.includes('1500 m');

                        if (hasSubDiscipline) return false;

                        // Wynik wieloboju powinien być dużą liczbą (punktami), a nie np czasem 7.38
                        // Sprawdzamy wartość dla tego klucza
                        const val = resultsObj[k] || '';
                        if (val.includes('.') || val.includes(':')) return false; // Czasy i wysokości mają kropki/dwukropki

                        return true;
                    });
                    if (multiKey) return resultsObj[multiKey];
                    return '';
                }

                // 4. Loose match for standard disciplines
                const looseKey = keys.find(k => {
                    const normK = normalizeEventName(k).toLowerCase();
                    if (!normK || normK.length < 2) return false;
                    return normK.includes(currLower) || currLower.includes(normK);
                });
                return looseKey ? resultsObj[looseKey] : '';
            };

            const foundPB = findResult(pbs);
            const foundSB = findResult(sbs);

            if (entryId) {
                // Zawsze aktualizujemy, aby wyczyścić ewentualne śmieci z poprzednich prób
                // Zapisujemy również pzlaId w polu tilastopajaId (jako kontener na ID statystyk)
                await updateEntryMutation.mutateAsync({
                    id: entryId,
                    pb: foundPB,
                    sb: foundSB,
                    tilastopajaId: candidate.pzlaId
                });
                if (!silent) alert(`Zaktualizowano wyniki dla ${candidate.name}`);
            } else {
                // Update form state (only if found)
                setNewEntry(prev => ({
                    ...prev,
                    ...(foundPB !== undefined && { pb: foundPB }),
                    ...(foundSB !== undefined && { sb: foundSB }),
                    tilastopajaId: candidate.pzlaId
                }));
            }

            setIsPzlaModalOpen(false);
            return true;

        } catch (err) {
            console.error(err);
            if (!silent) alert('Błąd pobierania szczegółów zawodnika.');
            return false;
        }
    };

    const bulkUpdateMutation = useMutation({
        mutationFn: async () => {
            if (!entries || entries.length === 0) return;

            let updatedCount = 0;
            let skippedCount = 0;

            for (const entry of entries) {
                try {
                    // Search
                    const response = await api.get(`/pzla/search`, {
                        params: { query: entry.athleteName, birthYear: entry.yearOfBirth }
                    });
                    const candidates = response.data;

                    let targetCandidate = null;

                    if (candidates.length === 1) {
                        targetCandidate = candidates[0];
                    } else if (candidates.length > 1 && (entry.yearOfBirth || entry.dateOfBirth)) {
                        // Filter by year if multiple
                        const year = entry.yearOfBirth || (entry.dateOfBirth ? new Date(entry.dateOfBirth).getFullYear() : null);
                        if (year) {
                            const exactMatches = candidates.filter((c: any) => c.birthYear === year);
                            if (exactMatches.length === 1) targetCandidate = exactMatches[0];
                        }
                    }

                    if (targetCandidate) {
                        const success = await applyPzlaData(targetCandidate, entry.id, true);
                        if (success) updatedCount++;
                        else skippedCount++;
                    } else {
                        skippedCount++;
                    }
                } catch (e) {
                    console.error(e);
                    skippedCount++;
                }
            }
            return { updatedCount, skippedCount };
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['entries', selectedEventId] });
            if (data) alert(`Zakończono masową aktualizację.\nZaktualizowano: ${data.updatedCount}\nPominięto/Nie znaleziono: ${data.skippedCount}`);
        }
    });

    if (isSeedingMode && selectedEventId) {
        return (
            <SeedingDnD
                meetingId={meeting.id}
                eventId={selectedEventId}
                eventName={eventName || ''}
                onClose={() => setIsSeedingMode(false)}
            />
        );
    }



    return (
        <>
            <Card className="shadow-none border-0 bg-transparent">
                {/* TOOLBAR */}
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                            {selectedEventId ? eventName : 'Lista startowa'}
                        </h2>
                        <p className="text-slate-500 text-sm">
                            {entries ? `${entries.length} zawodników` : 'Wybierz konkurencję'} • {sortedHeats.length > 0 && sortedHeats[0] !== 0 ? `${sortedHeats.length} serii` : 'Brak serii'}
                        </p>
                    </div>

                    {selectedEventId && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1 shadow-sm mr-2">
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600" onClick={() => {
                                    printSingle(event, entries || [], meeting, 'START_LIST');
                                }} title="Drukuj Listę">
                                    <Printer className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600" onClick={() => {
                                    printSingle(event, entries || [], meeting, 'PROTOCOL');
                                }} title="Protokół">
                                    <ClipboardList className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600" onClick={() => {
                                    if (confirm(`Czy na pewno chcesz spróbować automatycznie zaktualizować dane dla wszystkich ${entries?.length || 0} zawodników? To może potrwać chwilę.`)) {
                                        bulkUpdateMutation.mutate();
                                    }
                                }} title="Aktualizuj wszystkich z PZLA" disabled={bulkUpdateMutation.isPending}>
                                    <CloudDownload className={`h-4 w-4 ${bulkUpdateMutation.isPending ? 'animate-pulse text-blue-500' : ''}`} />
                                </Button>
                            </div>

                            {splitNeeded && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-pink-50 border-pink-200 text-pink-700 font-bold text-xs hover:bg-pink-100"
                                    onClick={() => {
                                        if (confirm('Czy chcesz rozpisać ten wielobój na poszczególne konkurencje (składniki)?')) {
                                            splitMutation.mutate();
                                        }
                                    }}
                                    disabled={splitMutation.isPending}
                                >
                                    <Zap className="h-3.5 w-3.5 mr-2 text-pink-500" />
                                    {splitMutation.isPending ? 'Rozpisywanie...' : 'Rozpisz wielobój'}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant="outline"
                                className="bg-white border-slate-200 text-slate-700 font-bold text-xs"
                                onClick={() => setIsSeedingMode(true)}
                            >
                                <LayoutGrid className="h-3.5 w-3.5 mr-2 text-slate-500" />
                                Rozstawianie (D&D)
                            </Button>
                            <Button
                                size="sm"
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm"
                                onClick={() => setIsAddModalOpen(true)}
                            >
                                <Users className="h-3.5 w-3.5 mr-2" />
                                Dodaj zawodników
                            </Button>
                        </div>
                    )}
                </div>

                {/* CONTENT */}
                {!selectedEventId ? (
                    <div className="flex flex-col items-center justify-center py-24 text-slate-400 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                        <LayoutGrid className="h-12 w-12 mb-4 opacity-20" />
                        <p className="font-medium text-sm">Wybierz konkurencję, aby zobaczyć listę startową</p>
                    </div>
                ) : isLoading ? (
                    <div className="py-24 text-center">
                        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-400 text-sm">Pobieranie danych...</p>
                    </div>
                ) : entries?.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 border border-slate-100 rounded-xl bg-white shadow-sm">
                        <Users className="h-12 w-12 mb-3 text-slate-200" />
                        <p className="font-medium text-slate-600">Pusta lista startowa</p>
                        <p className="text-xs text-slate-400 mb-4">Dodaj zawodników lub zaimportuj listę</p>
                        <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(true)}>Dodaj zawodników</Button>
                    </div>
                ) : (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {sortedHeats.map((heat) => {
                            const heatEntries = groupedEntries[heat].sort((a, b) => (a.lane || 99) - (b.lane || 99));

                            return (
                                <div key={heat} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    {heat !== 0 && (
                                        <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">
                                                    {isField ? 'Grupa' : 'Seria'}
                                                </span>
                                                <span className="text-sm font-bold text-slate-800">{heat}</span>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                                                {heatEntries.length} os.
                                            </span>
                                        </div>
                                    )}

                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="border-b border-slate-100">
                                                    <th className="w-16 px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        {isField ? 'Lp.' : 'Tor'}
                                                    </th>
                                                    <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        Zawodnik
                                                    </th>
                                                    <th className="w-24 px-4 py-3 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        Inf.
                                                    </th>
                                                    <th className="w-20 px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                        Numer
                                                    </th>
                                                    <th className="w-24 px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider group cursor-pointer hover:text-blue-600 transition-colors">
                                                        PB
                                                    </th>
                                                    <th className="w-24 px-4 py-3 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider group cursor-pointer hover:text-blue-600 transition-colors">
                                                        SB
                                                    </th>
                                                    <th className="w-8 px-2 py-3">PZLA</th>
                                                    <th className="w-12 px-2 py-3"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-50/50">
                                                {heatEntries.map((entry, idx) => (
                                                    <tr key={entry.id} className="group hover:bg-blue-50/20 transition-colors">
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="text"
                                                                className="w-8 text-center bg-transparent font-bold text-slate-700 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded text-sm group-hover:bg-white border border-transparent group-hover:border-slate-200 transition-all"
                                                                defaultValue={entry.lane || ''}
                                                                onBlur={(e) => {
                                                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                                                    if (val !== entry.lane) updateEntryMutation.mutate({ id: entry.id, lane: val });
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex flex-col justify-center">
                                                                <a
                                                                    href={getPzlaUrl(entry, meeting.season)}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="font-bold text-slate-800 text-sm leading-tight hover:text-blue-600 transition-colors flex items-center gap-1 group/link"
                                                                    title="Zobacz profil PZLA"
                                                                >
                                                                    {entry.athleteName}
                                                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                                                </a>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="text-[11px] text-slate-500 font-medium truncate max-w-[200px]">
                                                                        {entry.club || 'Brak klubu'}
                                                                    </span>
                                                                    {(entry.yearOfBirth || entry.dateOfBirth) && (
                                                                        <span className="text-[11px] text-slate-400 bg-slate-50 px-1.5 rounded border border-slate-100">
                                                                            {entry.yearOfBirth || (entry.dateOfBirth ? new Date(entry.dateOfBirth).getFullYear() : '')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {entry.relaySquad && (
                                                                    <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                                            {(() => {
                                                                                let squad: any[] = [];
                                                                                try {
                                                                                    if (Array.isArray(entry.relaySquad)) {
                                                                                        squad = entry.relaySquad;
                                                                                    } else if (typeof entry.relaySquad === 'string') {
                                                                                        squad = JSON.parse(entry.relaySquad);
                                                                                    }
                                                                                } catch (e) { /* ignore */ }

                                                                                if (!squad || squad.length === 0) return <span>Brak składu</span>;

                                                                                return squad.map((m: any, i: number) => (
                                                                                    <span key={i} className="inline-flex items-center">
                                                                                        <span className="font-bold text-slate-400 mr-1">{i + 1}.</span>
                                                                                        <span>{m.firstName?.charAt(0)}. {m.lastName}</span>
                                                                                    </span>
                                                                                ));
                                                                            })()}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => openSquadEditor(entry)}
                                                                            className="ml-2 p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all shrink-0"
                                                                            title="Edytuj skład sztafety"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-left">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    {isField ? `ORD:${idx + 1}` : `S:${entry.heat || '-'}`}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <input
                                                                type="text"
                                                                className="w-12 text-center bg-transparent font-mono text-slate-600 outline-none focus:bg-white focus:ring-1 focus:ring-blue-500 rounded text-sm group-hover:bg-white border border-transparent group-hover:border-slate-200 transition-all"
                                                                defaultValue={entry.bib || ''}
                                                                placeholder="-"
                                                                onBlur={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val !== entry.bib) updateEntryMutation.mutate({ id: entry.id, bib: val });
                                                                }}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-medium text-slate-600 text-xs">
                                                            {entry.pb || '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-center font-medium text-slate-600 text-xs">
                                                            {entry.sb || '-'}
                                                        </td>
                                                        <td className="px-2 py-3 text-center">
                                                            <button
                                                                onClick={() => handlePzlaSearch(entry.athleteName, entry.yearOfBirth, entry.id)}
                                                                className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                                                                title="Pobierz z PZLA"
                                                                disabled={isSearchingPzla}
                                                            >
                                                                <CloudDownload className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                        <td className="px-2 py-3 text-right">
                                                            <button
                                                                onClick={() => {
                                                                    if (confirm('Usunąć zawodnika?')) deleteMutation.mutate(entry.id);
                                                                }}
                                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}

                        {sortedHeats.includes(0) && groupedEntries[0]?.length > 0 && (
                            <div className="mt-8 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Nierozstawieni Zawodnicy</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {groupedEntries[0].map(entry => (
                                        <div key={entry.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between group">
                                            <div className="flex flex-col">
                                                <a
                                                    href={getPzlaUrl(entry, meeting.season)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="font-bold text-slate-800 text-sm hover:text-blue-600 transition-colors flex items-center gap-1 group/link"
                                                >
                                                    {entry.athleteName}
                                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                                </a>
                                                <span className="text-xs text-slate-500">{entry.club}</span>
                                            </div>
                                            <button
                                                onClick={() => deleteMutation.mutate(entry.id)}
                                                className="text-slate-300 hover:text-red-500"
                                            >
                                                <Trash className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {
                    isAddModalOpen && (
                        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
                                    <h3 className="font-bold text-slate-800">Dodaj zawodnika</h3>
                                    <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="flex justify-end">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-xs gap-2"
                                            onClick={() => handlePzlaSearch(newEntry.athleteName)}
                                            disabled={!newEntry.athleteName || newEntry.athleteName.length < 3 || isSearchingPzla}
                                        >
                                            <CloudDownload className="h-3 w-3" />
                                            {isSearchingPzla ? 'Szukam...' : 'Pobierz wyniki z PZLA'}
                                        </Button>
                                    </div>
                                    {isRelay ? (
                                        <>
                                            <div className="space-y-1 relative">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Nazwa Sztafety (Reprezentacja/Klub) *</label>
                                                <Input
                                                    value={newEntry.athleteName}
                                                    onChange={(e) => setNewEntry({ ...newEntry, athleteName: e.target.value })}
                                                    placeholder="np. KS AZS AWF Warszawa"
                                                    className="font-bold"
                                                />
                                            </div>

                                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Skład Sztafety ({newEntry.relaySquad.length})</h4>

                                                <div className="space-y-2 mb-3">
                                                    {newEntry.relaySquad.map((member, idx) => (
                                                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border border-slate-200 text-sm">
                                                            <span>{idx + 1}. {member.firstName} {member.lastName} <span className="text-slate-400">({member.bib || '-'})</span></span>
                                                            <button onClick={() => removeSquadMember(idx)} className="text-red-400 hover:text-red-600">
                                                                <X className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    {newEntry.relaySquad.length === 0 && (
                                                        <p className="text-xs text-slate-400 italic">Brak zawodników w składzie</p>
                                                    )}
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <Input
                                                        placeholder="Imię"
                                                        value={currentSquadMember.firstName}
                                                        onChange={e => setCurrentSquadMember({ ...currentSquadMember, firstName: e.target.value })}
                                                        className="h-8 text-xs"
                                                    />
                                                    <Input
                                                        placeholder="Nazwisko"
                                                        value={currentSquadMember.lastName}
                                                        onChange={e => setCurrentSquadMember({ ...currentSquadMember, lastName: e.target.value })}
                                                        className="h-8 text-xs"
                                                    />
                                                    <Input
                                                        placeholder="Nr"
                                                        value={currentSquadMember.bib || ''}
                                                        onChange={e => setCurrentSquadMember({ ...currentSquadMember, bib: e.target.value })}
                                                        className="h-8 text-xs"
                                                    />
                                                    <Button size="sm" onClick={addSquadMember} className="h-8 text-xs bg-slate-800" type="button">Dodaj</Button>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-1 relative">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Imię i Nazwisko *</label>
                                                <Input
                                                    value={newEntry.athleteName}
                                                    onChange={(e) => setNewEntry({ ...newEntry, athleteName: e.target.value })}
                                                    onFocus={() => setIsNameFocused(true)}
                                                    // Delay blur to allow click on suggestion
                                                    onBlur={() => setTimeout(() => setIsNameFocused(false), 200)}
                                                    placeholder="np. Jan Kowalski"
                                                    className="relative z-10"
                                                    autoComplete="off"
                                                />
                                                {isNameFocused && athleteSuggestions && athleteSuggestions.length > 0 && (
                                                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 z-50 max-h-48 overflow-y-auto">
                                                        {athleteSuggestions.map((athlete: any) => (
                                                            <div
                                                                key={athlete.id}
                                                                className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0 flex flex-col cursor-pointer"
                                                                onMouseDown={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    setNewEntry({
                                                                        ...newEntry,
                                                                        athleteName: athlete.athleteName,
                                                                        club: athlete.club || '',
                                                                        pb: athlete.pb || '',
                                                                        sb: athlete.sb || '',
                                                                        birthDate: athlete.birthDate ? new Date(athlete.birthDate).toISOString().split('T')[0] : '',
                                                                        relaySquad: []
                                                                    });
                                                                    setIsNameFocused(false);
                                                                }}
                                                            >
                                                                <span className="font-bold text-slate-800">{athlete.athleteName}</span>
                                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                    <span>{athlete.club || '-'}</span>
                                                                    {athlete.yearOfBirth && <span>• {athlete.yearOfBirth}</span>}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {isNameFocused && (!athleteSuggestions || athleteSuggestions.length === 0) && newEntry.athleteName.length >= 2 && (
                                                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 z-50 p-3 text-center">
                                                        <span className="text-xs text-slate-400">Brak wyników w bazie</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Klub</label>
                                                <Input
                                                    value={newEntry.club}
                                                    onChange={(e) => setNewEntry({ ...newEntry, club: e.target.value })}
                                                    placeholder="np. KS AZS AWF Warszawa"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-500 uppercase">Data Urodzenia</label>
                                                <Input
                                                    type="date"
                                                    value={newEntry.birthDate}
                                                    onChange={(e) => setNewEntry({ ...newEntry, birthDate: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">Numer</label>
                                            <Input
                                                value={newEntry.bib}
                                                onChange={(e) => setNewEntry({ ...newEntry, bib: e.target.value })}
                                                placeholder="123"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">PB</label>
                                            <Input
                                                value={newEntry.pb}
                                                onChange={(e) => setNewEntry({ ...newEntry, pb: e.target.value })}
                                                placeholder="10.50"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs font-bold text-slate-500 uppercase">SB</label>
                                            <Input
                                                value={newEntry.sb}
                                                onChange={(e) => setNewEntry({ ...newEntry, sb: e.target.value })}
                                                placeholder="10.65"
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3">
                                    <Button variant="ghost" onClick={() => setIsAddModalOpen(false)}>Anuluj</Button>
                                    <Button
                                        onClick={() => addEntryMutation.mutate({
                                            ...newEntry,
                                            relaySquad: JSON.stringify(newEntry.relaySquad)
                                        } as any)}
                                        disabled={!newEntry.athleteName || addEntryMutation.isPending}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                    >
                                        {addEntryMutation.isPending ? 'Dodawanie...' : 'Dodaj'}
                                    </Button>
                                </div>
                            </div >
                        </div >
                    )
                }
                {
                    isPzlaModalOpen && (
                        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
                                    <h3 className="font-bold text-blue-900">Wybierz zawodnika PZLA</h3>
                                    <button onClick={() => setIsPzlaModalOpen(false)} className="text-blue-400 hover:text-blue-600">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="max-h-[60vh] overflow-y-auto p-2">
                                    {pzlaCandidates.map((cad) => (
                                        <div
                                            key={cad.pzlaId}
                                            onClick={() => applyPzlaData(cad, targetEntryId)}
                                            className="p-3 hover:bg-blue-50 cursor-pointer rounded-lg border-b border-slate-50 last:border-0 flex justify-between items-center group"
                                        >
                                            <div>
                                                <div className="font-bold text-slate-800 group-hover:text-blue-700">{cad.name}</div>
                                                <div className="text-xs text-slate-500">Ur. {cad.birthYear} • ID: {cad.pzlaId}</div>
                                            </div>
                                            <CloudDownload className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                }

                {editingSquadEntryId && (() => {
                    // Filter club athletes: exclude those already in squad
                    const squadNames = new Set(editingSquad.map(m => `${m.firstName}|${m.lastName}`.toLowerCase()));
                    const filteredClubAthletes = (clubAthletes || []).filter(a => {
                        // Filter by search text
                        if (clubAthleteFilter) {
                            const search = clubAthleteFilter.toLowerCase();
                            if (!(a.athleteName || '').toLowerCase().includes(search)) return false;
                        }
                        return true;
                    });

                    return (
                        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-indigo-50">
                                    <div>
                                        <h3 className="font-bold text-indigo-900">Edytuj skład sztafety</h3>
                                        {editingSquadClub && <p className="text-xs text-indigo-500 mt-0.5">{editingSquadClub}</p>}
                                    </div>
                                    <button onClick={() => setEditingSquadEntryId(null)} className="text-indigo-400 hover:text-indigo-600">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="max-h-[70vh] overflow-y-auto">
                                    {/* Current squad */}
                                    <div className="p-4 border-b border-slate-100">
                                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Aktualny skład ({editingSquad.length})</h4>
                                        {editingSquad.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {editingSquad.map((member, idx) => (
                                                    <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 group">
                                                        <span className="font-bold text-slate-400 text-sm w-6">{idx + 1}.</span>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="font-bold text-slate-800 text-sm">{member.firstName} {member.lastName}</span>
                                                            <div className="flex gap-2 text-[11px] text-slate-500">
                                                                {member.bib && <span>Nr: {member.bib}</span>}
                                                                {member.yearOfBirth && <span>Ur. {member.yearOfBirth}</span>}
                                                                {member.pb && <span className="text-emerald-600 font-medium">PB: {member.pb}</span>}
                                                                {member.sb && <span className="text-blue-600 font-medium">SB: {member.sb}</span>}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const updated = [...editingSquad];
                                                                updated.splice(idx, 1);
                                                                setEditingSquad(updated);
                                                            }}
                                                            className="text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                                            title="Usuń zawodnika"
                                                        >
                                                            <Trash className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-sm text-slate-400 text-center py-2">Brak zawodników w składzie</p>
                                        )}
                                    </div>

                                    {/* Add section */}
                                    <div className="p-4">
                                        <div className="flex items-center gap-2 mb-3">
                                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dodaj zawodnika</h4>
                                            <div className="flex-1" />
                                            <div className="flex bg-slate-100 rounded-lg p-0.5">
                                                <button
                                                    onClick={() => setShowManualAdd(false)}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!showManualAdd ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    Z klubu
                                                </button>
                                                <button
                                                    onClick={() => setShowManualAdd(true)}
                                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${showManualAdd ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                                >
                                                    Nowa osoba
                                                </button>
                                            </div>
                                        </div>

                                        {!showManualAdd ? (
                                            <div>
                                                {/* Search within club athletes */}
                                                <input
                                                    type="text"
                                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-2"
                                                    value={clubAthleteFilter}
                                                    onChange={(e) => setClubAthleteFilter(e.target.value)}
                                                    placeholder="Szukaj zawodnika w klubie..."
                                                />
                                                <div className="max-h-48 overflow-y-auto space-y-1">
                                                    {filteredClubAthletes.length > 0 ? filteredClubAthletes.map((athlete: any) => {
                                                        const nameParts = (athlete.athleteName || '').split(' ');
                                                        const firstName = nameParts[0] || '';
                                                        const lastName = nameParts.slice(1).join(' ') || '';
                                                        const alreadyInSquad = squadNames.has(`${firstName}|${lastName}`.toLowerCase());

                                                        return (
                                                            <button
                                                                key={athlete.id}
                                                                disabled={alreadyInSquad}
                                                                onClick={() => {
                                                                    setEditingSquad([...editingSquad, {
                                                                        firstName: athlete.firstName || firstName,
                                                                        lastName: athlete.lastName || lastName,
                                                                        bib: '',
                                                                        yearOfBirth: athlete.yearOfBirth || (athlete.birthDate ? new Date(athlete.birthDate).getFullYear() : undefined),
                                                                        pb: athlete.pb,
                                                                        sb: athlete.sb
                                                                    }]);
                                                                }}
                                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${alreadyInSquad ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-blue-50 cursor-pointer'}`}
                                                            >
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="font-bold text-sm text-slate-800">{athlete.athleteName}</span>
                                                                    <div className="flex gap-2 text-[11px] text-slate-500">
                                                                        {athlete.yearOfBirth && <span>Ur. {athlete.yearOfBirth}</span>}
                                                                        {athlete.pb && <span className="text-emerald-600">PB: {athlete.pb}</span>}
                                                                        {athlete.sb && <span className="text-blue-600">SB: {athlete.sb}</span>}
                                                                    </div>
                                                                </div>
                                                                {alreadyInSquad ? (
                                                                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">W składzie</span>
                                                                ) : (
                                                                    <span className="text-blue-500 text-xs font-bold">+ Dodaj</span>
                                                                )}
                                                            </button>
                                                        );
                                                    }) : (
                                                        <p className="text-sm text-slate-400 text-center py-4">
                                                            {clubAthleteFilter ? 'Brak wyników' : 'Brak zawodników w klubie'}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Imię</label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                            value={editingSquadMember.firstName}
                                                            onChange={(e) => setEditingSquadMember({ ...editingSquadMember, firstName: e.target.value })}
                                                            placeholder="Jan"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nazwisko</label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                            value={editingSquadMember.lastName}
                                                            onChange={(e) => setEditingSquadMember({ ...editingSquadMember, lastName: e.target.value })}
                                                            placeholder="KOWALSKI"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Nr startowy</label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                            value={editingSquadMember.bib || ''}
                                                            onChange={(e) => setEditingSquadMember({ ...editingSquadMember, bib: e.target.value })}
                                                            placeholder="123"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Rok urodzenia</label>
                                                        <input
                                                            type="number"
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                            value={editingSquadMember.yearOfBirth || ''}
                                                            onChange={(e) => setEditingSquadMember({ ...editingSquadMember, yearOfBirth: e.target.value ? parseInt(e.target.value) : undefined })}
                                                            placeholder="2000"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">PB</label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                            value={editingSquadMember.pb || ''}
                                                            onChange={(e) => setEditingSquadMember({ ...editingSquadMember, pb: e.target.value })}
                                                            placeholder="10.50"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">SB</label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                                            value={editingSquadMember.sb || ''}
                                                            onChange={(e) => setEditingSquadMember({ ...editingSquadMember, sb: e.target.value })}
                                                            placeholder="10.65"
                                                        />
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (!editingSquadMember.firstName || !editingSquadMember.lastName) return;
                                                        setEditingSquad([...editingSquad, { ...editingSquadMember }]);
                                                        setEditingSquadMember({ firstName: '', lastName: '', bib: '', yearOfBirth: undefined, pb: '', sb: '' });
                                                    }}
                                                    disabled={!editingSquadMember.firstName || !editingSquadMember.lastName}
                                                    className="mt-3 w-full py-2 text-sm font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    + Dodaj do składu
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                                    <Button variant="ghost" onClick={() => setEditingSquadEntryId(null)}>Anuluj</Button>
                                    <Button
                                        onClick={saveSquadEdit}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                    >
                                        Zapisz zmiany
                                    </Button>
                                </div>
                            </div>
                        </div>
                    );
                })()}

            </Card >
        </>
    );
}
