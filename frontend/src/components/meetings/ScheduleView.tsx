'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState } from 'react';
import { Clock, Save, Layers, Users, Hash, ChevronRight, Activity, Printer, Calendar } from 'lucide-react';
import { printTimetable } from '../../lib/printUtils';
import { TimePicker } from '../ui/time-picker';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
    startTime?: string;
    ageGroup?: string;
    stage?: string;
    model?: string;
    finalStartTime?: string;
    finalCount?: number;
    finalInterval?: number;
    finalStartTimes?: string;
    advancementRule?: string;
    entries?: { heat: number | null }[];
}

interface ScheduleViewProps {
    meetingId: string;
    events: Event[];
    meeting?: any; // Full meeting object for printing
}

export default function ScheduleView({ meetingId, events, meeting }: ScheduleViewProps) {
    const queryClient = useQueryClient();
    const [editingState, setEditingState] = useState<Record<string, Partial<Event>>>({});

    const updateMutation = useMutation({
        mutationFn: async ({ eventId, data }: { eventId: string; data: Partial<Event> }) => {
            return api.patch(`/events/${eventId}`, data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
        },
    });

    // Flatten events into display rows (one for stage, one for final if exists)
    const displayRows = events.flatMap(event => {
        const rows = [];

        // Primary stage row
        rows.push({
            id: event.id,
            eventId: event.id,
            type: 'primary',
            name: event.name,
            gender: event.gender,
            ageGroup: event.ageGroup,
            stage: event.stage,
            startTime: event.startTime,
            event: event
        });

        // Add final rows if it has a time and it's not already the primary stage
        if (event.finalStartTime && event.stage !== 'Final') {
            const count = event.finalCount || 1;
            const interval = event.finalInterval || 5;
            let customTimes: string[] = [];
            try { customTimes = JSON.parse(event.finalStartTimes || '[]'); } catch (e) { }

            for (let i = 0; i < count; i++) {
                let startTimeIso = event.finalStartTime;

                // If we have a custom time for this index, use it.
                // Note: we consider individual times for any index.
                if (customTimes[i]) {
                    startTimeIso = customTimes[i];
                } else if (i > 0) {
                    // Fallback to interval calculation
                    const date = new Date(event.finalStartTime);
                    date.setMinutes(date.getMinutes() + (i * interval));
                    startTimeIso = date.toISOString();
                }

                rows.push({
                    id: `${event.id}-final-${i}`,
                    eventId: event.id,
                    type: 'final',
                    index: i,
                    total: count,
                    name: count > 1 ? `${event.name} (Finał ${String.fromCharCode(65 + i)})` : event.name,
                    gender: event.gender,
                    ageGroup: event.ageGroup,
                    stage: 'Final',
                    startTime: startTimeIso,
                    advancementRule: i === 0 ? event.advancementRule : null,
                    event: event
                });
            }
        }

        return rows;
    });

    const sortedRows = displayRows.sort((a, b) => {
        if (!a.startTime && !b.startTime) return a.name.localeCompare(b.name);
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    const handleFieldChange = (eventId: string, field: keyof Event, value: any) => {
        const currentState = editingState[eventId] || {};
        setEditingState({
            ...editingState,
            [eventId]: { ...currentState, [field]: value }
        });
    };

    const handleSave = (eventId: string) => {
        const data = editingState[eventId];
        if (data) {
            updateMutation.mutate({ eventId, data });
            const newEditingState = { ...editingState };
            delete newEditingState[eventId];
            setEditingState(newEditingState);
        }
    };

    const formatTimeOnly = (isoString?: string) => {
        if (!isoString) return '10:00';
        const date = new Date(isoString);
        return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    };

    const formatDateOnly = (isoString?: string) => {
        if (!isoString) return '';
        return new Date(isoString).toISOString().split('T')[0];
    };

    const handleTimeChange = (eventId: string, time: string, isFinal: boolean = false, finalIndex?: number) => {
        const event = events.find(e => e.id === eventId);

        if (isFinal && finalIndex !== undefined) {
            const count = editingState[eventId]?.finalCount || event?.finalCount || 1;
            let currentTimes: string[] = [];
            try { currentTimes = JSON.parse(editingState[eventId]?.finalStartTimes || event?.finalStartTimes || '[]'); } catch (e) { }

            // If editing index 0, we can also sync it with finalStartTime
            // But let's use the array for consistency
            if (finalIndex === 0) {
                const currentIso = editingState[eventId]?.finalStartTime || event?.finalStartTime || meeting?.date || new Date().toISOString();
                const currentDate = new Date(currentIso).toISOString().split('T')[0];
                const newTime = new Date(`${currentDate}T${time}:00`).toISOString();
                handleFieldChange(eventId, 'finalStartTime', newTime);
            } else {
                // Individual final (B, C...)
                while (currentTimes.length < count) {
                    // Fill with interval if empty
                    const nextIdx = currentTimes.length;
                    const base = event?.finalStartTime ? new Date(event.finalStartTime) : new Date();
                    base.setMinutes(base.getMinutes() + (nextIdx * (event?.finalInterval || 5)));
                    currentTimes.push(base.toISOString());
                }
                const oldIso = currentTimes[finalIndex] || (meeting?.date || new Date().toISOString());
                const datePart = new Date(oldIso).toISOString().split('T')[0];
                currentTimes[finalIndex] = new Date(`${datePart}T${time}:00`).toISOString();
                handleFieldChange(eventId, 'finalStartTimes', JSON.stringify(currentTimes));
            }
        } else {
            const currentIso = editingState[eventId]?.startTime || event?.startTime || meeting?.date || new Date().toISOString();
            const currentDate = new Date(currentIso).toISOString().split('T')[0];
            handleFieldChange(eventId, 'startTime', new Date(`${currentDate}T${time}:00`).toISOString());
        }
    };

    const handleDateChange = (eventId: string, date: string, isFinal: boolean = false, finalIndex?: number) => {
        const event = events.find(e => e.id === eventId);
        if (isFinal && finalIndex !== undefined) {
            if (finalIndex === 0) {
                const currentIso = editingState[eventId]?.finalStartTime || event?.finalStartTime || meeting?.date || new Date().toISOString();
                const currentTime = new Date(currentIso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
                handleFieldChange(eventId, 'finalStartTime', new Date(`${date}T${currentTime}:00`).toISOString());
            } else {
                const count = editingState[eventId]?.finalCount || event?.finalCount || 1;
                let currentTimes: string[] = [];
                try { currentTimes = JSON.parse(editingState[eventId]?.finalStartTimes || event?.finalStartTimes || '[]'); } catch (e) { }
                while (currentTimes.length < count) {
                    const nextIdx = currentTimes.length;
                    const base = event?.finalStartTime ? new Date(event.finalStartTime) : new Date();
                    base.setMinutes(base.getMinutes() + (nextIdx * (event?.finalInterval || 5)));
                    currentTimes.push(base.toISOString());
                }
                const oldIso = currentTimes[finalIndex];
                const timePart = new Date(oldIso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
                currentTimes[finalIndex] = new Date(`${date}T${timePart}:00`).toISOString();
                handleFieldChange(eventId, 'finalStartTimes', JSON.stringify(currentTimes));
            }
        } else {
            const currentIso = editingState[eventId]?.startTime || event?.startTime || meeting?.date || new Date().toISOString();
            const currentTime = new Date(currentIso).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
            handleFieldChange(eventId, 'startTime', new Date(`${date}T${currentTime}:00`).toISOString());
        }
    };

    const getHeatCount = (entries?: { heat: number | null }[]) => {
        if (!entries || entries.length === 0) return 0;
        const heatNumbers = entries.map(e => e.heat).filter(h => h !== null) as number[];
        if (heatNumbers.length === 0) return 1;
        return Math.max(...heatNumbers);
    };

    return (
        <Card className="border-none shadow-2xl shadow-blue-900/5 bg-white rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="flex items-center gap-3 text-slate-900 text-2xl font-black tracking-tight">
                        <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 shrink-0">
                            <Clock className="h-5 w-5" />
                        </div>
                        Program Minutowy
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={() => meeting && printTimetable(meeting, events)}
                            className="bg-white border-slate-200 shadow-sm hover:bg-slate-50 text-slate-700 font-bold text-xs h-10 px-4 rounded-xl transition-all"
                            disabled={!meeting}
                        >
                            <Printer className="h-4 w-4 mr-2 text-blue-600" />
                            Drukuj Program
                        </Button>
                        <div className="hidden sm:flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-3 py-1.5 rounded-full">
                            <Activity className="h-3 w-3 text-green-500" />
                            LIVE EDITOR
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {sortedRows.length === 0 ? (
                    <div className="py-24 text-center">
                        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 mb-4">
                            <Layers className="h-10 w-10 text-slate-200" />
                        </div>
                        <p className="text-slate-500 font-bold text-lg">Brak konkurencji</p>
                        <p className="text-slate-400 text-sm max-w-xs mx-auto mt-2">Dodaj konkurencje w zakładce "Lista startowa", aby móc zarządzać czasem.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto scroller">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-left">
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[180px]">Godzina</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-[100px]">Data</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Konkurencja / Runda</th>
                                    <th className="px-6 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center w-[100px]">Biegi / Gr.</th>
                                    <th className="px-6 py-5 text-right w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {sortedRows.map((row) => {
                                    const event = row.event;
                                    const heatCount = getHeatCount(event.entries);
                                    const isFinalRow = row.type === 'final';
                                    const isEditing = editingState[event.id] !== undefined;

                                    // Calculate current display time based on editing state and row index
                                    let currentStartTime = row.startTime;
                                    if (isEditing) {
                                        if (isFinalRow) {
                                            if (row.index === 0) {
                                                currentStartTime = editingState[event.id]?.finalStartTime || event.finalStartTime;
                                            } else if (row.index !== undefined) {
                                                let editTimes: string[] = [];
                                                try { editTimes = JSON.parse(editingState[event.id]?.finalStartTimes || event.finalStartTimes || '[]'); } catch (e) { }
                                                currentStartTime = editTimes[row.index] || row.startTime;
                                            }
                                        } else {
                                            currentStartTime = editingState[event.id]?.startTime || event.startTime;
                                        }
                                    }

                                    return (
                                        <tr key={row.id} className={`group hover:bg-blue-50/30 transition-all duration-300 ${isFinalRow ? 'bg-amber-50/20' : ''}`}>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-2">
                                                    <div className="relative">
                                                        <Input
                                                            type="date"
                                                            className="h-9 w-[170px] bg-white border-slate-200 text-xs font-bold rounded-lg focus:ring-blue-500 shadow-sm pl-8"
                                                            value={formatDateOnly(currentStartTime) || (meeting?.date ? formatDateOnly(meeting.date) : '')}
                                                            onChange={(e) => handleDateChange(event.id, e.target.value, isFinalRow, row.index)}
                                                        />
                                                        <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                                    </div>
                                                    <TimePicker
                                                        className="h-9 w-[170px]"
                                                        value={formatTimeOnly(currentStartTime)}
                                                        onChange={(val: string) => handleTimeChange(event.id, val, isFinalRow, row.index)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dzień</span>
                                                <span className="text-[11px] font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-md">
                                                    {currentStartTime ? new Date(currentStartTime).toLocaleDateString('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{row.name}</span>
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${row.gender === 'K' ? 'bg-pink-100 text-pink-700' :
                                                            row.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                            }`}>
                                                            {row.gender}
                                                        </span>
                                                        {isFinalRow && (
                                                            <span className="text-[9px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                                                AUTO FINAL
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {isFinalRow ? (
                                                            <span className="h-7 px-1 flex items-center text-[10px] font-black text-amber-600 uppercase">Finał</span>
                                                        ) : (
                                                            <select
                                                                className="h-7 w-24 px-1 bg-transparent border-none text-[10px] font-bold text-blue-600 focus:ring-0 cursor-pointer hover:bg-blue-50 rounded"
                                                                value={editingState[event.id]?.stage || event.stage || 'Final'}
                                                                onChange={(e) => handleFieldChange(event.id, 'stage', e.target.value)}
                                                            >
                                                                <option value="Final">Finał</option>
                                                                <option value="Heat">Eliminacje</option>
                                                                <option value="Semi-Final">Półfinał</option>
                                                                <option value="Qualification">Kwalifikacje</option>
                                                            </select>
                                                        )}
                                                        <span className="text-[10px] font-bold text-slate-300">|</span>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{row.ageGroup || 'Senior'}</span>
                                                        {isFinalRow && row.advancementRule && (
                                                            <>
                                                                <span className="text-[10px] font-bold text-slate-300">|</span>
                                                                <span className="text-[10px] font-bold text-emerald-600 uppercase">Awans: {row.advancementRule}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="text-xs font-black text-slate-700">
                                                        {isFinalRow
                                                            ? (row.total || 1)
                                                            : (heatCount > 1 ? `(1-${heatCount})` : `(${heatCount})`)
                                                        }
                                                    </span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        {isFinalRow ? 'Finały' : 'Serie'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button
                                                    size="icon"
                                                    className={`h-9 w-9 rounded-xl transition-all duration-300 ${isEditing
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 hover:scale-105'
                                                        : 'bg-slate-100 text-slate-300 hover:bg-slate-200 hover:text-slate-500 cursor-default'
                                                        }`}
                                                    onClick={() => isEditing && handleSave(event.id)}
                                                    disabled={!isEditing || updateMutation.isPending}
                                                >
                                                    <Save className="h-4.5 w-4.5" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Users className="h-3.5 w-3.5" />
                            ŁĄCZNIE KONKURENCJI: {events.length}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
