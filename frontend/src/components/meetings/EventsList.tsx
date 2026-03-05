'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState } from 'react';
import { Plus, Trash2, Trophy, Users, Clock, Hash } from 'lucide-react';
import { eventRequiresWind } from '../../lib/utils';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
    startTime?: string;
    trialsMode?: string;
    model?: string;
}

interface EventsListProps {
    meetingId: string;
    events: Event[];
    selectedEventId: string | null;
    onSelectEvent: (id: string) => void;
}

export default function EventsList({ meetingId, events, selectedEventId, onSelectEvent }: EventsListProps) {
    const queryClient = useQueryClient();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [newEvent, setNewEvent] = useState({
        name: '',
        code: '',
        gender: 'M',
        eventCode: '',
        ageGroup: '',
        stage: 'Final',
        heights: '',
        lanes: 8,
        trialsMode: '6',
        model: 'Track',
        requiresWind: false
    });

    const filteredEvents = events.filter(e =>
        e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const sortedFilteredEvents = [...filteredEvents].sort((a, b) => {
        if (!a.startTime && !b.startTime) return a.name.localeCompare(b.name, 'pl');
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;

        const byTime = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        if (byTime !== 0) return byTime;

        return a.name.localeCompare(b.name, 'pl', { numeric: true, sensitivity: 'base' });
    });

    const createMutation = useMutation({
        mutationFn: async (eventData: any) => {
            return api.post('/events', { ...eventData, meetingId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
            setIsFormOpen(false);
            setNewEvent({ name: '', code: '', gender: 'M', eventCode: '', ageGroup: '', stage: 'Final', heights: '', lanes: 8, trialsMode: '6', model: 'Track', requiresWind: false });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (eventId: string) => {
            return api.delete(`/events/${eventId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newEvent);
    };

    const getAutoEventCode = (name: string) => {
        const nameLower = name.toLowerCase();
        if (nameLower.includes('60') && nameLower.includes('przez')) return '60H';
        if (nameLower.includes('100') && nameLower.includes('przez')) return '100H';
        if (nameLower.includes('110') && nameLower.includes('przez')) return '110H';
        if (nameLower.includes('400') && nameLower.includes('przez')) return '400H';
        if (nameLower.includes('60')) return '60';
        if (nameLower.includes('100')) return '100';
        if (nameLower.includes('200')) return '200';
        if (nameLower.includes('400')) return '400';
        if (nameLower.includes('800')) return '800';
        if (nameLower.includes('1500')) return '1500';
        if (nameLower.includes('3000')) return '3000';
        if (nameLower.includes('5000')) return '5000';
        if (nameLower.includes('10000') || nameLower.includes('10 000')) return '10000';
        if (nameLower.includes('wzwy\u017C')) return 'HJ';
        if (nameLower.includes('tyczce') || nameLower.includes('tyczka')) return 'PV';
        if (nameLower.includes('dal')) return 'LJ';
        if (nameLower.includes('tr\u00F3jskok')) return 'TJ';
        if (nameLower.includes('kula')) return 'SP';
        if (nameLower.includes('dysk')) return 'DT';
        if (nameLower.includes('oszczep')) return 'JT';
        if (nameLower.includes('m\u0142ot')) return 'HT';
        if (nameLower.includes('4') && nameLower.includes('100')) return '4x100';
        if (nameLower.includes('4') && nameLower.includes('400')) return '4x400';
        return '';
    };

    const handleNameChange = (name: string) => {
        const autoEventCode = getAutoEventCode(name);
        const suffix = newEvent.gender === 'MIX' ? 'X' : newEvent.gender;
        const code = autoEventCode ? `${autoEventCode}${suffix}` : newEvent.code;
        const autoWind = eventRequiresWind(name, code);

        setNewEvent({ ...newEvent, name, eventCode: autoEventCode, code, requiresWind: autoWind });
    };

    const handleGenderChange = (gender: string) => {
        const suffix = gender === 'MIX' ? 'X' : gender;
        const code = newEvent.eventCode ? `${newEvent.eventCode}${suffix}` : newEvent.code;
        const autoWind = eventRequiresWind(newEvent.name, code);
        setNewEvent({ ...newEvent, gender, code, requiresWind: autoWind });
    };

    return (
        <Card className="shadow-none border-0 bg-transparent h-[calc(100vh-140px)] flex flex-col">
            <CardHeader className="px-0 pt-0 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-900 tracking-tight">Konkurencje</h3>
                    <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-full"
                        onClick={() => setIsFormOpen(!isFormOpen)}
                    >
                        <Plus className={`h-5 w-5 transition-transform ${isFormOpen ? 'rotate-45 text-red-500' : ''}`} />
                    </Button>
                </div>

                <div className="relative">
                    <Input
                        placeholder="Szukaj konkurencji..."
                        className="h-9 bg-slate-100 border-transparent focus:bg-white transition-all pl-9 text-xs font-medium"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <div className="absolute left-3 top-2.5 text-slate-400">
                        <Hash className="h-4 w-4" />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col min-h-0">
                {isFormOpen && (
                    <div className="mb-4 p-4 border border-slate-200 rounded-xl bg-white shadow-lg animate-in slide-in-from-top-2 duration-200 z-10">
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <h4 className="font-bold text-xs uppercase text-slate-400">Nowa Konkurencja</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="col-span-2">
                                    <Input
                                        placeholder="Nazwa (np. 100m M)"
                                        className="h-8 text-xs font-bold"
                                        value={newEvent.name}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="col-span-2">
                                    <Input
                                        type="number"
                                        placeholder={'Liczba tor\u00F3w (domy\u015Blnie 8)'}
                                        className="h-8 text-xs"
                                        min={1}
                                        max={20}
                                        value={newEvent.lanes || ''}
                                        onChange={(e) => setNewEvent({ ...newEvent, lanes: parseInt(e.target.value) || 8 })}
                                    />
                                </div>
                            </div>
                            <Button type="submit" size="sm" className="w-full h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800" disabled={createMutation.isPending}>
                                {createMutation.isPending ? '...' : 'Dodaj'}
                            </Button>
                        </form>
                    </div>
                )}

                <div className="overflow-y-auto pr-2 space-y-4 flex-1">
                    {sortedFilteredEvents.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            Brak konkurencji
                        </div>
                    ) : (
                        <div className="space-y-1.5 pt-2">
                            <h4 className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] mb-2">
                                Kolejność wg programu minutowego
                            </h4>
                            {sortedFilteredEvents.map((event) => (
                                <div
                                    key={event.id}
                                    className={`
                                        group flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all relative overflow-hidden
                                        ${selectedEventId === event.id
                                            ? 'bg-blue-600 shadow-md shadow-blue-200'
                                            : 'hover:bg-white hover:shadow-sm text-slate-600'
                                        }
                                    `}
                                    onClick={() => onSelectEvent(event.id)}
                                >
                                    <div className="flex items-center gap-3 relative z-10">
                                        <div className={`
                                            w-1 h-8 rounded-full 
                                            ${selectedEventId === event.id ? 'bg-white/30' : 'bg-slate-200 group-hover:bg-blue-400'}
                                        `}></div>

                                        <div className="flex flex-col">
                                            <span className={`text-sm font-bold leading-none ${selectedEventId === event.id ? 'text-white' : 'text-slate-700'}`}>
                                                {event.name}
                                            </span>
                                            <span className={`text-[10px] mt-1 font-medium ${selectedEventId === event.id ? 'text-blue-100' : 'text-slate-400'}`}>
                                                {event.gender === 'M' ? 'Mężczyźni' : event.gender === 'K' ? 'Kobiety' : 'Mix'} | {event.code}
                                                {event.startTime
                                                    ? ` | ${new Date(event.startTime).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`
                                                    : ' | bez godziny'}
                                            </span>
                                        </div>
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${selectedEventId === event.id ? 'text-white hover:bg-white/20' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm(`Czy na pewno usunąć konkurencję ${event.name}?`)) {
                                                deleteMutation.mutate(event.id);
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
