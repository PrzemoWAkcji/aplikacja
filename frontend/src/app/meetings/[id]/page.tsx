'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth-store';
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
}

interface Meeting {
    id: string;
    name: string;
    date: string;
    location: string;
    events: Event[];
}

export default function MeetingDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const queryClient = useQueryClient();
    const [isEventFormOpen, setIsEventFormOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({ name: '', code: '', gender: 'M' });

    if (!token) {
        router.push('/login');
        // return null; // Hook requirement: hooks must differ... actually return null is fine here
    }

    const { data: meeting, isLoading, error } = useQuery<Meeting>({
        queryKey: ['meeting', params.id],
        queryFn: async () => {
            const response = await api.get(`/meetings/${params.id}`);
            return response.data;
        },
        enabled: !!params.id && !!token,
    });

    const createEventMutation = useMutation({
        mutationFn: async (eventData: any) => {
            return api.post('/events', { ...eventData, meetingId: params.id });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', params.id] });
            setIsEventFormOpen(false);
            setNewEvent({ name: '', code: '', gender: 'M' });
        },
    });

    const deleteEventMutation = useMutation({
        mutationFn: async (eventId: string) => {
            return api.delete(`/events/${eventId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', params.id] });
        },
    });

    const handleCreateEvent = (e: React.FormEvent) => {
        e.preventDefault();
        createEventMutation.mutate(newEvent);
    };

    if (isLoading) return <div className="p-8 text-center">Ładowanie...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Błąd pobierania danych</div>;
    if (!meeting) return <div className="p-8 text-center">Nie znaleziono zawodów</div>;

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">{meeting.name}</h1>
                        <p className="text-gray-500">
                            {new Date(meeting.date).toLocaleDateString()} | {meeting.location}
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                        Wróć do Dashboardu
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="col-span-2 space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Konkurencje ({meeting.events?.length || 0})</CardTitle>
                                <Button size="sm" onClick={() => setIsEventFormOpen(!isEventFormOpen)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Dodaj Konkurencję
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {isEventFormOpen && (
                                    <div className="mb-6 p-4 border rounded-md bg-slate-50">
                                        <h4 className="font-medium mb-3">Nowa konkurencja</h4>
                                        <form onSubmit={handleCreateEvent} className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                                    className="flex h-10 w-full rounded-md border border-slate-300 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                                    value={newEvent.gender}
                                                    onChange={(e) => setNewEvent({ ...newEvent, gender: e.target.value })}
                                                >
                                                    <option value="M">Mężczyźni</option>
                                                    <option value="K">Kobiety</option>
                                                    <option value="MIX">Mix</option>
                                                </select>
                                            </div>
                                            <div className="flex justify-end gap-2">
                                                <Button type="button" variant="ghost" onClick={() => setIsEventFormOpen(false)}>Anuluj</Button>
                                                <Button type="submit" disabled={createEventMutation.isPending}>
                                                    {createEventMutation.isPending ? 'Dodawanie...' : 'Zapisz'}
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {meeting.events?.map((event) => (
                                        <div key={event.id} className="flex items-center justify-between p-3 border rounded-md hover:bg-slate-50">
                                            <div>
                                                <span className="font-medium block">{event.name}</span>
                                                <span className="text-xs text-gray-500">{event.code} | {event.gender}</span>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => {
                                                    if (confirm('Czy na pewno usunąć tę konkurencję?')) {
                                                        deleteEventMutation.mutate(event.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {(!meeting.events || meeting.events.length === 0) && (
                                        <p className="text-gray-500 text-center py-4">Brak dodanych konkurencji.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Statystyki</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-gray-500">Liczba zgłoszeń: 0</p>
                                <p className="text-sm text-gray-500">Status: Otwarty</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
