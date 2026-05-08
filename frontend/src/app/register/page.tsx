'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import Link from 'next/link';

type Role = 'ATHLETE' | 'COACH' | 'ORGANIZER';

const ROLES: { value: Role; label: string; icon: string; desc: string }[] = [
  {
    value: 'ATHLETE',
    label: 'Zawodnik',
    icon: '🏃',
    desc: 'Zgłaszaj się na zawody i śledź swoje wyniki',
  },
  {
    value: 'COACH',
    label: 'Trener',
    icon: '📋',
    desc: 'Zgłaszaj grupowo zawodników swojego klubu',
  },
  {
    value: 'ORGANIZER',
    label: 'Organizator',
    icon: '🏟️',
    desc: 'Twórz zawody i zarządzaj nimi',
  },
];

export default function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [role, setRole] = useState<Role | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    clubName: '',
    licenseNumber: '',
    phoneNumber: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleSelect = (r: Role) => {
    setRole(r);
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.passwordConfirm) {
      setError('Hasła nie są identyczne');
      return;
    }
    if (formData.password.length < 8) {
      setError('Hasło musi mieć co najmniej 8 znaków');
      return;
    }

    setLoading(true);
    try {
      const payload: Record<string, string> = {
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: role!,
      };
      if (formData.dateOfBirth) payload.dateOfBirth = formData.dateOfBirth;
      if (formData.clubName) payload.clubName = formData.clubName;
      if (formData.licenseNumber) payload.licenseNumber = formData.licenseNumber;
      if (formData.phoneNumber) payload.phoneNumber = formData.phoneNumber;

      const res = await api.post('/auth/register', payload);
      setSuccess(res.data.message || 'Konto założone!');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Błąd rejestracji');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Gotowe!</h2>
          <p className="text-gray-600 mb-6">{success}</p>
          <Button
            onClick={() => router.push('/login')}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Przejdź do logowania
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 py-8">
      <div className="w-full max-w-lg space-y-6 rounded-lg bg-white p-8 shadow-lg">
        {/* Header */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Rejestracja</h2>
          <p className="mt-1 text-sm text-gray-500">
            {step === 1 ? 'Wybierz swój typ konta' : `Konto: ${ROLES.find(r => r.value === role)?.label}`}
          </p>
        </div>

        {/* Step 1 — wybór roli */}
        {step === 1 && (
          <div className="space-y-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                onClick={() => handleRoleSelect(r.value)}
                className="w-full flex items-start gap-4 rounded-lg border-2 border-gray-200 p-4 text-left
                           hover:border-indigo-500 hover:bg-indigo-50 transition-all"
              >
                <span className="text-3xl">{r.icon}</span>
                <div>
                  <div className="font-semibold text-gray-900">{r.label}</div>
                  <div className="text-sm text-gray-500">{r.desc}</div>
                </div>
              </button>
            ))}
            <div className="pt-2 text-center text-sm text-gray-500">
              Masz już konto?{' '}
              <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Zaloguj się
              </Link>
            </div>
          </div>
        )}

        {/* Step 2 — formularz */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Wróć */}
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-sm text-indigo-600 hover:text-indigo-500 flex items-center gap-1"
            >
              ← Zmień typ konta
            </button>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imię *</label>
                <Input
                  name="firstName"
                  required
                  placeholder="Jan"
                  value={formData.firstName}
                  onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nazwisko *</label>
                <Input
                  name="lastName"
                  required
                  placeholder="Kowalski"
                  value={formData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adres email *</label>
              <Input
                name="email"
                type="email"
                required
                placeholder="jan@example.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hasło *</label>
              <Input
                name="password"
                type="password"
                required
                placeholder="Minimum 8 znaków"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Powtórz hasło *</label>
              <Input
                name="passwordConfirm"
                type="password"
                required
                placeholder="Powtórz hasło"
                value={formData.passwordConfirm}
                onChange={handleChange}
              />
            </div>

            {/* Pola dla ATHLETE i COACH */}
            {(role === 'ATHLETE' || role === 'COACH') && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Klub</label>
                  <Input
                    name="clubName"
                    placeholder="Nazwa klubu (lub zostaw puste = niestowarzyszony)"
                    value={formData.clubName}
                    onChange={handleChange}
                  />
                </div>

                {role === 'ATHLETE' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Data urodzenia</label>
                      <Input
                        name="dateOfBirth"
                        type="date"
                        value={formData.dateOfBirth}
                        onChange={handleChange}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nr licencji PZLA
                        <span className="text-gray-400 font-normal ml-1">(opcjonalnie)</span>
                      </label>
                      <Input
                        name="licenseNumber"
                        placeholder="np. 12345"
                        value={formData.licenseNumber}
                        onChange={handleChange}
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                    <span className="text-gray-400 font-normal ml-1">(opcjonalnie)</span>
                  </label>
                  <Input
                    name="phoneNumber"
                    type="tel"
                    placeholder="+48 123 456 789"
                    value={formData.phoneNumber}
                    onChange={handleChange}
                  />
                </div>
              </>
            )}

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Tworzę konto...' : 'Zarejestruj się'}
            </Button>

            <div className="text-center text-sm text-gray-500">
              Masz już konto?{' '}
              <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Zaloguj się
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
