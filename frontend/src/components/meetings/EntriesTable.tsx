'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Users, FileText, ClipboardList, ArrowUpDown, Trash, LayoutGrid, Zap, RotateCcw, Printer, CloudDownload, Search, ExternalLink, Settings, Calendar, ChevronsRight } from 'lucide-react';
import { getAgeCategory, CATEGORY_COLORS } from '../../lib/ageCategory';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { TimePicker } from '../ui/time-picker';
import { printSingle } from '../../lib/printUtils';
import SeedingDnD from './SeedingDnD';
import RelaySquadEditor from './RelaySquadEditor';
import { isFieldEvent, isMultiEvent, isRelayEvent, isVerticalEvent, eventRequiresWind } from '../../lib/utils';

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

const VERTICAL_HEIGHT_SLOTS = 24;
const DEFAULT_FINISHLYNX_EXPORT_PATH = '\\\\DESKTOP-O1IFA1V\\Zawody';
const getFinishLynxExportPathStorageKey = (meetingId: string) =>
    `finishlynx-export-path:${meetingId}`;

const parseRelaySquadMembers = (relaySquad?: string | any[]): RelayMember[] => {
    if (!relaySquad) return [];
    try {
        if (Array.isArray(relaySquad)) {
            return relaySquad.filter((member) => !!member);
        }
        const parsed = JSON.parse(relaySquad);
        if (Array.isArray(parsed)) {
            return parsed.filter((member) => !!member);
        }
    } catch {
        return [];
    }
    return [];
};

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

const sanitizeHeightInput = (value: string): string => {
    const cleaned = value.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
    const firstDot = cleaned.indexOf('.');
    if (firstDot === -1) return cleaned;
    return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, '')}`;
};

const normalizeHeightToken = (value: string): string => {
    const compact = sanitizeHeightInput(value).trim();
    if (!compact || compact === '.') return '';
    // Common coach/judge shorthand: 380 -> 3.80
    if (/^\d{3}$/.test(compact)) return `${compact[0]}.${compact.slice(1)}`;
    return compact;
};

const parseHeightsPlan = (raw?: string | null): string[] => {
    if (!raw || !raw.trim()) return [];

    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            return parsed
                .map((h) => normalizeHeightToken(String(h)))
                .filter((h) => h.length > 0);
        }
    } catch {
        // fallback below for legacy CSV format
    }
    return raw
        .split(/[,;\s]+/)
        .map((h) => normalizeHeightToken(h))
        .filter((h) => h.length > 0);
};

const heightsToInputValue = (raw?: string | null): string => parseHeightsPlan(raw).join(', ');

const createVerticalHeightSlots = (raw?: string | null): string[] => {
    const slots = Array.from({ length: VERTICAL_HEIGHT_SLOTS }, () => '');
    parseHeightsPlan(raw)
        .slice(0, VERTICAL_HEIGHT_SLOTS)
        .forEach((h, idx) => {
            slots[idx] = h;
        });
    return slots;
};

const serializeVerticalHeightSlots = (slots: string[]): string | null => {
    const values = slots
        .map((h) => normalizeHeightToken(h))
        .filter((h) => h.length > 0);
    return values.length > 0 ? JSON.stringify(values) : null;
};

const serializeHeightsPlan = (rawInput?: string | null): string | null => {
    const values = parseHeightsPlan(rawInput);
    return values.length > 0 ? JSON.stringify(values) : null;
};

export default function EntriesTable({ meeting, selectedEventId, event, eventStage }: EntriesTableProps) {
    const eventName = event?.name || '';
    const queryClient = useQueryClient();
    const [isSeedingMode, setIsSeedingMode] = useState(false);
    const [isModelModalOpen, setIsModelModalOpen] = useState(false);
    const [eventModel, setEventModel] = useState<any>(null);
    const [verticalHeightSlots, setVerticalHeightSlots] = useState<string[]>(
        Array.from({ length: VERTICAL_HEIGHT_SLOTS }, () => ''),
    );
    const [finishLynxExportPath, setFinishLynxExportPath] = useState(
        DEFAULT_FINISHLYNX_EXPORT_PATH,
    );

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

    const updateEventMutation = useMutation({
        mutationFn: async (data: any) => {
            return api.patch(`/events/${selectedEventId}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meeting.id] });
            setIsModelModalOpen(false);
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

    const [advTargetEventId, setAdvTargetEventId] = useState('');
    const [advPerHeat, setAdvPerHeat] = useState(2);
    const [advByTime, setAdvByTime] = useState(2);

    const advanceMutation = useMutation({
        mutationFn: async () => api.post(`/events/${selectedEventId}/advance`, {
            targetEventId: advTargetEventId,
            advPerHeat,
            advByTime,
        }),
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['entries'] });
            alert(res.data?.message || 'Awanse wygenerowane.');
        },
        onError: () => alert('Błąd podczas generowania awansów.'),
    });

    const isField = isFieldEvent(eventName);
    const splitNeeded = isMultiEvent(eventName) && eventStage !== 'Multi-Event';

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const savedPath = window.localStorage.getItem(
            getFinishLynxExportPathStorageKey(meeting.id),
        );
        if (savedPath && savedPath.trim()) {
            setFinishLynxExportPath(savedPath);
        }
    }, [meeting.id]);

    const generateFinishLynxMutation = useMutation({
        mutationFn: async () => {
            const exportPath = finishLynxExportPath.trim();
            return api.post(`/meetings/${meeting.id}/finishlynx-generate`, {
                exportPath,
            });
        },
        onSuccess: (response) => {
            const exportDir = response.data?.exportDir || '(brak katalogu)';
            const evtPath = response.data?.evtPath || '(brak ścieżki .evt)';
            const schPath = response.data?.schPath || '(brak ścieżki .sch)';
            const savedAt = response.data?.savedAt
                ? new Date(response.data.savedAt).toLocaleString('pl-PL')
                : '';
            alert(
                `Wygenerowano pliki FinishLynx:\nKatalog: ${exportDir}\n${evtPath}\n${schPath}${savedAt ? `\nZapisano: ${savedAt}` : ''}`,
            );
        },
        onError: () => {
            alert('Błąd podczas generowania plików FinishLynx.');
        },
    });

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
    const heatDisplayMap = sortedHeats.reduce((acc, heat, index) => {
        if (heat > 0) {
            acc[heat] = index + 1;
        }
        return acc;
    }, {} as Record<number, number>);

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

    const repairMojibake = (value: string): string => {
        return value
            .replace(/Ä…/g, 'ą')
            .replace(/Ä‡/g, 'ć')
            .replace(/Ä™/g, 'ę')
            .replace(/Ĺ‚/g, 'ł')
            .replace(/Ĺ„/g, 'ń')
            .replace(/Ăł/g, 'ó')
            .replace(/Ĺ›/g, 'ś')
            .replace(/Ĺş/g, 'ź')
            .replace(/Ĺ¼/g, 'ż')
            .replace(/Ä„/g, 'Ą')
            .replace(/Ä†/g, 'Ć')
            .replace(/Ä˜/g, 'Ę')
            .replace(/Ĺ/g, 'Ł')
            .replace(/Ĺ/g, 'Ń')
            .replace(/Ă“/g, 'Ó')
            .replace(/Ĺš/g, 'Ś')
            .replace(/Ĺ¹/g, 'Ź')
            .replace(/Ĺ»/g, 'Ż');
    };

    const normalizeForMatch = (value: string): string => {
        const normalized = repairMojibake(value)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9 ]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return normalized
            .replace(/\b5\s*boj\b/g, 'piecioboj')
            .replace(/\b7\s*boj\b/g, 'siedmioboj')
            .replace(/\b10\s*boj\b/g, 'dziesiecioboj')
            .replace(/\bpentathlon\b/g, 'piecioboj')
            .replace(/\bheptathlon\b/g, 'siedmioboj')
            .replace(/\bdecathlon\b/g, 'dziesiecioboj')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const normalizeEventName = (name: string): string => {
        let n = repairMojibake(name)
            .replace(/kobiet|kobiety/gi, '')
            .replace(/m[eę][żz]czyzn|m[eę][żz]czyzni/gi, '')
            .replace(/women/gi, '')
            .replace(/men/gi, '')
            .replace(/u\d+/gi, '')
            .replace(/halowy|halowe/gi, '')
            .replace(/\((siedmioboj|piecioboj|dziesiecioboj|pentathlon|heptathlon|decathlon)[^)]*\)/gi, '')
            .replace(/\((5kg|6kg|7.26kg|4kg|3kg|2kg|0.75kg|1kg|1.5kg|1.75kg)\)/gi, '')
            .replace(/\([\d\w., ]+\)/gi, '')
            .trim();

        n = n.replace(/pp[lł]/gi, ' pl');
        n = n.replace(/(\d+)m/gi, '$1 m');
        n = n.replace(/\s+/g, ' ').trim();

        return n;
    };

    const isMultiEventName = (name: string): boolean => {
        const normalized = normalizeForMatch(name);
        return /siedmiob|dziesieciob|pieciob|pentathlon|heptathlon|decathlon/.test(normalized);
    };
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
            const seasonParam = meeting.season === 'INDOOR' ? 'INDOOR' : 'STADIUM';
            const res = await api.get(`/pzla/athlete/${candidate.pzlaId}/results?season=${seasonParam}`);
            const { pb: pbs, sb: sbs } = res.data;

            const currentEventName = normalizeEventName(eventName || '');
            if (!currentEventName || currentEventName.length < 2) return false;
            const isLikelyMultiEventScore = (rawValue: string): boolean => {
                const value = repairMojibake(rawValue || '')
                    .toLowerCase()
                    .split('/')[0]
                    .replace(/\([^)]*\)/g, '')
                    .replace(/(pkt|pts|pt)\.?/g, '')
                    .replace(',', '.')
                    .replace(/\s+/g, '')
                    .trim();

                if (!value || value.includes(':')) return false;
                if (!/^\d+(\.\d+)?$/.test(value)) return false;
                const points = parseFloat(value);
                return Number.isFinite(points) && points >= 1000;
            };

            // Try to find exact or partial match
            // Creating a simple matcher
            const findResult = (resultsObj: Record<string, string>) => {
                // 1. Exact match (raw)
                if (resultsObj[currentEventName]) return resultsObj[currentEventName];

                const keys = Object.keys(resultsObj);
                const stripGenderTokens = (value: string) =>
                    value
                        .replace(/\b(kobiet|kobiety|women|mezczyzn|mezczyzni|men)\b/g, '')
                        .replace(/\s+/g, ' ')
                        .trim();

                const currNormRaw = normalizeForMatch(currentEventName);
                const currNorm = stripGenderTokens(currNormRaw);

                // 2. Normalized EXACT match (e.g. "Kula (6)" -> "Pchnięcie kulą")
                const foundKey = keys.find(k => {
                    const normK = normalizeForMatch(normalizeEventName(k));
                    return (
                        normK.length > 1 &&
                        (normK === currNorm || normK === currNormRaw)
                    );
                });
                if (foundKey) return resultsObj[foundKey];

                // 3. Special handling for multi-events
                const isMultiEvent = isMultiEventName(currentEventName);

                if (isMultiEvent) {
                    const multiKey = keys.find(k => {
                        const kl = normalizeForMatch(k);
                        const nk = normalizeForMatch(normalizeEventName(k));
                        // Musi zawierać nazwę wieloboju
                        const matchesName =
                            kl.includes(currNorm) ||
                            nk.includes(currNorm) ||
                            currNorm.includes(kl) ||
                            currNorm.includes(nk);
                        if (!matchesName) return false;

                        // Ale NIE może zawierać nazw konkretnych konkurencji cząstkowych
                        const hasSubDiscipline = nk.includes('kula') || nk.includes('tyczka') ||
                            nk.includes('wzwyz') || nk.includes('dal') ||
                            nk.includes('plot') || nk.includes('oszczep') ||
                            nk.includes('dysk') || nk.includes('mlot') ||
                            nk.includes('60 m') || nk.includes('100 m') ||
                            nk.includes('400 m') || nk.includes('800 m') ||
                            nk.includes('1000 m') || nk.includes('1500 m');

                        if (hasSubDiscipline) return false;

                        // Wynik wieloboju powinien wyglądać jak punkty, nie czas/odległość.
                        const val = resultsObj[k] || '';
                        if (!isLikelyMultiEventScore(val)) return false;

                        return true;
                    });
                    if (multiKey) return resultsObj[multiKey];
                }

                // 4. Loose match for standard disciplines
                const looseKey = keys.find(k => {
                    const normK = normalizeForMatch(normalizeEventName(k));
                    if (!normK || normK.length < 2) return false;
                    return normK.includes(currNorm) || currNorm.includes(normK);
                });
                return looseKey ? resultsObj[looseKey] : '';
            };

            const foundPB = findResult(pbs);
            const foundSB = findResult(sbs);
            const hasPB = !!foundPB && foundPB.trim().length > 0;
            const hasSB = !!foundSB && foundSB.trim().length > 0;

            if (entryId) {
                if (!hasPB && !hasSB) {
                    if (!silent) alert(`Brak dopasowania PB/SB dla ${candidate.name} w tej konkurencji.`);
                    return false;
                }

                const payload: any = {
                    id: entryId,
                    tilastopajaId: candidate.pzlaId
                };
                if (hasPB) payload.pb = foundPB;
                if (hasSB) payload.sb = foundSB;

                await updateEntryMutation.mutateAsync(payload);
                if (!silent) alert(`Zaktualizowano wyniki dla ${candidate.name}`);
            } else {
                // Update form state (only if found)
                setNewEntry(prev => ({
                    ...prev,
                    ...(hasPB && { pb: foundPB }),
                    ...(hasSB && { sb: foundSB }),
                    tilastopajaId: candidate.pzlaId
                }));
            }

            setIsPzlaModalOpen(false);
            return hasPB || hasSB;

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
            if (data) alert(`Zakonczono masowa aktualizacje.\nZaktualizowano: ${data.updatedCount}\nPominieto/Nie znaleziono: ${data.skippedCount}`);
        }
    });

    if (isSeedingMode && selectedEventId) {
        return (
            <SeedingDnD
                meetingId={meeting.id}
                meetingSeason={meeting?.season}
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
                                onClick={() => {
                                    const autoWind = eventRequiresWind(event?.name, event?.code);
                                    setVerticalHeightSlots(createVerticalHeightSlots(event?.heights));
                                    setEventModel({
                                        name: event?.name || '',
                                        code: event?.code || '',
                                        gender: event?.gender || 'M',
                                        eventCode: event?.eventCode || '',
                                        ageGroup: event?.ageGroup || '',
                                        stage: event?.stage || 'Final',
                                        trialsMode: event?.trialsMode || '6',
                                        lanes: event?.lanes || 8,
                                        requiresWind: autoWind,
                                        startTime: event?.startTime,
                                        heights: heightsToInputValue(event?.heights),
                                        finalStartTime: event?.finalStartTime,
                                        finalCount: event?.finalCount || 1,
                                        finalInterval: event?.finalInterval || 5,
                                        finalStartTimes: event?.finalStartTimes || '[]',
                                        advancementRule: event?.advancementRule || '',
                                        completedTime: event?.completedTime || '',
                                        weather: event?.weather || '',
                                        referee: event?.referee || ''
                                    });
                                    setIsModelModalOpen(true);
                                }}
                            >
                                <Settings className="h-3.5 w-3.5 mr-2 text-blue-500" />
                                Ustawienia Konkurencji
                            </Button>
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

                {/* ADVANCEMENT PANEL */}
                {selectedEventId && meeting?.events?.length > 1 && (
                    <div className="mb-4 rounded-xl border border-orange-100 bg-orange-50/40 p-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-orange-700 mb-3 flex items-center gap-1.5">
                            <ChevronsRight className="h-3.5 w-3.5" />
                            Awanse Q/q — przenieś zawodników do następnej rundy
                        </h3>
                        <div className="flex flex-wrap gap-3 items-end">
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Konkurencja docelowa</label>
                                <select
                                    className="h-8 rounded-md border border-orange-200 bg-white px-2 text-xs font-medium text-slate-700 min-w-[200px]"
                                    value={advTargetEventId}
                                    onChange={(e) => setAdvTargetEventId(e.target.value)}
                                >
                                    <option value="">— wybierz —</option>
                                    {(meeting.events as any[])
                                        .filter((ev: any) => ev.id !== selectedEventId)
                                        .map((ev: any) => (
                                            <option key={ev.id} value={ev.id}>{ev.name}</option>
                                        ))
                                    }
                                </select>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">Q (awans za miejsce)</label>
                                <input
                                    type="number" min={0} max={20}
                                    className="h-8 w-16 rounded-md border border-orange-200 bg-white px-2 text-xs font-bold text-slate-700 text-center"
                                    value={advPerHeat}
                                    onChange={(e) => setAdvPerHeat(parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-orange-700 uppercase tracking-wider">q (awans za czas)</label>
                                <input
                                    type="number" min={0} max={20}
                                    className="h-8 w-16 rounded-md border border-orange-200 bg-white px-2 text-xs font-bold text-slate-700 text-center"
                                    value={advByTime}
                                    onChange={(e) => setAdvByTime(parseInt(e.target.value) || 0)}
                                />
                            </div>
                            <Button
                                size="sm"
                                className="h-8 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs"
                                disabled={!advTargetEventId || advanceMutation.isPending}
                                onClick={() => advanceMutation.mutate()}
                            >
                                <ChevronsRight className="h-3.5 w-3.5 mr-1" />
                                {advanceMutation.isPending ? 'Generowanie...' : 'Generuj awanse'}
                            </Button>
                        </div>
                        <p className="mt-2 text-[10px] text-orange-600/80">
                            Q = najlepsi z każdego biegu (za miejsce), q = najlepsi spośród pozostałych (za czas)
                        </p>
                    </div>
                )}

                <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest text-indigo-700">
                                FinishLynx
                            </h3>
                            <p className="mt-1 text-xs font-medium text-indigo-700/80">
                                Ścieżka z ustawień zawodów: {finishLynxExportPath || DEFAULT_FINISHLYNX_EXPORT_PATH}
                            </p>
                        </div>
                        <Button
                            className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest"
                            onClick={() => generateFinishLynxMutation.mutate()}
                            disabled={generateFinishLynxMutation.isPending}
                        >
                            <CloudDownload className={`mr-2 h-4 w-4 ${generateFinishLynxMutation.isPending ? 'animate-pulse' : ''}`} />
                            {generateFinishLynxMutation.isPending
                                ? 'Generowanie Lynx...'
                                : 'Generuj Lynx (.evt/.sch)'}
                        </Button>
                    </div>
                    <p className="mt-2 text-xs font-medium text-indigo-700/80">
                        Zmiana ścieżki: zakładka Ustawienia i Narzędzia {'->'} Główne Ustawienia Zawodów.
                    </p>
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
                                                <span className="text-sm font-bold text-slate-800">{heatDisplayMap[heat] ?? heat}</span>
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
                                                                    onClick={async (e) => {
                                                                        e.preventDefault();
                                                                        if (entry.tilastopajaId) {
                                                                            window.open(getPzlaUrl(entry, meeting.season), '_blank');
                                                                            return;
                                                                        }

                                                                        // Try to resolve ID on the fly
                                                                        const target = e.currentTarget;
                                                                        target.style.cursor = 'wait';
                                                                        target.style.opacity = '0.7';

                                                                        try {
                                                                            const response = await api.get(`/pzla/search`, {
                                                                                params: { query: entry.athleteName, birthYear: entry.yearOfBirth }
                                                                            });
                                                                            const candidates = response.data;

                                                                            if (candidates.length === 1) {
                                                                                const candidate = candidates[0];
                                                                                // Save for future
                                                                                updateEntryMutation.mutate({ id: entry.id, tilastopajaId: candidate.pzlaId });

                                                                                const r = meeting.season === 'INDOOR' ? 2 : 1;
                                                                                const url = `https://statystyka.pzla.pl/personal.php?page=profile&nr_zaw=${candidate.pzlaId}&r=${r}`;
                                                                                window.open(url, '_blank');
                                                                            } else {
                                                                                // Fallback
                                                                                window.open(getPzlaUrl(entry, meeting.season), '_blank');
                                                                            }
                                                                        } catch (err) {
                                                                            window.open(getPzlaUrl(entry, meeting.season), '_blank');
                                                                        } finally {
                                                                            target.style.cursor = 'pointer';
                                                                            target.style.opacity = '1';
                                                                        }
                                                                    }}
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
                                                                    {(entry.yearOfBirth || entry.dateOfBirth) && (() => {
                                                                        const yob = entry.yearOfBirth || (entry.dateOfBirth ? new Date(entry.dateOfBirth).getFullYear() : null);
                                                                        const meetingYear = meeting?.date ? new Date(meeting.date).getFullYear() : new Date().getFullYear();
                                                                        const cat = yob ? getAgeCategory(yob, meetingYear) : null;
                                                                        return (
                                                                            <span className="flex items-center gap-1">
                                                                                <span className="text-[11px] text-slate-400 bg-slate-50 px-1.5 rounded border border-slate-100">{yob}</span>
                                                                                {cat && (
                                                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${CATEGORY_COLORS[cat] || 'bg-slate-100 text-slate-600'}`}>{cat}</span>
                                                                                )}
                                                                            </span>
                                                                        );
                                                                    })()}
                                                                </div>
                                                                {parseRelaySquadMembers(entry.relaySquad).length > 0 && (
                                                                    <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                                                                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                                                                            {(() => {
                                                                                const squad = parseRelaySquadMembers(entry.relaySquad);
                                                                                if (squad.length === 0) return <span>Brak składu</span>;

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
                                                                    {isField ? `ORD:${idx + 1}` : `S:${entry.heat ? (heatDisplayMap[entry.heat] ?? entry.heat) : '-'}`}
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
                                            relaySquad:
                                                isRelay && newEntry.relaySquad.length > 0
                                                    ? JSON.stringify(newEntry.relaySquad)
                                                    : undefined,
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
                {editingSquadEntryId && (
                    <RelaySquadEditor
                        entryId={editingSquadEntryId}
                        club={editingSquadClub || ''}
                        initialSquad={editingSquad}
                        clubAthletes={clubAthletes || []}
                        onClose={() => setEditingSquadEntryId(null)}
                        onSave={(newSquad) => {
                            updateEntryMutation.mutate({
                                id: editingSquadEntryId,
                                relaySquad: JSON.stringify(newSquad)
                            });
                            setEditingSquadEntryId(null);
                        }}
                    />
                )}

                {/* MODEL & PARAMETERS MODAL */}
                {
                    isModelModalOpen && eventModel && (
                        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
                            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-blue-50">
                                    <div>
                                        <h3 className="font-bold text-blue-900">Model i Parametry Konkurencji</h3>
                                        <p className="text-xs text-blue-500 mt-0.5">{eventModel.name}</p>
                                    </div>
                                    <button onClick={() => setIsModelModalOpen(false)} className="text-blue-400 hover:text-blue-600">
                                        <X className="h-5 w-5" />
                                    </button>
                                </div>
                                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Pełna Nazwa Konkurencji</label>
                                            <Input
                                                value={eventModel.name}
                                                onChange={e => {
                                                    const name = e.target.value;
                                                    setEventModel({
                                                        ...eventModel,
                                                        name,
                                                        requiresWind: eventRequiresWind(name, eventModel.code)
                                                    });
                                                }}
                                                className="font-bold border-slate-200"
                                            />
                                        </div>


                                        <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                            <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                <div className="w-1 h-3 bg-blue-500 rounded-full" />
                                                Harmonogram
                                            </h4>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Data</label>
                                            <div className="relative">
                                                <Input
                                                    type="date"
                                                    value={eventModel.startTime ? new Date(eventModel.startTime).toISOString().split('T')[0] : (meeting?.date ? new Date(meeting.date).toISOString().split('T')[0] : '')}
                                                    onChange={e => {
                                                        const time = eventModel.startTime ? new Date(eventModel.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '10:00';
                                                        setEventModel({ ...eventModel, startTime: new Date(`${e.target.value}T${time}:00`).toISOString() });
                                                    }}
                                                    className="border-slate-200 pl-8"
                                                />
                                                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Godzina</label>
                                            <TimePicker
                                                value={eventModel.startTime ? new Date(eventModel.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '10:00'}
                                                onChange={(val: string) => {
                                                    const date = eventModel.startTime ? new Date(eventModel.startTime).toISOString().split('T')[0] : (meeting?.date ? new Date(meeting.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                                                    setEventModel({ ...eventModel, startTime: new Date(`${date}T${val}:00`).toISOString() });
                                                }}
                                            />
                                        </div>

                                        <div className="col-span-2 space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Godzina zakończenia (manualnie dla technicznych)</label>
                                            <div className="flex items-center gap-2">
                                                <TimePicker
                                                    value={eventModel.completedTime || ''}
                                                    onChange={(val: string) => setEventModel({ ...eventModel, completedTime: val })}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-11 border-slate-200 text-xs font-bold"
                                                    onClick={() => setEventModel({ ...eventModel, completedTime: '' })}
                                                >
                                                    Wyczyść
                                                </Button>
                                            </div>
                                            <p className="text-[10px] text-slate-400">
                                                Dla biegów pole uzupełnia się automatycznie po imporcie pliku LIF.
                                            </p>
                                        </div>

                                        <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                            <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                <div className="w-1 h-3 bg-blue-500 rounded-full" />
                                                Finał (opcjonalnie)
                                            </h4>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Data Finału</label>
                                            <div className="relative">
                                                <Input
                                                    type="date"
                                                    value={eventModel.finalStartTime ? new Date(eventModel.finalStartTime).toISOString().split('T')[0] : (meeting?.date ? new Date(meeting.date).toISOString().split('T')[0] : '')}
                                                    onChange={e => {
                                                        const time = eventModel.finalStartTime ? new Date(eventModel.finalStartTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '12:00';
                                                        setEventModel({ ...eventModel, finalStartTime: new Date(`${e.target.value}T${time}:00`).toISOString() });
                                                    }}
                                                    className="border-slate-200 pl-8"
                                                />
                                                <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Godzina Finału A</label>
                                            <TimePicker
                                                value={eventModel.finalStartTime ? new Date(eventModel.finalStartTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '12:00'}
                                                onChange={(val: string) => {
                                                    const date = eventModel.finalStartTime ? new Date(eventModel.finalStartTime).toISOString().split('T')[0] : (meeting?.date ? new Date(meeting.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                                                    setEventModel({ ...eventModel, finalStartTime: new Date(`${date}T${val}:00`).toISOString() });
                                                }}
                                            />
                                        </div>

                                        {eventModel.finalCount > 1 && Array.from({ length: eventModel.finalCount - 1 }).map((_, i) => {
                                            const idx = i + 1;
                                            const times = JSON.parse(eventModel.finalStartTimes || '[]');
                                            const currentTime = times[idx] || (eventModel.finalStartTime ? new Date(new Date(eventModel.finalStartTime).setMinutes(new Date(eventModel.finalStartTime).getMinutes() + (idx * (eventModel.finalInterval || 5)))).toISOString() : '');

                                            return (
                                                <div key={idx} className="space-y-1">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase">Godzina Finału {String.fromCharCode(65 + idx)}</label>
                                                    <TimePicker
                                                        value={currentTime ? new Date(currentTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' }) : '12:00'}
                                                        onChange={(val: string) => {
                                                            const newTimes = [...times];
                                                            while (newTimes.length <= idx) newTimes.push(eventModel.finalStartTime || new Date().toISOString());
                                                            const date = new Date(newTimes[idx]).toISOString().split('T')[0];
                                                            newTimes[idx] = new Date(`${date}T${val}:00`).toISOString();
                                                            setEventModel({ ...eventModel, finalStartTimes: JSON.stringify(newTimes) });
                                                        }}
                                                    />
                                                </div>
                                            );
                                        })}

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Liczba Finałów</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={eventModel.finalCount}
                                                onChange={e => setEventModel({ ...eventModel, finalCount: parseInt(e.target.value) || 1 })}
                                                className="border-slate-200 font-bold"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Odstęp (min.)</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                value={eventModel.finalInterval || 5}
                                                onChange={e => setEventModel({ ...eventModel, finalInterval: parseInt(e.target.value) || 5 })}
                                                className="border-slate-200 font-bold"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Zasada Awansu</label>
                                            <Input
                                                value={eventModel.advancementRule || ''}
                                                onChange={e => setEventModel({ ...eventModel, advancementRule: e.target.value })}
                                                placeholder="np. 8 najszybszych"
                                                className="border-slate-200 font-bold"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase">Sędzia</label>
                                            <Input
                                                value={eventModel.referee || ''}
                                                onChange={e => setEventModel({ ...eventModel, referee: e.target.value })}
                                                placeholder="Imię Nazwisko"
                                                className="border-slate-200"
                                            />
                                        </div>

                                        <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                            <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                <div className="w-1 h-3 bg-sky-400 rounded-full" />
                                                Warunki pogodowe (opcjonalnie)
                                            </h4>
                                        </div>
                                        {(() => {
                                            let weather: any = {};
                                            try { weather = JSON.parse(eventModel.weather || '{}'); } catch { weather = {}; }
                                            const updateWeather = (field: string, value: string) => {
                                                weather[field] = value;
                                                setEventModel({ ...eventModel, weather: JSON.stringify(weather) });
                                            };
                                            return (
                                                <>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Temperatura (°C)</label>
                                                        <Input
                                                            type="number"
                                                            value={weather.temperature || ''}
                                                            onChange={e => updateWeather('temperature', e.target.value)}
                                                            placeholder="np. 18"
                                                            className="border-slate-200"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase">Warunki</label>
                                                        <select
                                                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                                            value={weather.conditions || ''}
                                                            onChange={e => updateWeather('conditions', e.target.value)}
                                                        >
                                                            <option value="">—</option>
                                                            <option value="sunny">Słonecznie</option>
                                                            <option value="cloudy">Pochmurno</option>
                                                            <option value="rain">Deszcz</option>
                                                            <option value="wind">Wiatr</option>
                                                            <option value="indoor">Hala</option>
                                                        </select>
                                                    </div>
                                                </>
                                            );
                                        })()}

                                        <div className="col-span-2 border-t border-slate-100 pt-4 mt-2">
                                            <h4 className="text-xs font-bold text-slate-900 mb-3 flex items-center gap-2">
                                                <div className="w-1 h-3 bg-blue-500 rounded-full" />
                                                Ustawienia Techniczne
                                            </h4>
                                        </div>



                                        {(eventModel.model === 'Field' || isFieldEvent(eventModel.name)) && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Tryb Prób (Tech.)</label>
                                                <select
                                                    className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                                                    value={eventModel.trialsMode || '6'}
                                                    onChange={e => setEventModel({ ...eventModel, trialsMode: e.target.value })}
                                                >
                                                    <option value="6">Standard (3+3 z finałem)</option>
                                                    <option value="4">4 Próby (stałe)</option>
                                                    <option value="3">3 Próby (stałe)</option>
                                                    <option value="6_ALL">6 Prób (wszyscy)</option>
                                                </select>
                                            </div>
                                        )}
                                        {(!isFieldEvent(eventModel.name) && eventModel.model !== 'Field') && (
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Liczba torów</label>
                                                <Input
                                                    type="number"
                                                    value={eventModel.lanes}
                                                    onChange={e => setEventModel({ ...eventModel, lanes: parseInt(e.target.value) || 8 })}
                                                    className="border-slate-200"
                                                />
                                            </div>
                                        )}

                                        {isVerticalEvent(eventModel.name, eventModel.code) && (
                                            <div className="col-span-2 border-t border-slate-100 pt-4 space-y-2">
                                                <label className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-2">
                                                    <ArrowUpDown className="h-3 w-3" />
                                                    Plan Wysokości (Skok Wzwyż / Tyczka)
                                                </label>
                                                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
                                                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                                        {verticalHeightSlots.map((value, idx) => (
                                                            <div key={idx} className="space-y-1">
                                                                <label className="text-[9px] font-bold text-blue-500">#{idx + 1}</label>
                                                                <Input
                                                                    placeholder="np. 3.80"
                                                                    value={value}
                                                                    onChange={(e) => {
                                                                        const next = [...verticalHeightSlots];
                                                                        next[idx] = sanitizeHeightInput(e.target.value);
                                                                        setVerticalHeightSlots(next);
                                                                    }}
                                                                    onBlur={(e) => {
                                                                        const next = [...verticalHeightSlots];
                                                                        next[idx] = normalizeHeightToken(e.target.value);
                                                                        setVerticalHeightSlots(next);
                                                                    }}
                                                                    className="h-8 text-xs border-blue-200 focus:ring-blue-500"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <p className="text-[9px] text-blue-500 italic">
                                                        Pola 1-12 trafiają na górną belkę, 13-24 na dolną. Skrót 380 zostanie zapisany jako 3.80.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="px-6 py-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                                    <Button variant="ghost" onClick={() => setIsModelModalOpen(false)}>Anuluj</Button>
                                    <Button
                                        onClick={() => {
                                            const heightsPayload = isVerticalEvent(eventModel.name, eventModel.code)
                                                ? serializeVerticalHeightSlots(verticalHeightSlots)
                                                : serializeHeightsPlan(eventModel.heights);
                                            const completedTimePayload = (eventModel.completedTime || '').trim();
                                            updateEventMutation.mutate({
                                                ...eventModel,
                                                heights: heightsPayload,
                                                completedTime: completedTimePayload || null,
                                            });
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
                                        disabled={updateEventMutation.isPending}
                                    >
                                        {updateEventMutation.isPending ? 'Zapisywanie...' : 'Zastosuj zmiany'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </Card >
        </>
    );
}
