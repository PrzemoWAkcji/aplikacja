'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    // DragStartEvent,
    // DragOverEvent,
    // DragEndEvent,
    useDroppable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Button } from '../ui/button';
import {
    Settings2,
    Save,
    Trash2,
    GripVertical,
    Users,
    X,
} from 'lucide-react';

interface Entry {
    id: string;
    athleteName: string;
    pb: string;
    sb: string;
    club: string;
    bib: string;
    heat?: number;
    lane?: number;
}

interface SeedingDnDProps {
    meetingId: string;
    meetingSeason?: 'INDOOR' | 'STADIUM';
    eventId: string;
    eventName: string;
    onClose: () => void;
}

interface EventDetails {
    eventCode?: string;
    code?: string;
    name?: string;
    lanes?: number;
}

type DndItemId = string | number;

interface SeedingDragActive {
    id: DndItemId;
    rect: {
        current: {
            translated?: {
                top: number;
            };
        };
    };
}

interface SeedingDragOverTarget {
    id: DndItemId;
    rect: {
        top: number;
        height: number;
    };
}

interface SeedingDragStartEvent {
    active: SeedingDragActive;
}

interface SeedingDragOverEvent {
    active: SeedingDragActive;
    over: SeedingDragOverTarget | null;
}

interface SeedingDragEndEvent {
    active: SeedingDragActive;
    over: SeedingDragOverTarget | null;
}

function isFieldEvent(eventName: string) {
    const lower = eventName.toLowerCase();
    return lower.includes('skok') ||
        lower.includes('wieloskok') ||
        lower.includes('pchnięcie') ||
        lower.includes('rzut') ||
        lower.includes('młot') ||
        lower.includes('dysk') ||
        lower.includes('oszczep') ||
        lower.includes('tyczk') ||
        lower.includes('wzwyż') ||
        lower.includes('kula') ||
        lower.includes('w dal') ||
        lower.includes('trójskok');
}

// Draggable Item Component
function SortableItem({ entry, lane, isField, onRemove, isOverflow }: { entry: Entry; lane: number; isField: boolean; onRemove?: () => void; isOverflow?: boolean }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: entry.id, data: { entry } } as unknown as Parameters<typeof useSortable>[0]);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`
                p-3 mb-2 rounded-lg border shadow-sm flex items-center justify-between group select-none cursor-grab active:cursor-grabbing
                ${isDragging ? 'ring-2 ring-blue-500 z-50 bg-white border-slate-200' : 'hover:border-blue-300'}
                ${isOverflow ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}
            `}
        >
            <div className="flex items-center gap-3 overflow-hidden">
                <div className="text-slate-300">
                    <GripVertical className="h-4 w-4" />
                </div>
                <div className={`w-8 text-center flex flex-col items-center justify-center rounded border py-0.5 ${isOverflow ? 'bg-red-100 border-red-200 text-red-700' : 'bg-slate-50 border-slate-100 text-slate-700'}`}>
                    <span className="text-[9px] uppercase leading-none opacity-60">{isField ? 'LP.' : 'Tor'}</span>
                    <span className="text-sm font-bold leading-none">{lane}</span>
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate">{entry.athleteName}</span>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        {entry.bib && <span className="font-mono bg-slate-100 px-1 rounded">#{entry.bib}</span>}
                        <span className="truncate">{entry.club}</span>
                    </div>
                    <div className="flex gap-2 text-[9px] text-slate-400 mt-0.5">
                        <span>PB: {entry.pb || '-'}</span>
                        <span>SB: {entry.sb || '-'}</span>
                    </div>
                </div>
            </div>
            {onRemove && (
                <button
                    onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
                    onClick={(e) => {
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="text-slate-300 hover:text-red-500 p-1 rounded hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}

function DroppableContainer({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
    const { setNodeRef, isOver } = useDroppable({ id });
    return (
        <div ref={setNodeRef} className={`${className} ${isOver ? 'ring-2 ring-blue-100 bg-blue-50/30' : ''}`}>
            {children}
        </div>
    );
}

// ... types
type SeedingMethod = 'RANDOM' | 'SNAKE' | 'ZIGZAG' | 'BEST_FROM_LAST' | 'BEST_FROM_FIRST' | 'ALPHABETIC' | 'ALPHANUMERIC' | 'INDOOR_TIME' | 'RESULT_VALUE';
type Criterion = 'SB' | 'PB' | 'RESULT';

interface GenerateParams {
    lanes: number;
    method: SeedingMethod;
    criterion: Criterion;
    heats?: number;
    laneAssignment: 'STANDARD' | 'RANDOM' | 'INSIDE_OUT' | 'ALPHABETIC' | 'ALPHANUMERIC' | 'BEST_TO_WORST' | 'WORST_TO_BEST' | 'WATERFALL' | 'WATERFALL_REVERSE' | 'WA_SPRINT_8' | 'INDOOR_400_4LANES';
}

export default function SeedingDnD({ meetingId, meetingSeason, eventId, eventName, onClose }: SeedingDnDProps) {
    const queryClient = useQueryClient();
    const [heatsCount, setHeatsCount] = useState(1);
    const [items, setItems] = useState<Record<string, Entry[]>>({});
    const [heatSettings, setHeatSettings] = useState<Record<string, { startLane: number, lanes?: number }>>({}); // Store Start Lane per heat
    const [activeId, setActiveId] = useState<string | null>(null);

    const isField = useMemo(() => isFieldEvent(eventName), [eventName]);

    // Auto-Seeding State
    const [genOptions, setGenOptions] = useState<GenerateParams>({
        lanes: 8,
        method: isField ? 'RANDOM' : 'SNAKE',
        criterion: 'SB',
        laneAssignment: isField ? 'RANDOM' : 'STANDARD'
    });
    // Fetch event details
    const { data: event } = useQuery<EventDetails>({
        queryKey: ['event', eventId],
        queryFn: async () => {
            const response = await api.get(`/events/${eventId}`);
            return response.data;
        },
        enabled: !!eventId,
    });

    // Update default lanes when event is loaded
    useEffect(() => {
        const eventLanes = event?.lanes;
        if (typeof eventLanes === 'number') {
            setGenOptions(prev => ({ ...prev, lanes: eventLanes }));
        }
    }, [event]);

    const indoor400RuleApplies = useMemo(() => {
        if (meetingSeason !== 'INDOOR' || !event) return false;
        const codeRaw = (event.eventCode || event.code || '').toString();
        const codeBase = codeRaw.toLowerCase().replace(/[^a-z0-9]/g, '');
        const name = (event.name || '').toString().toLowerCase();
        const isRelay = name.includes('sztafet') || name.includes('relay') || codeBase.includes('4x');
        const numericCode = codeRaw.replace(/[^0-9]/g, '');
        const is400 = numericCode === '400' || codeBase === '400' || name.includes('400');
        const isHurdles = codeBase.includes('h') || name.includes('płot') || name.includes('hurd');
        return !isRelay && is400 && !isHurdles;
    }, [meetingSeason, event]);

    useEffect(() => {
        if (!indoor400RuleApplies || isField) return;
        setGenOptions(prev => ({
            ...prev,
            lanes: 4,
            laneAssignment: 'INDOOR_400_4LANES',
        }));
    }, [indoor400RuleApplies, isField]);

    useEffect(() => {
        if (isField) {
            setGenOptions(prev => ({ ...prev, method: 'RANDOM', laneAssignment: 'RANDOM' }));
        }
    }, [isField]);

    // Fetch entries
    const { data: entries } = useQuery<Entry[]>({
        queryKey: ['entries', eventId],
        queryFn: async () => {
            const response = await api.get(`/entries?eventId=${eventId}`);
            return response.data;
        },
        enabled: !!eventId,
    });

    const generateStartListMutation = useMutation({
        mutationFn: async (params: GenerateParams & { eventId: string }) => {
            // eventId is only for the URL – strip it from the body so the
            // backend ValidationPipe (forbidNonWhitelisted) doesn't reject it.
            const { eventId: eid, ...body } = params;
            return api.post(`/events/${eid}/start-list`, body);
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['entries', eventId] });
            await queryClient.invalidateQueries({ queryKey: ['meeting-activity', meetingId] });
            alert('Rozstawiono automatycznie. Możesz teraz dokonać korekt.');
        },
        onError: () => {
            alert('Błąd podczas generowania.');
        }
    });

    const saveSeedingMutation = useMutation({
        mutationFn: async (entriesToSave: Array<{ id: string; heat: number | null; lane: number | null }>) => {
            return api.post(`/events/${eventId}/seeding`, {
                entries: entriesToSave,
            });
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['entries', eventId] });
            await queryClient.invalidateQueries({ queryKey: ['meeting-activity', meetingId] });
            alert('Zapisano zmiany!');
            onClose();
        },
        onError: () => {
            alert('Błąd podczas zapisu rozstawienia.');
        },
    });

    // Initialize items and heat settings
    useEffect(() => {
        if (entries) {
            const initialGrouped: Record<string, Entry[]> = { unassigned: [] };
            const initialSettings: Record<string, { startLane: number }> = {};
            let maxHeat = 0;
            const assignedHeats = Array.from(
                new Set(
                    entries
                        .map((e) => e.heat)
                        .filter((h): h is number => !!h && h > 0),
                ),
            ).sort((a, b) => a - b);
            const remapSingleHeat =
                assignedHeats.length === 1 && assignedHeats[0] > 1
                    ? assignedHeats[0]
                    : null;

            entries.forEach((entry) => {
                const normalizedHeat =
                    entry.heat && entry.heat > 0
                        ? remapSingleHeat
                            ? 1
                            : entry.heat
                        : null;
                const normalizedEntry =
                    normalizedHeat && normalizedHeat !== entry.heat
                        ? { ...entry, heat: normalizedHeat }
                        : entry;

                if (normalizedHeat) {
                    const heatKey = `heat-${normalizedHeat}`;
                    if (!initialGrouped[heatKey]) initialGrouped[heatKey] = [];
                    initialGrouped[heatKey].push(normalizedEntry);
                    if (normalizedHeat > maxHeat) maxHeat = normalizedHeat;
                } else {
                    initialGrouped.unassigned.push(normalizedEntry);
                }
            });

            const count = Math.max(maxHeat, heatsCount);
            setHeatsCount(Math.max(count, 1));

            for (let i = 1; i <= Math.max(count, 1); i++) {
                const heatKey = `heat-${i}`;
                if (!initialGrouped[heatKey]) initialGrouped[heatKey] = [];

                // Sort by lane to maintain order
                initialGrouped[heatKey].sort((a, b) => (a.lane || 999) - (b.lane || 999));

                // Determine start lane based on min lane in the group, defaulting to 1
                // Filter out entries without lane just in case
                const lanes = initialGrouped[heatKey].map(e => e.lane).filter(l => l && l > 0) as number[];
                const minLane = lanes.length > 0 ? Math.min(...lanes) : 1;
                initialSettings[heatKey] = { startLane: minLane };
            }

            setItems(initialGrouped);
            setHeatSettings(initialSettings);
        }
    }, [entries, heatsCount]);

    const handleHeatsCountChange = (count: number) => {
        const newCount = Math.max(1, Math.min(20, count));
        setHeatsCount(newCount);

        setItems(prev => {
            const next = { ...prev };
            for (let i = 1; i <= newCount; i++) {
                if (!next[`heat-${i}`]) next[`heat-${i}`] = [];
            }
            Object.keys(next).forEach(key => {
                if (key.startsWith('heat-')) {
                    const heatNum = parseInt(key.split('-')[1]);
                    if (heatNum > newCount && next[key].length > 0) {
                        next.unassigned = [...next.unassigned, ...next[key]];
                        next[key] = [];
                    }
                }
            });
            return next;
        });
    };

    const handleSave = async () => {
        const entriesToSave: Array<{ id: string; heat: number | null; lane: number | null }> = [];
        items.unassigned?.forEach(entry => {
            entriesToSave.push({ id: entry.id, heat: null, lane: null });
        });
        for (let i = 1; i <= heatsCount; i++) {
            const heatKey = `heat-${i}`;
            const heatItems = items[heatKey] || [];

            // Dla technicznych zawsze start od 1 (kolejność), dla biegowych z konfiguracji
            const startLane = isField ? 1 : (heatSettings[heatKey]?.startLane || 1);

            heatItems.forEach((entry, index) => {
                const newLane = startLane + index;
                entriesToSave.push({ id: entry.id, heat: i, lane: newLane });
            });
        }
        await saveSeedingMutation.mutateAsync(entriesToSave);
    };

    const handleClear = () => {
        if (!confirm('Czy na pewno chcesz przenieść wszystkich do nierozstawionych?')) return;
        setItems(prev => {
            const allEntries: Entry[] = [];
            Object.values(prev).forEach(list => allEntries.push(...list));
            const resetEntries = allEntries.map(e => ({ ...e, heat: undefined, lane: undefined }));

            const next: Record<string, Entry[]> = { unassigned: resetEntries };
            for (let i = 1; i <= heatsCount; i++) {
                next[`heat-${i}`] = [];
            }
            return next;
        });
    };

    // DND Logic
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const findContainer = (id: string) => {
        if (id in items) return id;
        return Object.keys(items).find((key) => items[key].find((item) => item.id === id));
    };

    const handleDragStart = (event: SeedingDragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragOver = (event: SeedingDragOverEvent) => {
        const { active, over } = event;
        const overId = over?.id;
        if (!overId || active.id === overId) return;
        const activeContainer = findContainer(active.id as string);
        const overContainer = findContainer(overId as string);
        if (!activeContainer || !overContainer || activeContainer === overContainer) return;

        setItems((prev) => {
            const activeItems = prev[activeContainer];
            const overItems = prev[overContainer];
            const activeIndex = activeItems.findIndex((item) => item.id === active.id);
            const overIndex = overItems.findIndex((item) => item.id === overId);
            let newIndex;
            if (overId in prev) {
                newIndex = overItems.length + 1;
            } else if (over) {
                const isBelowOverItem = over &&
                    active.rect.current.translated &&
                    active.rect.current.translated.top > over.rect.top + over.rect.height;

                const modifier = isBelowOverItem ? 1 : 0;
                newIndex = overIndex >= 0 ? overIndex + modifier : overItems.length + 1;
            } else {
                newIndex = overItems.length + 1;
            }
            return {
                ...prev,
                [activeContainer]: [...prev[activeContainer].filter((item) => item.id !== active.id)],
                [overContainer]: [
                    ...prev[overContainer].slice(0, newIndex),
                    activeItems[activeIndex],
                    ...prev[overContainer].slice(newIndex, overItems.length),
                ],
            };
        });
    };

    const handleDragEnd = (event: SeedingDragEndEvent) => {
        const { active, over } = event;
        const activeContainer = findContainer(active.id as string);
        const overContainer = over ? findContainer(over.id as string) : null;
        if (activeContainer && overContainer && activeContainer === overContainer) {
            const activeIndex = items[activeContainer].findIndex((item) => item.id === active.id);
            const overIndex = items[overContainer].findIndex((item) => item.id === over!.id);
            if (activeIndex !== overIndex) {
                setItems((prev) => ({
                    ...prev,
                    [activeContainer]: arrayMove(prev[activeContainer], activeIndex, overIndex),
                }));
            }
        }
        setActiveId(null);
    };

    const handleRemoveFromHeat = (heatId: string, entryId: string) => {
        setItems(prev => {
            const entry = prev[heatId].find(e => e.id === entryId);
            if (!entry) return prev;
            return {
                ...prev,
                [heatId]: prev[heatId].filter(e => e.id !== entryId),
                unassigned: [...prev.unassigned, entry]
            };
        });
    };

    const activeEntry = activeId ? (Object.values(items).flat().find(e => e.id === activeId) || null) : null;

    return (
        <div className="fixed inset-0 z-50 bg-[#f8fafc] flex flex-col">
            {/* HEADER */}
            <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 shadow-sm z-20">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={onClose} className="rounded-full h-8 w-8 p-0 hover:bg-slate-100">
                        <X className="h-5 w-5 text-slate-500" />
                    </Button>
                    <div>
                        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight leading-none">{eventName}</h2>
                        <p className="text-xs text-slate-500 font-medium mt-1">Panel Rozstawiania (Drag & Drop)</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={handleClear} disabled={saveSeedingMutation.isPending} className="text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs font-bold">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Wyczyść
                    </Button>
                    <div className="h-6 w-px bg-slate-200 mx-1"></div>
                    <Button onClick={handleSave} disabled={saveSeedingMutation.isPending} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 shadow-lg shadow-blue-200/50">
                        <Save className="h-4 w-4 mr-2" />
                        {saveSeedingMutation.isPending ? 'Zapisywanie...' : 'Zapisz i Zamknij'}
                    </Button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* SETTINGS SIDEBAR */}
                <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-y-auto z-10">
                    <div className="p-6 space-y-8">
                        <div>
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Settings2 className="h-3 w-3" /> Konfiguracja
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700">{isField ? 'Liczba grup' : 'Liczba serii'}</label>
                                    <select
                                        className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all"
                                        value={heatsCount}
                                        onChange={(e) => handleHeatsCountChange(parseInt(e.target.value))}
                                    >
                                        {[...Array(20)].map((_, i) => (
                                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-slate-100">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Users className="h-3 w-3" /> Automat
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700">{isField ? 'Podział grup' : 'Metoda'}</label>
                                    <select
                                        className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        value={genOptions.method}
                                        onChange={(e) => setGenOptions({ ...genOptions, method: e.target.value as SeedingMethod })}
                                    >
                                        {isField ? (
                                            <>
                                                <option value="RANDOM">Losowo (losowanie)</option>
                                                <option value="SNAKE">Balans siły grup (wężyk)</option>
                                                <option value="ALPHABETIC">Alfabetycznie</option>
                                                <option value="ALPHANUMERIC">Numerem startowym</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="ALPHABETIC">Alfabetycznie (Nazwisko)</option>
                                                <option value="ALPHANUMERIC">Alfanumerycznie (Numer)</option>
                                                <option value="SNAKE">Wężyk (Balans serii)</option>
                                                <option value="ZIGZAG">Zygzak (Kolejno 1-2-3...)</option>
                                                <option value="BEST_FROM_LAST">Według czasu / Zawsze szybcy na końcu</option>
                                                <option value="BEST_FROM_FIRST">Według czasu / Szybcy na początku</option>
                                                <option value="INDOOR_TIME">Według czasu (hala)</option>
                                                <option value="RESULT_VALUE">Według wyników z eliminacji</option>
                                                <option value="RANDOM">Losowo</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700">{isField ? 'Maks. liczba zawodników w grupie' : 'Liczba torów (Max)'}</label>
                                    <select
                                        className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition-all"
                                        value={genOptions.lanes || 8}
                                        onChange={(e) => setGenOptions({ ...genOptions, lanes: parseInt(e.target.value) })}
                                    >
                                        {[...Array(20)].map((_, i) => (
                                            <option key={i + 1} value={i + 1}>{i + 1}</option>
                                        ))}
                                    </select>
                                </div>
                                {!isField && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold text-slate-700">Przydział torów</label>
                                        <select
                                            className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                            value={genOptions.laneAssignment}
                                            onChange={(e) => setGenOptions({ ...genOptions, laneAssignment: e.target.value as GenerateParams['laneAssignment'] })}
                                        >
                                            <option value="STANDARD">Standardowo od środka (np. 4-5-3-6...)</option>
                                            <option value="INSIDE_OUT">Od wewnątrz (1-2-3...)</option>
                                            <option value="ALPHABETIC">Alfabetycznie</option>
                                            <option value="ALPHANUMERIC">Alfanumerycznie</option>
                                            <option value="BEST_TO_WORST">Od najlepszego do najgorszego</option>
                                            <option value="WORST_TO_BEST">Od najgorszego do najlepszego</option>
                                            <option value="WATERFALL">Wodospad</option>
                                            <option value="WATERFALL_REVERSE">Wodospad odwrócony</option>
                                            <option value="WA_SPRINT_8">World Athletics - sprinty 8 torów</option>
                                            <option value="INDOOR_400_4LANES">WA Indoor 400 (4 os., tory 3-6)</option>
                                            <option value="RANDOM">Losowo</option>
                                        </select>
                                    </div>
                                )}
                                {indoor400RuleApplies && !isField && (
                                    <div className="text-[10px] font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed">
                                        Dla hali 400 m system wymusza regułę WA 2026: maks. 4 zawodników w serii oraz tory 3-6.
                                    </div>
                                )}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-slate-700">Kryterium</label>
                                    <select
                                        className="w-full h-10 border border-slate-200 rounded-lg px-3 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        value={genOptions.criterion}
                                        onChange={(e) => setGenOptions({ ...genOptions, criterion: e.target.value as Criterion })}
                                    >
                                        <option value="SB">Season Best (SB)</option>
                                        <option value="PB">Personal Best (PB)</option>
                                        <option value="RESULT">Wynik z zawodów (Eliminacje)</option>
                                    </select>
                                </div>
                                <Button
                                    className="w-full mt-2 bg-slate-800 hover:bg-slate-900 text-white font-bold"
                                    onClick={() => generateStartListMutation.mutate({ eventId, ...genOptions, heats: heatsCount })}
                                    disabled={generateStartListMutation.isPending}
                                >
                                    {generateStartListMutation.isPending ? 'Przetwarzanie...' : 'Rozstaw'}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto p-4 border-t border-slate-100">
                        <div className="bg-blue-50 rounded-lg p-3 text-[10px] text-blue-700 font-medium leading-relaxed">
                            Przeciągaj zawodników między kolumnami. Zmiany są lokalne dopóki nie klikniesz &quot;Zapisz&quot;.
                        </div>
                    </div>
                </aside>

                {/* DND AREA */}
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnd={handleDragEnd}
                >
                    <main className="flex-1 overflow-x-auto overflow-y-hidden bg-slate-50/50 p-8">
                        <div className="flex h-full gap-6 items-start min-w-max">
                            {/* Unassigned Pool */}
                            <div className="w-80 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm ring-1 ring-slate-100">
                                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl flex justify-between items-center group">
                                    <span className="font-bold text-slate-700 text-sm">Nierozstawieni</span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${items.unassigned?.length ? 'bg-orange-100 text-orange-600' : 'bg-slate-200 text-slate-500'}`}>
                                        {items.unassigned?.length || 0}
                                    </span>
                                </div>
                                <DroppableContainer id="unassigned" className="flex-1 p-3 overflow-y-auto custom-scrollbar bg-slate-50/30">
                                    <SortableContext
                                        id="unassigned"
                                        items={items.unassigned?.map(e => e.id) || []}
                                        strategy={verticalListSortingStrategy}
                                    >
                                        <div className="space-y-2">
                                            {items.unassigned?.map((entry) => (
                                                <SortableItem key={entry.id} entry={entry} lane={0} isField={isField} />
                                            ))}
                                        </div>
                                    </SortableContext>
                                    {items.unassigned?.length === 0 && (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                                            <Users className="h-8 w-8 mb-2" />
                                            <span className="text-xs font-medium">Brak zawodników</span>
                                        </div>
                                    )}
                                </DroppableContainer>
                            </div>

                            {/* Heats Columns */}
                            {[...Array(heatsCount)].map((_, i) => {
                                const heatNum = i + 1;
                                const heatId = `heat-${heatNum}`;
                                const heatEntries = items[heatId] || [];
                                const startLane = heatSettings[heatId]?.startLane || 1;

                                return (
                                    <div key={heatId} className="w-80 flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-200/40 transition-shadow">
                                        <div className="px-4 py-3 border-b border-slate-100 flex flex-col gap-2 bg-white rounded-t-xl sticky top-0 z-10">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2">
                                                    <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{isField ? `G${heatNum}` : `S${heatNum}`}</span>
                                                    <span className="font-bold text-slate-800 text-sm">{isField ? `Grupa ${heatNum}` : `Seria ${heatNum}`}</span>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                    {heatEntries.length} os.
                                                </span>
                                            </div>
                                            {/* Config Row - Hide for Field Events */}
                                            {!isField && (
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Start:</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="20"
                                                            className="w-10 h-6 text-xs font-bold text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                            value={startLane}
                                                            onChange={(e) => {
                                                                const val = parseInt(e.target.value) || 1;
                                                                setHeatSettings(prev => ({
                                                                    ...prev,
                                                                    [heatId]: { ...prev[heatId], startLane: val }
                                                                }));
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <label className="text-[9px] font-bold text-slate-500 uppercase">Tory:</label>
                                                        <select
                                                            className="w-[45px] h-6 text-xs font-bold text-center border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-white p-0 "
                                                            value={heatSettings[heatId]?.lanes || ''}
                                                            onChange={(e) => {
                                                                const val = e.target.value === '' ? undefined : parseInt(e.target.value);
                                                                setHeatSettings(prev => ({
                                                                    ...prev,
                                                                    [heatId]: { ...prev[heatId], lanes: val }
                                                                }));
                                                            }}
                                                        >
                                                            <option value="">Auto</option>
                                                            {[...Array(20)].map((_, i) => (
                                                                <option key={i + 1} value={i + 1}>{i + 1}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <DroppableContainer id={heatId} className="flex-1 p-3 overflow-y-auto custom-scrollbar">
                                            <SortableContext
                                                id={heatId}
                                                items={heatEntries.map(e => e.id)}
                                                strategy={verticalListSortingStrategy}
                                            >
                                                <div className="space-y-2">
                                                    {heatEntries.map((entry, index) => (
                                                        <SortableItem
                                                            key={entry.id}
                                                            entry={entry}
                                                            isField={isField}
                                                            lane={isField ? (index + 1) : (startLane + index)}
                                                            isOverflow={!isField && index >= (heatSettings[heatId]?.lanes || genOptions.lanes || 8)}
                                                            onRemove={() => handleRemoveFromHeat(heatId, entry.id)}
                                                        />
                                                    ))}
                                                </div>

                                            </SortableContext>

                                            {/* Empty Slots visualization */}
                                            {!isField && (Array.from({ length: Math.max(0, (heatSettings[heatId]?.lanes || genOptions.lanes || 8) - heatEntries.length) }).map((_, idx) => (
                                                <div key={`empty-${idx}`} className="mt-2 p-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center gap-3 opacity-50">
                                                    <div className="w-8 text-center flex flex-col items-center justify-center py-0.5">
                                                        <span className="text-[9px] text-slate-300 uppercase leading-none">Tor</span>
                                                        <span className="text-sm font-bold text-slate-300 leading-none">
                                                            {startLane + heatEntries.length + idx}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs font-medium text-slate-300">Pusty tor</span>
                                                </div>
                                            )))}

                                            {heatEntries.length === 0 && (heatSettings[heatId]?.lanes || genOptions.lanes || 8) === 0 && (
                                                <div className="h-32 border-2 border-dashed border-slate-100 rounded-lg flex items-center justify-center m-2">
                                                    <span className="text-slate-300 text-xs font-medium">Przeciągnij tutaj</span>
                                                </div>
                                            )}
                                        </DroppableContainer>
                                    </div>
                                );
                            })}
                        </div>
                    </main>

                    <DragOverlay dropAnimation={{ sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.5' } } }) }}>
                        {activeEntry ? (
                            <div className="bg-white p-3 rounded-lg border-2 border-blue-500 shadow-2xl w-72 cursor-grabbing">
                                <div className="flex items-center gap-3">
                                    <div className="w-6 text-center text-xs font-bold text-slate-400">#</div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs font-bold text-slate-900 truncate">{activeEntry.athleteName}</span>
                                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                            {activeEntry.bib && <span className="font-mono bg-slate-100 px-1 rounded">#{activeEntry.bib}</span>}
                                            <span className="truncate">{activeEntry.club}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </DragOverlay>
                </DndContext>
            </div>
        </div>
    );
}


