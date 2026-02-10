'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
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
    const [newEvent, setNewEvent] = useState({ name: '', code: '', gender: 'M' });

    const createMutation = useMutation({
        mutationFn: async (eventData: any) => {
            return api.post('/events', { ...eventData, meetingId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
            setIsFormOpen(false);
            setNewEvent({ name: '', code: '', gender: 'M' });
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

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Konkurencje</CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('federation-import')?.click()}>
                        Import CSV
                    </Button>
                    <input
                        id="federation-import"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const formData = new FormData();
                            formData.append('file', file);

                            try {
                                await api.post(`/file-mapping/import/federation/${meetingId}`, formData);
                                queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
                                alert('Zgłoszenia zostały zaimportowane.');
                            } catch (error) {
                                alert('Błąd podczas importu zgłoszeń.');
                            }
                        }}
                    />
                    <Button size="icon" onClick={() => setIsFormOpen(!isFormOpen)}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isFormOpen && (
                    <div className="mb-6 p-4 border rounded-md bg-slate-50">
                        <h4 className="font-medium mb-3">Nowa konkurencja</h4>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                placeholder="Nazwa (np. 100 metrów)"
                                value={newEvent.name}
                                onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                                required
                            />
                            <Input
                                placeholder="Kod (np. 100M)"
                                value={newEvent.code}
                                onChange={(e) => setNewEvent({ ...newEvent, code: e.target.value })}
                                required
                            />
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-background px-3 py-2 text-sm"
                                value={newEvent.gender}
                                onChange={(e) => setNewEvent({ ...newEvent, gender: e.target.value })}
                            >
                                <option value="M">Mężczyźni</option>
                                <option value="K">Kobiety</option>
                                <option value="MIX">Mix</option>
                            </select>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Anuluj</Button>
                                <Button type="submit" size="sm" disabled={createMutation.isPending}>Dodaj</Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="space-y-2">
                    {events?.map((event) => (
                        <div
                            key={event.id}
                            className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${selectedEventId === event.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'}`}
                            onClick={() => onSelectEvent(event.id)}
                        >
                            <div>
                                <span className="font-medium block">{event.name}</span>
                                <span className="text-xs text-gray-500">{event.code} | {event.gender}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Czy na pewno usunąć tę konkurencję?')) {
                                        deleteMutation.mutate(event.id);
                                    }
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    {(!events || events.length === 0) && (
                        <p className="text-gray-500 text-center py-4 text-sm">Brak konkurencji.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
