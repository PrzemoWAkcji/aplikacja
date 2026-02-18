'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState } from 'react';
import { Clock, Save, Layers, Users, Hash, ChevronRight, Activity, Printer } from 'lucide-react';
import { printTimetable } from '../../lib/printUtils';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
    startTime?: string;
    ageGroup?: string;
    stage?: string;
    model?: string;
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

    const sortedEvents = [...events].sort((a, b) => {
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
            // Semi-clear the state - usually we want to keep it until success but for simplicity:
            const newEditingState = { ...editingState };
            delete newEditingState[eventId];
            setEditingState(newEditingState);
        }
    };

    const formatTimeForInput = (isoString?: string) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return date.toISOString().slice(0, 16);
    };

    const getHeatCount = (entries?: { heat: number | null }[]) => {
        if (!entries || entries.length === 0) return 0;
        const heatNumbers = entries.map(e => e.heat).filter(h => h !== null) as number[];
        if (heatNumbers.length === 0) return 1; // Default to 1 group if confirmed but not seeded
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
                {sortedEvents.length === 0 ? (
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
                                {sortedEvents.map((event) => {
                                    const heatCount = getHeatCount(event.entries);
                                    const isEditing = editingState[event.id] !== undefined;

                                    return (
                                        <tr key={event.id} className="group hover:bg-blue-50/30 transition-all duration-300">
                                            <td className="px-6 py-4">
                                                <Input
                                                    type="datetime-local"
                                                    className="h-9 w-[170px] bg-white border-slate-200 text-xs font-bold rounded-lg focus:ring-blue-500 shadow-sm"
                                                    defaultValue={formatTimeForInput(event.startTime)}
                                                    onChange={(e) => handleFieldChange(event.id, 'startTime', new Date(e.target.value).toISOString())}
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-[11px] font-bold text-slate-500">
                                                    {event.startTime ? new Date(event.startTime).toLocaleDateString('pl-PL') : '-'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{event.name}</span>
                                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider ${event.gender === 'K' ? 'bg-pink-100 text-pink-700' :
                                                            event.gender === 'M' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                            }`}>
                                                            {event.gender}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <select
                                                            className="h-7 w-28 px-1 bg-transparent border-none text-[10px] font-bold text-blue-600 focus:ring-0 cursor-pointer hover:bg-blue-50 rounded"
                                                            defaultValue={event.stage || 'Final'}
                                                            onChange={(e) => handleFieldChange(event.id, 'stage', e.target.value)}
                                                        >
                                                            <option value="Final">Finał</option>
                                                            <option value="Heat">Eliminacje</option>
                                                            <option value="Semi-Final">Półfinał</option>
                                                            <option value="Qualification">Kwalifikacje</option>
                                                        </select>
                                                        <span className="text-[10px] font-bold text-slate-400">|</span>
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">{event.ageGroup || 'Senior'}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="inline-flex flex-col items-center">
                                                    <span className="text-xs font-black text-slate-700">{heatCount > 1 ? `(1-${heatCount})` : `(${heatCount})`}</span>
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Serie</span>
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
