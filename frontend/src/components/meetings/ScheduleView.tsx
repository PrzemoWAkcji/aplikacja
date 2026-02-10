'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState } from 'react';
import { Clock, Save } from 'lucide-react';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
    startTime?: string;
}

interface ScheduleViewProps {
    meetingId: string;
    events: Event[];
}

export default function ScheduleView({ meetingId, events }: ScheduleViewProps) {
    const queryClient = useQueryClient();
    const [editingTimes, setEditingTimes] = useState<Record<string, string>>({});

    const updateMutation = useMutation({
        mutationFn: async ({ eventId, startTime }: { eventId: string; startTime: string }) => {
            return api.patch(`/events/${eventId}`, { startTime: new Date(startTime).toISOString() });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
        },
    });

    const sortedEvents = [...events].sort((a, b) => {
        if (!a.startTime && !b.startTime) return 0;
        if (!a.startTime) return 1;
        if (!b.startTime) return -1;
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    const handleTimeChange = (eventId: string, value: string) => {
        setEditingTimes({ ...editingTimes, [eventId]: value });
    };

    const handleSave = (eventId: string) => {
        const time = editingTimes[eventId];
        if (time) {
            updateMutation.mutate({ eventId, startTime: time });
        }
    };

    const formatTime = (isoString?: string) => {
        if (!isoString) return '-';
        return new Date(isoString).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    };

    const genderLabel = (gender: string) => {
        switch (gender) {
            case 'M': return 'Mężczyźni';
            case 'K': return 'Kobiety';
            case 'MIX': return 'Mix';
            default: return gender;
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Program Zawodów
                </CardTitle>
            </CardHeader>
            <CardContent>
                {sortedEvents.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">
                        Brak konkurencji. Dodaj konkurencje, aby stworzyć program.
                    </p>
                ) : (
                    <div className="rounded-md border">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Godzina</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Konkurencja</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kod</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kategoria</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ustaw Godzinę</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sortedEvents.map((event) => (
                                    <tr key={event.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatTime(event.startTime)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{event.name}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{event.code}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{genderLabel(event.gender)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <div className="flex items-center justify-end gap-2">
                                                <Input
                                                    type="datetime-local"
                                                    className="w-48 h-8 text-xs"
                                                    value={editingTimes[event.id] || ''}
                                                    onChange={(e) => handleTimeChange(event.id, e.target.value)}
                                                />
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8"
                                                    onClick={() => handleSave(event.id)}
                                                    disabled={!editingTimes[event.id] || updateMutation.isPending}
                                                >
                                                    <Save className="h-4 w-4" />
                                                </Button>
                                            </div>
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
