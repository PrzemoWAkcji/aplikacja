'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth-store';
import { useState } from 'react';
import { Plus, Trash2, Users, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
}

interface Entry {
    id: string;
    athleteName: string;
    status: string;
    bib?: string;
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
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

    // Redirect if not authenticated (client-side check)
    if (typeof window !== 'undefined' && !token) {
        router.push('/login');
    }

    const { data: meeting, isLoading, error } = useQuery<Meeting>({
        queryKey: ['meeting', params.id],
        queryFn: async () => {
            const response = await api.get(`/meetings/${params.id}`);
            return response.data;
        },
        enabled: !!params.id && !!token,
    });

    const { data: entries } = useQuery<Entry[]>({
        queryKey: ['entries', selectedEventId],
        queryFn: async () => {
            const response = await api.get(`/entries?eventId=${selectedEventId}`);
            return response.data;
        },
        enabled: !!selectedEventId,
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
            if (selectedEventId === deleteEventMutation.variables) {
                setSelectedEventId(null);
            }
        },
    });

    const deleteEntryMutation = useMutation({
        mutationFn: async (entryId: string) => {
            return api.delete(`/entries/${entryId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries', selectedEventId] });
        }
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
                    <div className="flex gap-2">
                        <Link href={`/meetings/${meeting.id}/register`} target="_blank">
                            <Button variant="outline">
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Link do rejestracji
                            </Button>
                        </Link>
                        <Button variant="default" onClick={() => router.push('/dashboard')}>
                            Wróć do Dashboardu
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Events List */}
                    <div className="col-span-1 space-y-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>Konkurencje</CardTitle>
                                <Button size="icon" onClick={() => setIsEventFormOpen(!isEventFormOpen)}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent>
                                {isEventFormOpen && (
                                    <div className="mb-6 p-4 border rounded-md bg-slate-50">
                                        <h4 className="font-medium mb-3">Nowa konkurencja</h4>
                                        <form onSubmit={handleCreateEvent} className="space-y-4">
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
                                            <div className="flex justify-end gap-2">
                                                <Button type="button" variant="ghost" onClick={() => setIsEventFormOpen(false)}>Anuluj</Button>
                                                <Button type="submit" size="sm" disabled={createEventMutation.isPending}>
                                                    Dodaj
                                                </Button>
                                            </div>
                                        </form>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    {meeting.events?.map((event) => (
                                        <div
                                            key={event.id}
                                            className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${selectedEventId === event.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'}`}
                                            onClick={() => setSelectedEventId(event.id)}
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
                                                        deleteEventMutation.mutate(event.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {(!meeting.events || meeting.events.length === 0) && (
                                        <p className="text-gray-500 text-center py-4 text-sm">Brak konkurencji.</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Entries List */}
                    <div className="col-span-2 space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {selectedEventId
                                        ? `Zgłoszenia: ${meeting.events.find(e => e.id === selectedEventId)?.name}`
                                        : 'Zgłoszenia'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!selectedEventId ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                        <Users className="h-12 w-12 mb-4 opacity-20" />
                                        <p>Wybierz konkurencję z listy obok, aby zobaczyć zgłoszenia.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {entries?.length === 0 ? (
                                            <p className="text-center text-gray-500 py-8">Brak zgłoszeń dla tej konkurencji.</p>
                                        ) : (
                                            <div className="rounded-md border">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zawodnik</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nr Bib</th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {entries?.map((entry) => (
                                                            <tr key={entry.id}>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.athleteName}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.bib || '-'}</td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${entry.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' :
                                                                        entry.status === 'SCRATCHED' ? 'bg-red-100 text-red-800' :
                                                                            'bg-yellow-100 text-yellow-800'
                                                                        }`}>
                                                                        {entry.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                                    <button
                                                                        onClick={() => deleteEntryMutation.mutate(entry.id)}
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
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
