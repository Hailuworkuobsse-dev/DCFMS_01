import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, KeyRound, User, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { RoleId } from '../../lib/rbac/roles';
import { api } from '../../lib/api/client';
import { ShellControls } from '../../components/primitives/ShellControls';

export interface LoginPageProps {
  onSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onSuccess }) => {
  const { t } = useTranslation();
  const { setSession } = useAppStore();

  const [username, setUsername] = useState('superadmin@ati.gov.et');
  const [password, setPassword] = useState('ati2025!');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quick Role selection presets
  const rolePresets: Array<{ role: RoleId; label: string; email: string }> = [
    { role: 'ATISuperAdmin', label: 'ATI Super Admin', email: 'superadmin@ati.gov.et' },
    { role: 'MoAFederal', label: 'MoA Federal Inspector', email: 'oversight@moa.gov.et' },
    { role: 'WBoAWoreda', label: 'WBoA Woreda Officer', email: 'adaa@wboa.gov.et' },
    { role: 'Contractor', label: 'Wheat Agro-Processor', email: 'offtake@habeshabreweries.com' },
    { role: 'ProducerCooperative', label: 'Erba Farmers Cooperative', email: 'manager@erbafarmers.org' },
    { role: 'FinancialInstitution', label: 'Cooperative Bank', email: 'agri-credit@coopbank.et' },
    { role: 'JusticeOfficer', label: 'Woreda Court Judge', email: 'arbitration@justice.gov.et' },
    { role: 'ProducerIndividual', label: 'Smallholder Farmer', email: 'alemu.farmer@ethio.et' },
  ];

  const handleSelectPreset = (preset: typeof rolePresets[0]) => {
    setUsername(preset.email);
    setPassword('ati2025!');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await api.auth.login(username, password);
      setSession(res.user, res.permissions);
      onSuccess();
    } catch (err: any) {
      setError(err?.message || t('auth.loginFailed', 'Invalid credentials or connection error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-between">
      {/* Header */}
      <header className="bg-white border-b border-stone-200">
        <div className="h-1 flex w-full">
          <div className="flex-1 bg-forest-700" />
          <div className="flex-1 bg-harvest-500" />
          <div className="flex-1 bg-rose-700" />
        </div>
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-forest-800 text-harvest-400 font-bold flex items-center justify-center text-sm border border-forest-900">
              ATI
            </div>
            <div>
              <span className="font-extrabold text-sm text-stone-900 tracking-tight">DCFMS</span>
              <span className="text-xs text-stone-500 ml-2">Agricultural Transformation Institute</span>
            </div>
          </div>
          <ShellControls />
        </div>
      </header>

      {/* Main Login Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left: Persona Switcher for Evaluation */}
        <div className="lg:col-span-6 space-y-4">
          <div className="border border-stone-200 bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm mb-1">
              <Shield className="w-4 h-4 text-forest-700" />
              <span>{t('auth.evaluationPresets', 'One-Click Role Switcher (18 Roles)')}</span>
            </div>
            <p className="text-xs text-stone-600 mb-4">
              {t(
                'auth.presetsDesc',
                'Select any of the official stakeholder personas to evaluate their tailored dashboard, permissions, and workflow capabilities.'
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {rolePresets.map((preset) => {
                const isSelected = username === preset.email;
                return (
                  <button
                    key={preset.role}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`text-left p-2.5 border transition-all text-xs ${
                      isSelected
                        ? 'border-stone-900 bg-stone-50 font-semibold ring-1 ring-stone-900'
                        : 'border-stone-200 bg-white hover:border-stone-400 hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] text-forest-800 truncate">
                        {preset.role}
                      </span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-stone-900 shrink-0" />}
                    </div>
                    <p className="text-stone-700 mt-1 truncate">{preset.label}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-stone-200 text-[11px] text-stone-500 font-mono">
              Proclamation No. 1289/2023 Compliant • Fayda National ID Verified
            </div>
          </div>
        </div>

        {/* Right: Login Form */}
        <div className="lg:col-span-6">
          <div className="bg-white border border-stone-300 p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-stone-900">
                {t('auth.loginTitle', 'Sign in to DCFMS Portal')}
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                {t('auth.loginSubtitle', 'Secure portal for Ethiopian contract farming ecosystem')}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {t('auth.emailOrUsername', 'Official Email or Fayda ID')}
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="name@domain.gov.et"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  {t('auth.password', 'Password')}
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 focus:outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1 font-mono">
                  Default evaluation password: <span className="font-bold">ati2025!</span>
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-forest-800 hover:bg-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-900 transition-colors shadow-xs disabled:opacity-60"
              >
                <span>{isLoading ? t('common.processing', 'Authenticating...') : t('auth.signIn', 'Sign In')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 pt-4 border-t border-stone-200 text-[11px] text-stone-500 text-center">
              Federal Democratic Republic of Ethiopia • Agricultural Transformation Institute (ATI)
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-3 text-center text-xs text-stone-500">
        DCFMS &copy; {new Date().getFullYear()} ATI Ethiopia. Low-Bandwidth Mode Enabled for 2G/3G Woredas.
      </footer>
    </div>
  );
};
