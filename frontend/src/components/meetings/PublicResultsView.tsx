'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Trophy, Wifi, Clock } from 'lucide-react';
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

interface PublicResultsViewProps {
    eventId: string | null;
    eventName?: string;
}

export default function PublicResultsView({ eventId, eventName }: PublicResultsViewProps) {
    const [isLive, setIsLive] = useState(false);

    const { data: results, isLoading, refetch } = useQuery<Result[]>({
        queryKey: ['public-results', eventId],
        queryFn: async () => {
            const response = await api.get(`/results?eventId=${eventId}`);
            return response.data;
        },
        enabled: !!eventId,
    });

    // Socket.io for Live Updates
    useEffect(() => {
        if (!eventId) return;

        const socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000');

        socket.on('connect', () => {
            setIsLive(true);
            socket.emit('joinEvent', eventId);
        });

        socket.on('resultsUpdated', () => {
            refetch();
        });

        socket.on('disconnect', () => setIsLive(false));

        return () => {
            socket.disconnect();
        };
    }, [eventId, refetch]);

    if (!eventId) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <Trophy className="h-16 w-16 mb-4 opacity-10" />
                <p className="text-lg">Wybierz konkurencję, aby zobaczyć wyniki na żywo</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                    {eventName}
                </h2>
                {isLive && (
                    <span className="flex items-center gap-1.5 text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full animate-pulse uppercase font-bold tracking-wider border border-green-200">
                        <Wifi className="h-3 w-3" />
                        Live Results
                    </span>
                )}
            </div>

            <Card className="overflow-hidden border-none shadow-xl bg-white/80 backdrop-blur-md">
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="py-20 text-center animate-pulse">Ładowanie wyników...</div>
                    ) : results?.length === 0 ? (
                        <div className="py-20 text-center text-gray-500 bg-slate-50/50">
                            <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                            Oczekiwanie na wyniki...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50/50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Miejsce</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Nr</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Zawodnik</th>
                                        <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Seria/Tor</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Wynik</th>
                                        <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Wiatr</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-transparent divide-y divide-slate-100">
                                    {results?.sort((a, b) => (a.place || 999) - (b.place || 999)).map((result, idx) => (
                                        <tr
                                            key={result.id}
                                            className={`transition-colors hover:bg-slate-50/50 ${result.place === 1 ? 'bg-yellow-50/50' : ''}`}
                                        >
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className={`flex items-center justify-center h-8 w-8 rounded-full font-bold text-sm ${result.place === 1 ? 'bg-yellow-400 text-yellow-900 shadow-sm' :
                                                        result.place === 2 ? 'bg-slate-300 text-slate-800' :
                                                            result.place === 3 ? 'bg-orange-300 text-orange-900' :
                                                                'text-slate-500'
                                                    }`}>
                                                    {result.place || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 font-mono">{result.entry.bib}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-slate-900">{result.entry.athleteName}</div>
                                                <div className="text-[10px] text-slate-400 uppercase tracking-tighter">Poland</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-center">
                                                <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">S{result.entry.heat}</span>
                                                <span className="mx-1 text-slate-300">|</span>
                                                <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-bold">T{result.entry.lane}</span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-base font-black text-blue-600 font-mono tracking-tight">
                                                {result.time}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-400 italic">
                                                {result.wind ? (result.wind > 0 ? `+${result.wind.toFixed(1)}` : result.wind.toFixed(1)) : ''}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
