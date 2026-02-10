'use client';

import { useQuery } from '@tanstack/react-query';
import api from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '../../../store/auth-store';
import { useState } from 'react';
import { ExternalLink, List, Calendar } from 'lucide-react';
import Link from 'next/link';
import EventsList from '../../../components/meetings/EventsList';
import EntriesTable from '../../../components/meetings/EntriesTable';
import ScheduleView from '../../../components/meetings/ScheduleView';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
    startTime?: string;
}

interface Meeting {
    id: string;
    name: string;
    date: string;
    location: string;
    events: Event[];
}

type Tab = 'entries' | 'schedule';

export default function MeetingDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('entries');

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

    if (isLoading) return <div className="p-8 text-center">Ładowanie...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Błąd pobierania danych</div>;
    if (!meeting) return <div className="p-8 text-center">Nie znaleziono zawodów</div>;

    const selectedEventName = meeting.events.find(e => e.id === selectedEventId)?.name;

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
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

                {/* Tabs */}
                <div className="flex gap-2 border-b pb-2">
                    <button
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${activeTab === 'entries' ? 'bg-white border border-b-0 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('entries')}
                    >
                        <List className="h-4 w-4" />
                        Zgłoszenia
                    </button>
                    <button
                        className={`flex items-center gap-2 px-4 py-2 rounded-t-md text-sm font-medium transition-colors ${activeTab === 'schedule' ? 'bg-white border border-b-0 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setActiveTab('schedule')}
                    >
                        <Calendar className="h-4 w-4" />
                        Program
                    </button>
                </div>

                {/* Tab Content */}
                {activeTab === 'entries' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="col-span-1">
                            <EventsList
                                meetingId={meeting.id}
                                events={meeting.events}
                                selectedEventId={selectedEventId}
                                onSelectEvent={setSelectedEventId}
                            />
                        </div>
                        <div className="col-span-2">
                            <EntriesTable
                                selectedEventId={selectedEventId}
                                eventName={selectedEventName}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'schedule' && (
                    <ScheduleView meetingId={meeting.id} events={meeting.events} />
                )}
            </div>
        </div>
    );
}
