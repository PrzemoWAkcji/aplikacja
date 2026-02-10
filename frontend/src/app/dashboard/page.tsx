'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import Link from 'next/link';
import { Plus, Calendar, MapPin } from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface Meeting {
    id: string;
    name: string;
    date: string;
    location: string;
    organizerId: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);

    useEffect(() => {
        if (!token) {
            router.push('/login');
        }
    }, [token, router]);

    const { data: meetings, isLoading, error } = useQuery<Meeting[]>({
        queryKey: ['meetings'],
        queryFn: async () => {
            const response = await api.get('/meetings');
            return response.data;
        },
        enabled: !!token,
    });

    if (!token) return null;

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Twoje Zawody</h1>
                    <Link href="/meetings/create">
                        <Button className="gap-2">
                            <Plus className="h-4 w-4" />
                            Nowe Zawody
                        </Button>
                    </Link>
                </div>

                {isLoading && <p className="text-center text-gray-500">Ładowanie zawodów...</p>}
                {error && <p className="text-center text-red-500">Błąd podczas pobierania zawodów.</p>}

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {meetings?.map((meeting) => (
                        <Card key={meeting.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader>
                                <CardTitle>{meeting.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <div className="flex items-center text-gray-500">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <span className="text-sm">
                                        {new Date(meeting.date).toLocaleDateString('pl-PL')}
                                    </span>
                                </div>
                                <div className="flex items-center text-gray-500">
                                    <MapPin className="h-4 w-4 mr-2" />
                                    <span className="text-sm">{meeting.location}</span>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Link href={`/meetings/${meeting.id}`} className="w-full">
                                    <Button variant="outline" className="w-full">
                                        Szczegóły
                                    </Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    ))}

                    {meetings?.length === 0 && (
                        <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                            <p className="text-gray-500 mb-4">Nie masz jeszcze żadnych zawodów.</p>
                            <Link href="/meetings/create">
                                <Button variant="outline">Utwórz pierwsze zawody</Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
