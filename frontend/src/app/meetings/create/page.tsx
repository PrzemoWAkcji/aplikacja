'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { useAuthStore } from '../../../store/auth-store';
import { Trophy, Calendar, MapPin, Globe, Activity, Clock, ShieldCheck } from 'lucide-react';
import { TimePicker } from '../../../components/ui/time-picker';
import { DatePicker } from '../../../components/ui/date-picker';

interface StarterMeetingOption {
    id: string;
    name: string;
    location: string;
    dateLabel: string;
    label: string;
}

function pad2(value: number): string {
    return value < 10 ? `0${value}` : `${value}`;
}

function toIsoDate(day: number, month: number, year: number): string {
    return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseFullPolishDate(value: string): string | null {
    const match = value.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return toIsoDate(day, month, year);
}

function parseDateRangeFromLabel(dateLabel: string): { startDate?: string; endDate?: string } {
    const label = (dateLabel || '')
        .replace(/\u00A0/g, ' ')
        .replace(/[–—]/g, '-')
        .trim();
    if (!label) return {};

    const fullDateMatches = [...label.matchAll(/\b\d{1,2}[./-]\d{1,2}[./-]\d{4}\b/g)]
        .map((m) => parseFullPolishDate(m[0]))
        .filter((v): v is string => !!v);

    if (fullDateMatches.length >= 2) {
        return {
            startDate: fullDateMatches[0],
            endDate: fullDateMatches[fullDateMatches.length - 1],
        };
    }

    if (fullDateMatches.length === 1) {
        const endDate = fullDateMatches[0];
        const year = parseInt(endDate.slice(0, 4), 10);
        const shortStart = label.match(/\b(\d{1,2})[./-](\d{1,2})\b\s*-/);

        if (shortStart) {
            const day = parseInt(shortStart[1], 10);
            const month = parseInt(shortStart[2], 10);
            if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
                return {
                    startDate: toIsoDate(day, month, year),
                    endDate,
                };
            }
        }

        return { startDate: endDate, endDate };
    }

    return {};
}

function parseDateRangeFromMeeting(meeting: StarterMeetingOption): { startDate?: string; endDate?: string } {
    const candidates = [
        meeting.dateLabel || '',
        meeting.label || '',
        `${meeting.location || ''} ${meeting.dateLabel || ''}`.trim(),
    ];

    for (const candidate of candidates) {
        const parsed = parseDateRangeFromLabel(candidate);
        if (parsed.startDate || parsed.endDate) {
            return parsed;
        }
    }

    return {};
}

function inferSeasonFromMeetingName(name: string): 'INDOOR' | 'STADIUM' {
    const normalized = (name || '').toLowerCase();
    if (normalized.includes('halow') || normalized.includes('indoor')) {
        return 'INDOOR';
    }
    return 'STADIUM';
}

function inferCityFromLocation(location: string): string {
    const raw = (location || '').trim();
    if (!raw) return '';
    return raw.split(',')[0].trim();
}

export default function CreateMeetingPage() {
    const [formData, setFormData] = useState({
        name: '',
        startDate: '',
        startTime: '10:00',
        endDate: '',
        endTime: '18:00',
        location: '',
        city: '',
        country: 'POL',
        domtelMeetingCode: '',
        season: 'STADIUM',
        type: 'REGIONAL',
        status: 'DRAFT'
    });
    const [showStarterImport, setShowStarterImport] = useState(false);
    const [starterEmail, setStarterEmail] = useState('');
    const [starterMeetings, setStarterMeetings] = useState<StarterMeetingOption[]>([]);
    const [selectedStarterMeetingId, setSelectedStarterMeetingId] = useState('');
    const [isLoadingStarterMeetings, setIsLoadingStarterMeetings] = useState(false);
    const [isImportingStarter, setIsImportingStarter] = useState(false);
    const [starterError, setStarterError] = useState('');
    const [autoImportStarterEntries, setAutoImportStarterEntries] = useState(true);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const token = useAuthStore((state) => state.token);
    const _hasHydrated = useAuthStore((state) => state._hasHydrated);

    useEffect(() => {
        if (_hasHydrated && !token) {
            router.push('/login');
        }
    }, [_hasHydrated, token, router]);

    const fetchStarterMeetings = async () => {
        if (!starterEmail.trim()) {
            setStarterError('Podaj adres email używany w Starter PZLA.');
            return;
        }

        setStarterError('');
        setStarterMeetings([]);
        setIsLoadingStarterMeetings(true);
        try {
            const response = await api.get('/file-mapping/starter/meetings', {
                params: { email: starterEmail.trim() }
            });
            const meetings = (response.data?.meetings || []) as StarterMeetingOption[];
            setStarterMeetings(meetings);

            if (meetings.length === 0) {
                setStarterError('Nie znaleziono imprez dla podanego adresu email.');
                return;
            }

            setSelectedStarterMeetingId(meetings[0].id);
        } catch (err: any) {
            const msg = err?.response?.data?.message || '';
            if (msg.includes('Domtel') || msg.includes('ZawodyLA') || msg.includes('wersji 5')) {
                setStarterError('⚠️ Serwer Domtel zablokował dostęp dla starszych klientów. Wymagana jest aktualizacja programu ZawodyLA LIVE do wersji 5.01. Import ze Starter PZLA jest tymczasowo niedostępny.');
            } else {
                setStarterError('Nie udało się pobrać listy imprez ze Starter PZLA.');
            }
        } finally {
            setIsLoadingStarterMeetings(false);
        }
    };

    const applyStarterMeetingToForm = () => {
        const selected = starterMeetings.find((m) => m.id === selectedStarterMeetingId);
        if (!selected) {
            alert('Wybierz impreze ze Starter.');
            return;
        }

        const { startDate, endDate } = parseDateRangeFromMeeting(selected);
        const location = (selected.location || '').trim();
        const inferredCity = inferCityFromLocation(location);
        const season = inferSeasonFromMeetingName(selected.name);

        setFormData((prev) => ({
            ...prev,
            name: selected.name || prev.name,
            location: location || prev.location,
            city: inferredCity || prev.city,
            startDate: startDate || prev.startDate,
            endDate: endDate || prev.endDate || startDate || prev.startDate,
            season,
        }));
    };

    if (!token) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Combine date and time
            const fullStartDate = formData.startDate ? new Date(`${formData.startDate}T${formData.startTime}:00`) : null;
            const fullEndDate = formData.endDate ? new Date(`${formData.endDate}T${formData.endTime}:00`) : null;

            if (!fullStartDate || isNaN(fullStartDate.getTime())) {
                throw new Error('Proszę podać poprawną datę rozpoczęcia.');
            }

            const { startDate, startTime, endDate, endTime, ...rest } = formData;

            const createResponse = await api.post('/meetings', {
                ...rest,
                date: fullStartDate.toISOString(),
                endDate: fullEndDate && !isNaN(fullEndDate.getTime()) ? fullEndDate.toISOString() : undefined,
            });
            const createdMeetingId = createResponse?.data?.id as string | undefined;

            if (
                createdMeetingId &&
                autoImportStarterEntries &&
                selectedStarterMeetingId.trim()
            ) {
                setIsImportingStarter(true);
                try {
                    const importResponse = await api.post(`/file-mapping/starter/import/${createdMeetingId}`, {
                        externalMeetingId: selectedStarterMeetingId.trim(),
                    });
                    const importedCount = importResponse?.data?.count ?? 0;
                    alert(`Utworzono zawody i zaimportowano ${importedCount} zgloszen ze Starter.`);
                } catch {
                    alert('Zawody utworzone, ale import Starter nie udal sie. Mozesz uruchomic import z poziomu Ustawien i Narzedzi.');
                } finally {
                    setIsImportingStarter(false);
                }
            }

            router.push(createdMeetingId ? `/meetings/${createdMeetingId}` : '/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.message || err.message || 'Nie udało się utworzyć zawodów');
        } finally {
            setLoading(false);
            setIsImportingStarter(false);
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
                        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">
                                    Starter PZLA (Opcjonalnie)
                                </h3>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="h-8 px-3 text-[11px] font-bold border-slate-200"
                                    onClick={() => setShowStarterImport((v) => !v)}
                                >
                                    {showStarterImport ? 'Ukryj' : 'Polacz i wypelnij'}
                                </Button>
                            </div>

                            {showStarterImport && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                                        <Input
                                            value={starterEmail}
                                            onChange={(e) => setStarterEmail(e.target.value)}
                                            placeholder="Email konta Starter"
                                            className="h-10 border-slate-200 md:col-span-2"
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="h-10 border-slate-200 font-bold"
                                            onClick={fetchStarterMeetings}
                                            disabled={isLoadingStarterMeetings}
                                        >
                                            {isLoadingStarterMeetings ? 'Pobieranie...' : 'Pobierz imprezy'}
                                        </Button>
                                    </div>

                                    {starterError && (
                                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                                            {starterError}
                                        </div>
                                    )}

                                    {starterMeetings.length > 0 && (
                                        <div className="space-y-2">
                                            <select
                                                className="w-full h-10 border border-slate-200 rounded-xl px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
                                                value={selectedStarterMeetingId}
                                                onChange={(e) => setSelectedStarterMeetingId(e.target.value)}
                                            >
                                                {starterMeetings.map((meeting) => (
                                                    <option key={meeting.id} value={meeting.id}>
                                                        {meeting.label}
                                                    </option>
                                                ))}
                                            </select>

                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-9 border-slate-200 font-bold"
                                                    onClick={applyStarterMeetingToForm}
                                                >
                                                    Wypelnij formularz danymi imprezy
                                                </Button>
                                                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                                    <input
                                                        type="checkbox"
                                                        checked={autoImportStarterEntries}
                                                        onChange={(e) => setAutoImportStarterEntries(e.target.checked)}
                                                    />
                                                    Po utworzeniu od razu importuj zgloszenia
                                                </label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

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
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Domtel Online (opcjonalnie)</label>
                                    <Input
                                        value={formData.domtelMeetingCode}
                                        onChange={(e) => setFormData({ ...formData, domtelMeetingCode: e.target.value })}
                                        placeholder="Kod imprezy (np. p98a) lub pełny URL z online.domtel-sport.pl"
                                        className="h-11 border-slate-200 focus:ring-blue-500 rounded-xl"
                                    />
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
                                    <div className="grid grid-cols-2 gap-2">
                                        <DatePicker
                                            value={formData.startDate}
                                            onChange={(val) => setFormData({ ...formData, startDate: val })}
                                            placeholder="Data startu"
                                            required
                                        />
                                        <TimePicker
                                            value={formData.startTime}
                                            onChange={(val: string) => setFormData({ ...formData, startTime: val })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Koniec zawodów</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <DatePicker
                                            value={formData.endDate}
                                            onChange={(val) => setFormData({ ...formData, endDate: val })}
                                            placeholder="Data końca"
                                        />
                                        <TimePicker
                                            value={formData.endTime}
                                            onChange={(val: string) => setFormData({ ...formData, endTime: val })}
                                        />
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
                                disabled={loading || isImportingStarter}
                                className="h-12 px-10 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-200 transition-all active:scale-95"
                            >
                                {loading || isImportingStarter ? 'Przetwarzanie...' : 'Zapisz i kontynuuj'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
