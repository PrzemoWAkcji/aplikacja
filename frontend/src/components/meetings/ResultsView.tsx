'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Trophy, Upload, RefreshCcw, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface Result {
    id: string;
    place: number;
    time: string;
    wind?: number;
    status: string;
    entry: {
        athleteName: string;
        bib: string;
        heat: number;
        lane: number;
    };
}

interface ResultsViewProps {
    meetingId: string;
    eventId: string | null;
    eventName?: string;
}

export default function ResultsView({ meetingId, eventId, eventName }: ResultsViewProps) {
    const queryClient = useQueryClient();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isLive, setIsLive] = useState(false);

    // Socket.io Connection
    useEffect(() => {
        const newSocket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');
        setSocket(newSocket);

        newSocket.on('connect', () => {
            setIsLive(true);
            if (eventId) {
                newSocket.emit('joinEvent', eventId);
            }
        });

        newSocket.on('resultsUpdated', (data) => {
            console.log('Results updated via WebSocket:', data);
            queryClient.invalidateQueries({ queryKey: ['results', eventId] });
        });

        newSocket.on('disconnect', () => setIsLive(false));

        return () => {
            newSocket.disconnect();
        };
    }, [eventId, queryClient]);

    const { data: results, isLoading } = useQuery<Result[]>({
        queryKey: ['results', eventId],
        queryFn: async () => {
            const response = await api.get(`/results?eventId=${eventId}`);
            return response.data;
        },
        enabled: !!eventId,
    });

    const importLifMutation = useMutation({
        mutationFn: async (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return api.post(`/results/import/lif/${eventId}`, formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['results', eventId] });
            alert('Wyniki z pliku LIF zostały zaimportowane.');
        },
        onError: () => {
            alert('Błąd podczas importu pliku LIF.');
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            importLifMutation.mutate(file);
        }
    };

    if (!eventId) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Trophy className="h-12 w-12 mb-4 opacity-20" />
                <p>Wybierz konkurencję z listy, aby zobaczyć wyniki.</p>
            </div>
        );
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Wyniki: {eventName}
                    {isLive && (
                        <span className="flex items-center gap-1 text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full animate-pulse uppercase font-bold ml-2">
                            <Wifi className="h-3 w-3" />
                            Live
                        </span>
                    )}
                </CardTitle>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['results', eventId] })}>
                        <RefreshCcw className="h-4 w-4 mr-2" />
                        Odśwież
                    </Button>
                    <div className="relative">
                        <Button size="sm" onClick={() => document.getElementById('lif-upload')?.click()} disabled={importLifMutation.isPending}>
                            <Upload className="h-4 w-4 mr-2" />
                            Importuj LIF
                        </Button>
                        <input
                            id="lif-upload"
                            type="file"
                            accept=".lif"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="py-8 text-center">Ładowanie wyników...</div>
                ) : results?.length === 0 ? (
                    <div className="py-8 text-center text-gray-500">Brak wyników dla tej konkurencji. Zaimportuj plik LIF.</div>
                ) : (
                    <div className="rounded-md border">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">M-ce</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bib</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Zawodnik</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seria/Tor</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wynik</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wiatr</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {results?.sort((a, b) => (a.place || 999) - (b.place || 999)).map((result) => (
                                    <tr key={result.id} className={result.place === 1 ? 'bg-yellow-50/30' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{result.place || '-'}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.entry.bib}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{result.entry.athleteName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">S{result.entry.heat} / T{result.entry.lane}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{result.time}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.wind ? (result.wind > 0 ? `+${result.wind}` : result.wind) : '-'}</td>
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
