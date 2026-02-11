'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useState } from 'react';
import { Plus, Trash2, FileText, ClipboardList } from 'lucide-react';
import { printBatch } from '../../lib/printUtils';

interface Event {
    id: string;
    name: string;
    code: string;
    gender: string;
}

interface EventsListProps {
    meetingId: string;
    events: Event[];
    selectedEventId: string | null;
    onSelectEvent: (id: string) => void;
}

export default function EventsList({ meetingId, events, selectedEventId, onSelectEvent }: EventsListProps) {
    const queryClient = useQueryClient();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [newEvent, setNewEvent] = useState({
        name: '',
        code: '',
        gender: 'M',
        eventCode: '',
        ageGroup: '',
        stage: 'Final',
        heights: ''
    });

    const createMutation = useMutation({
        mutationFn: async (eventData: any) => {
            return api.post('/events', { ...eventData, meetingId });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
            setIsFormOpen(false);
            setNewEvent({ name: '', code: '', gender: 'M', eventCode: '', ageGroup: '', stage: 'Final', heights: '' });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (eventId: string) => {
            return api.delete(`/events/${eventId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
        },
    });

    const deleteAllMutation = useMutation({
        mutationFn: async () => {
            return api.delete(`/meetings/${meetingId}/events`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
            alert('Wszystkie konkurencje zostały usunięte.');
        },
        onError: () => {
            alert('Wystąpił błąd podczas usuwania. Sprawdź, czy masz uprawnienia.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate(newEvent);
    };

    return (
        <Card>
            <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Konkurencje</CardTitle>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printBatch(meetingId, 'START_LIST')}
                    >
                        <FileText className="h-4 w-4 mr-2" />
                        Wszystkie Listy
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => printBatch(meetingId, 'PROTOCOL')}
                    >
                        <ClipboardList className="h-4 w-4 mr-2" />
                        Wszystkie Protokoły
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('federation-import')?.click()}>
                        Import CSV (Federacja)
                    </Button>
                    <input
                        id="federation-import"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const formData = new FormData();
                            formData.append('file', file);

                            try {
                                await api.post(`/file-mapping/import/federation/${meetingId}`, formData);
                                queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
                                alert('Zgłoszenia zostały zaimportowane.');
                            } catch (error) {
                                alert('Błąd podczas importu zgłoszeń.');
                            }
                        }}
                    />

                    {/* Roster Athletics Import/Export */}
                    <Button variant="outline" size="sm" onClick={() => document.getElementById('roster-entries-import')?.click()}>
                        Import Roster (Zgłoszenia)
                    </Button>
                    <input
                        id="roster-entries-import"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const formData = new FormData();
                            formData.append('file', file);

                            try {
                                await api.post(`/roster/import/entries/${meetingId}`, formData);
                                queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
                                alert('Zgłoszenia Roster zostały zaimportowane.');
                            } catch (error) {
                                alert('Błąd podczas importu zgłoszeń Roster.');
                            }
                            e.target.value = '';
                        }}
                    />

                    <Button variant="outline" size="sm" onClick={() => document.getElementById('roster-results-import')?.click()}>
                        Import Roster (Wyniki)
                    </Button>
                    <input
                        id="roster-results-import"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;

                            const formData = new FormData();
                            formData.append('file', file);

                            try {
                                await api.post(`/roster/import/results/${meetingId}`, formData);
                                queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
                                alert('Wyniki Roster zostały zaimportowane.');
                            } catch (error) {
                                alert('Błąd podczas importu wyników Roster.');
                            }
                            e.target.value = '';
                        }}
                    />

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            try {
                                const response = await api.get(`/roster/export/entries/${meetingId}`, {
                                    responseType: 'blob'
                                });
                                const url = window.URL.createObjectURL(new Blob([response.data]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', `roster-entries-${meetingId}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                            } catch (error) {
                                alert('Błąd podczas eksportu zgłoszeń Roster.');
                            }
                        }}
                    >
                        Eksport Roster (Zgłoszenia)
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            try {
                                const response = await api.get(`/roster/export/results/${meetingId}`, {
                                    responseType: 'blob'
                                });
                                const url = window.URL.createObjectURL(new Blob([response.data]));
                                const link = document.createElement('a');
                                link.href = url;
                                link.setAttribute('download', `roster-results-${meetingId}.csv`);
                                document.body.appendChild(link);
                                link.click();
                                link.remove();
                            } catch (error) {
                                alert('Błąd podczas eksportu wyników Roster.');
                            }
                        }}
                    >
                        Eksport Roster (Wyniki)
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        onClick={() => {
                            if (confirm('UWAGA! Czy na pewno usunąć WSZYSTKIE konkurencje i zgłoszenia? Tej operacji nie można cofnąć.')) {
                                deleteAllMutation.mutate();
                            }
                        }}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Wyczyść
                    </Button>
                    <Button size="icon" onClick={() => setIsFormOpen(!isFormOpen)}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {isFormOpen && (
                    <div className="mb-6 p-4 border rounded-md bg-slate-50">
                        <h4 className="font-medium mb-3">Nowa konkurencja</h4>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <Input
                                placeholder="Nazwa (np. 100 metrów)"
                                value={newEvent.name}
                                onChange={(e) => {
                                    const name = e.target.value;
                                    // Auto-generate eventCode from name
                                    let autoEventCode = '';
                                    const nameLower = name.toLowerCase();

                                    // Track events
                                    if (nameLower.includes('60') && nameLower.includes('przez')) autoEventCode = '60H';
                                    else if (nameLower.includes('100') && nameLower.includes('przez')) autoEventCode = '100H';
                                    else if (nameLower.includes('110') && nameLower.includes('przez')) autoEventCode = '110H';
                                    else if (nameLower.includes('400') && nameLower.includes('przez')) autoEventCode = '400H';
                                    else if (nameLower.includes('60')) autoEventCode = '60';
                                    else if (nameLower.includes('100')) autoEventCode = '100';
                                    else if (nameLower.includes('200')) autoEventCode = '200';
                                    else if (nameLower.includes('400')) autoEventCode = '400';
                                    else if (nameLower.includes('800')) autoEventCode = '800';
                                    else if (nameLower.includes('1500')) autoEventCode = '1500';
                                    else if (nameLower.includes('3000')) autoEventCode = '3000';
                                    else if (nameLower.includes('5000')) autoEventCode = '5000';
                                    else if (nameLower.includes('10000') || nameLower.includes('10 000')) autoEventCode = '10000';

                                    // Field events
                                    else if (nameLower.includes('wzwyż')) autoEventCode = 'HJ';
                                    else if (nameLower.includes('tyczce') || nameLower.includes('tyczka')) autoEventCode = 'PV';
                                    else if (nameLower.includes('dal')) autoEventCode = 'LJ';
                                    else if (nameLower.includes('trójskok')) autoEventCode = 'TJ';
                                    else if (nameLower.includes('kula')) autoEventCode = 'SP';
                                    else if (nameLower.includes('dysk')) autoEventCode = 'DT';
                                    else if (nameLower.includes('oszczep')) autoEventCode = 'JT';
                                    else if (nameLower.includes('młot')) autoEventCode = 'HT';

                                    // Relays
                                    else if (nameLower.includes('4') && nameLower.includes('100')) autoEventCode = '4x100';
                                    else if (nameLower.includes('4') && nameLower.includes('400')) autoEventCode = '4x400';

                                    setNewEvent({ ...newEvent, name, eventCode: autoEventCode });
                                }}
                                required
                            />
                            <Input
                                placeholder="Kod (np. 100M)"
                                value={newEvent.code}
                                onChange={(e) => setNewEvent({ ...newEvent, code: e.target.value })}
                                required
                            />
                            <Input
                                placeholder="Kod Roster (np. 100, HJ, SP) - auto-generowany"
                                value={newEvent.eventCode}
                                onChange={(e) => setNewEvent({ ...newEvent, eventCode: e.target.value })}
                            />
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-background px-3 py-2 text-sm"
                                value={newEvent.gender}
                                onChange={(e) => setNewEvent({ ...newEvent, gender: e.target.value })}
                            >
                                <option value="M">Mężczyźni</option>
                                <option value="K">Kobiety</option>
                                <option value="MIX">Mix</option>
                            </select>
                            <Input
                                placeholder="Grupa wiekowa (np. U18, Senior) - opcjonalne"
                                value={newEvent.ageGroup}
                                onChange={(e) => setNewEvent({ ...newEvent, ageGroup: e.target.value })}
                            />
                            <select
                                className="flex h-10 w-full rounded-md border border-slate-300 bg-background px-3 py-2 text-sm"
                                value={newEvent.stage}
                                onChange={(e) => setNewEvent({ ...newEvent, stage: e.target.value })}
                            >
                                <option value="Final">Finał</option>
                                <option value="Heat">Bieg</option>
                                <option value="Semi-Final">Półfinał</option>
                                <option value="Qualification">Kwalifikacje</option>
                            </select>

                            {/* Heights field - only for vertical jumps */}
                            {(newEvent.eventCode === 'HJ' || newEvent.eventCode === 'PV') && (
                                <div>
                                    <label className="text-sm text-gray-600 mb-1 block">
                                        Wysokości (oddzielone przecinkami, np. 1.40, 1.45, 1.50)
                                    </label>
                                    <Input
                                        placeholder="1.40, 1.45, 1.50, 1.55, 1.60"
                                        value={newEvent.heights}
                                        onChange={(e) => setNewEvent({ ...newEvent, heights: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Anuluj</Button>
                                <Button type="submit" size="sm" disabled={createMutation.isPending}>Dodaj</Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="space-y-2">
                    {events?.map((event) => (
                        <div
                            key={event.id}
                            className={`flex items-center justify-between p-3 border rounded-md cursor-pointer transition-colors ${selectedEventId === event.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'}`}
                            onClick={() => onSelectEvent(event.id)}
                        >
                            <div>
                                <span className="font-medium block">{event.name}</span>
                                <span className="text-xs text-gray-500">{event.code} | {event.gender}</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Czy na pewno usunąć tę konkurencję?')) {
                                        deleteMutation.mutate(event.id);
                                    }
                                }}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                    {(!events || events.length === 0) && (
                        <p className="text-gray-500 text-center py-4 text-sm">Brak konkurencji.</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
