'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { useAuthStore } from '../../../store/auth-store';
import { Trophy, Calendar, MapPin, Globe, Activity, Clock, ShieldCheck } from 'lucide-react';

export default function CreateMeetingPage() {
    const [formData, setFormData] = useState({
        name: '',
        date: '',
        endDate: '',
        location: '',
        city: '',
        country: 'POL',
        season: 'STADIUM',
        type: 'REGIONAL',
        status: 'DRAFT'
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const token = useAuthStore((state) => state.token);

    if (!token) {
        router.push('/login');
        return null;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await api.post('/meetings', {
                ...formData,
                date: new Date(formData.date).toISOString(),
                endDate: formData.endDate ? new Date(formData.endDate).toISOString() : undefined,
            });
            router.push('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Nie udało się utworzyć zawodów');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6 md:p-12 flex items-center justify-center">
            <Card className="w-full max-w-2xl shadow-xl border-0 rounded-3xl overflow-hidden">
                <CardHeader className="bg-white border-b border-slate-100 p-8">
                    <div className="flex items-center gap-4 mb-2">
                        <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                            <Trophy className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">Nowe Zawody</CardTitle>
                            <CardDescription className="text-slate-500 font-medium">Stwórz i skonfiguruj wydarzenie lekkoatletyczne</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-8 pb-10">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Podstawowe Informacje */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="h-3 w-3" /> Podstawowe Dane
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Pełna nazwa zawodów *</label>
                                    <Input
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="np. Memoriał Kamili Skolimowskiej"
                                        className="h-11 border-slate-200 focus:ring-blue-500 rounded-xl"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Sezon *</label>
                                    <select
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                        value={formData.season}
                                        onChange={(e) => setFormData({ ...formData, season: e.target.value })}
                                    >
                                        <option value="STADIUM">Stadion (Open-air)</option>
                                        <option value="INDOOR">Hala (Indoor)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Rodzaj zawodów *</label>
                                    <select
                                        className="w-full h-11 border border-slate-200 rounded-xl px-4 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                    >
                                        <option value="INTERNATIONAL">Międzynarodowe</option>
                                        <option value="NATIONAL">Krajowe</option>
                                        <option value="REGIONAL">Regionalne</option>
                                        <option value="SCHOOL">Szkolne / Akademickie</option>
                                        <option value="TRAINING">Trening / Sprawdzian</option>
                                        <option value="TEST">Zawody Testowe</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Czas i Status */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Clock className="h-3 w-3" /> Czas i Status
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide text-blue-600">Start zawodów *</label>
                                    <div className="relative">
                                        <Input
                                            type="datetime-local"
                                            value={formData.date}
                                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            className="h-11 border-slate-200 focus:ring-blue-500 rounded-xl pl-10"
                                            required
                                        />
                                        <Calendar className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Koniec zawodów</label>
                                    <div className="relative">
                                        <Input
                                            type="datetime-local"
                                            value={formData.endDate}
                                            onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                            className="h-11 border-slate-200 focus:ring-blue-500 rounded-xl pl-10"
                                        />
                                        <Clock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Status publikacji</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['DRAFT', 'SCHEDULED', 'OPEN'].map((status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, status })}
                                                className={`h-11 rounded-xl text-xs font-black uppercase transition-all ${formData.status === status
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                                    }`}
                                            >
                                                {status === 'DRAFT' ? 'Robocze' : status === 'SCHEDULED' ? 'Zaplanowane' : 'Otwarte'}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="mt-2 text-[10px] text-slate-400 font-medium">
                                        {formData.status === 'DRAFT' && "Status 'Robocze' oznacza, że zawody widzą tylko organizatorzy."}
                                        {formData.status === 'SCHEDULED' && "Status 'Zaplanowane' oznacza widoczność w kalendarzu bez wyników live."}
                                        {formData.status === 'OPEN' && "Status 'Otwarte' pozwala wszystkim na śledzenie wyników na żywo."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Lokalizacja */}
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <MapPin className="h-3 w-3" /> Lokalizacja Stadionu
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Nazwa Obiektu / Adres *</label>
                                    <div className="relative">
                                        <Input
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            placeholder="np. Stadion Śląski"
                                            className="h-11 border-slate-200 focus:ring-blue-500 rounded-xl pl-10"
                                            required
                                        />
                                        <ShieldCheck className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Miasto *</label>
                                    <Input
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                        placeholder="np. Chorzów"
                                        className="h-11 border-slate-200 focus:ring-blue-500 rounded-xl"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Kraj *</label>
                                    <div className="relative">
                                        <select
                                            className="w-full h-11 border border-slate-200 rounded-xl pl-10 pr-4 text-sm font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                            value={formData.country}
                                            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                        >
                                            <option value="POL">Polska</option>
                                            <option value="DEU">Niemcy</option>
                                            <option value="CZE">Czechy</option>
                                            <option value="SVK">Słowacja</option>
                                            <option value="GBR">Wielka Brytania</option>
                                            <option value="USA">USA</option>
                                        </select>
                                        <Globe className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                                <div className="h-6 w-6 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Activity className="h-3 w-3" />
                                </div>
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => router.back()}
                                className="h-12 px-6 font-bold text-slate-400 hover:text-slate-600"
                            >
                                Anuluj
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="h-12 px-10 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-200 transition-all active:scale-95"
                            >
                                {loading ? 'Przetwarzanie...' : 'Zapisz i kontynuuj'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
