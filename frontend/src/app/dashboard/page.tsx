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
    endDate?: string;
    location: string;
    city?: string;
    country?: string;
    season: 'STADIUM' | 'INDOOR';
    status: 'DRAFT' | 'SCHEDULED' | 'OPEN' | 'FINISHED' | 'CANCELLED';
    organizerId: string;
}

export default function DashboardPage() {
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const _hasHydrated = useAuthStore((state) => state._hasHydrated);

    useEffect(() => {
        if (_hasHydrated && !token) {
            router.push('/login');
        }
    }, [_hasHydrated, token, router]);

    const { data: meetings, isLoading, error } = useQuery<Meeting[]>({
        queryKey: ['meetings'],
        queryFn: async () => {
            const response = await api.get('/meetings');
            return response.data;
        },
        enabled: !!token,
    });

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'DRAFT': return 'Robocze';
            case 'SCHEDULED': return 'Zaplanowane';
            case 'OPEN': return 'Live';
            case 'FINISHED': return 'Zakończone';
            default: return status;
        }
    };

    if (!token) return null;

    return (
        <div className="min-h-screen bg-[#f8fafc] p-6 lg:p-12">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="space-y-1">
                        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Twoje Zawody</h1>
                        <p className="text-slate-500 font-medium">Zarządzaj wydarzeniami i systemem pomiaru czasu</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Link href="/meetings/create">
                            <Button className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 gap-2 h-12 px-8 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95">
                                <Plus className="h-5 w-5" />
                                Nowe Zawody
                            </Button>
                        </Link>
                        <Button
                            variant="ghost"
                            className="h-12 w-12 rounded-2xl border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all p-0 flex items-center justify-center"
                            onClick={() => {
                                useAuthStore.getState().logout();
                                router.push('/login');
                            }}
                            title="Wyloguj"
                        >
                            <span className="sr-only">Wyloguj</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        </Button>
                    </div>
                </div>

                {isLoading && (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-48 bg-slate-100 rounded-3xl animate-pulse"></div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="p-8 bg-red-50 rounded-3xl border border-red-100 text-center">
                        <p className="text-red-600 font-bold">Błąd podczas pobierania zawodów.</p>
                    </div>
                )}

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {meetings?.map((meeting) => (
                        <Card key={meeting.id} className="group border-0 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] transition-all duration-500 rounded-3xl overflow-hidden bg-white">
                            <CardHeader className="pb-4">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${meeting.season === 'STADIUM' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                                        }`}>
                                        {meeting.season === 'STADIUM' ? 'Stadion' : 'Hala'}
                                    </span>
                                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${meeting.status === 'OPEN' ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        {getStatusLabel(meeting.status)}
                                    </span>
                                </div>
                                <CardTitle className="text-xl font-black text-slate-900 group-hover:text-blue-600 transition-colors leading-tight">{meeting.name}</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 pb-0">
                                <div className="space-y-2">
                                    <div className="flex items-center text-slate-500 font-bold text-xs gap-3">
                                        <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-blue-500">
                                            <Calendar className="h-4 w-4" />
                                        </div>
                                        <span>
                                            {new Date(meeting.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
                                            {meeting.endDate && meeting.endDate !== meeting.date && ` - ${new Date(meeting.endDate).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}`}
                                        </span>
                                    </div>
                                    <div className="flex items-center text-slate-500 font-bold text-xs gap-3">
                                        <div className="h-8 w-8 rounded-xl bg-slate-50 flex items-center justify-center text-red-500">
                                            <MapPin className="h-4 w-4" />
                                        </div>
                                        <span className="truncate">{meeting.city || meeting.location}</span>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="pt-6">
                                <Link href={`/meetings/${meeting.id}`} className="w-full">
                                    <Button className="w-full h-11 bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-600 border-0 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">
                                        Zarządzaj Zawodami
                                    </Button>
                                </Link>
                            </CardFooter>
                        </Card>
                    ))}

                    {meetings?.length === 0 && !isLoading && (
                        <div className="col-span-full py-20 bg-white rounded-[2rem] border-4 border-dashed border-slate-100 flex flex-col items-center justify-center text-center px-6">
                            <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                <Plus className="h-10 w-10 text-slate-200" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 mb-2">Brak aktywnych zawodów</h3>
                            <p className="text-slate-400 text-sm font-medium max-w-xs mx-auto mb-8">Rozpocznij tworząc swoje pierwsze wydarzenie sportowe w systemie.</p>
                            <Link href="/meetings/create">
                                <Button className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-200 h-12 px-10 rounded-2xl font-black uppercase text-xs tracking-widest transition-all">
                                    Utwórz pierwsze zawody
                                </Button>
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
