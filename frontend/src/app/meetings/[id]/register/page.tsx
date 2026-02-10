'use client';

import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../../../lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

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

export default function PublicRegistrationPage() {
    const params = useParams();
    const router = useRouter();
    const [formData, setFormData] = useState({
        athleteName: '',
        eventId: '',
    });
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');

    const { data: meeting, isLoading } = useQuery<Meeting>({
        queryKey: ['meeting-public', params.id],
        queryFn: async () => {
            const response = await api.get(`/meetings/${params.id}`);
            return response.data;
        },
        enabled: !!params.id,
    });

    const registerMutation = useMutation({
        mutationFn: async (data: any) => {
            return api.post('/entries', data);
        },
        onSuccess: () => {
            setSubmitted(true);
            setFormData({ athleteName: '', eventId: '' });
        },
        onError: (err: any) => {
            setError(err.response?.data?.message || 'Wystąpił błąd podczas rejestracji.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!formData.eventId) {
            setError('Wybierz konkurencję.');
            return;
        }
        registerMutation.mutate({
            athleteName: formData.athleteName,
            eventId: formData.eventId,
        });
    };

    if (isLoading) return <div className="p-8 text-center">Ładowanie...</div>;
    if (!meeting) return <div className="p-8 text-center">Nie znaleziono zawodów</div>;

    if (submitted) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center">
                    <CardHeader>
                        <div className="mx-auto bg-green-100 p-3 rounded-full w-fit mb-4">
                            <CheckCircle2 className="h-8 w-8 text-green-600" />
                        </div>
                        <CardTitle>Rejestracja pomyślna!</CardTitle>
                        <CardDescription>
                            Twoje zgłoszenie zostało przyjęte.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={() => setSubmitted(false)} className="w-full">
                            Zgłoś kolejnego zawodnika
                        </Button>
                        <Button variant="outline" onClick={() => router.push('/')} className="w-full mt-2">
                            Wróć do strony głównej
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>{meeting.name}</CardTitle>
                    <CardDescription>
                        {new Date(meeting.date).toLocaleDateString()} | {meeting.location}
                    </CardDescription>
                    <h3 className="font-semibold mt-4">Formularz zgłoszeniowy</h3>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Imię i Nazwisko</label>
                            <Input
                                value={formData.athleteName}
                                onChange={(e) => setFormData({ ...formData, athleteName: e.target.value })}
                                placeholder="np. Jan Kowalski"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Konkurencja</label>
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={formData.eventId}
                                onChange={(e) => setFormData({ ...formData, eventId: e.target.value })}
                                required
                            >
                                <option value="">Wybierz konkurencję...</option>
                                {meeting.events.map((event) => (
                                    <option key={event.id} value={event.id}>
                                        {event.name} ({event.code}) - {event.gender}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {error && <p className="text-red-500 text-sm">{error}</p>}

                        <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
                            {registerMutation.isPending ? 'Wysyłanie...' : 'Zarejestruj się'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
