'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Users } from 'lucide-react';

interface Entry {
    id: string;
    athleteName: string;
    status: string;
    bib?: string;
    heat?: number;
    lane?: number;
}

interface EntriesTableProps {
    selectedEventId: string | null;
    eventName?: string;
}

export default function EntriesTable({ selectedEventId, eventName }: EntriesTableProps) {
    const queryClient = useQueryClient();

    const { data: entries } = useQuery<Entry[]>({
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

    const generateStartListMutation = useMutation({
        mutationFn: async ({ eventId, lanesPerHeat = 8 }: { eventId: string; lanesPerHeat?: number }) => {
            return api.post(`/events/${eventId}/start-list`, { lanesPerHeat });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['entries', selectedEventId] });
            alert('Lista startowa została wygenerowana.');
        },
        onError: () => {
            alert('Wystąpił błąd podczas generowania listy startowej.');
        }
    });

    const statusBadge = (status: string) => {
        const colors = status === 'CONFIRMED'
            ? 'bg-green-100 text-green-800'
            : status === 'SCRATCHED'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800';
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
                {status}
            </span>
        );
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>
                    {selectedEventId ? `Zgłoszenia: ${eventName}` : 'Zgłoszenia'}
                </CardTitle>
                {selectedEventId && (
                    <Button
                        size="sm"
                        onClick={() => generateStartListMutation.mutate({ eventId: selectedEventId })}
                        disabled={generateStartListMutation.isPending}
                    >
                        Generuj Listę Startową
                    </Button>
                )}
            </CardHeader>
            <CardContent>
                {!selectedEventId ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <Users className="h-12 w-12 mb-4 opacity-20" />
                        <p>Wybierz konkurencję z listy, aby zobaczyć zgłoszenia.</p>
                    </div>
                ) : entries?.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Brak zgłoszeń dla tej konkurencji.</p>
                ) : (
                    <div className="rounded-md border">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seria / Tor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zawodnik</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nr Bib</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Akcje</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {entries?.map((entry) => (
                                    <tr key={entry.id}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {entry.heat ? `S${entry.heat} / T${entry.lane}` : '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{entry.athleteName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.bib || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{statusBadge(entry.status)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => deleteMutation.mutate(entry.id)}
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
            </CardContent>
        </Card>
    );
}
