import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, FileSearch, ShieldAlert, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils/format';

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-stone-200 dark:bg-stone-800',
        className
      )}
    />
  );
};

export const LoadingState: React.FC<{ message?: string }> = ({ message }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
      <Loader2 className="w-8 h-8 text-agri-700 animate-spin" aria-hidden="true" />
      <p className="text-xs text-stone-600 dark:text-stone-400 font-medium">
        {message || t('app.loading')}
      </p>
    </div>
  );
};

export const EmptyState: React.FC<{
  title?: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto space-y-3 border border-dashed border-stone-300 dark:border-stone-800 rounded-xl bg-white/50 dark:bg-stone-900/40">
      <div className="p-3 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500">
        <FileSearch className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-stone-900 dark:text-stone-100">
        {title || t('states.emptyTitle')}
      </h3>
      <p className="text-xs text-stone-500 dark:text-stone-400">
        {description || t('states.emptyDescription')}
      </p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
};

export const ErrorState: React.FC<{
  title?: string;
  description?: string;
  message?: string;
  onRetry?: () => void;
}> = ({ title, description, message, onRetry }) => {
  const { t } = useTranslation();
  const desc = message || description || t('states.errorDescription');
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center max-w-md mx-auto space-y-3 border border-rose-200 dark:border-rose-900/60 rounded-xl bg-rose-50/50 dark:bg-rose-950/20">
      <div className="p-3 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
        <AlertCircle className="w-6 h-6" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
        {title || t('states.errorTitle')}
      </h3>
      <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
        {desc}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-700 text-white hover:bg-rose-800 transition-colors"
        >
          {t('app.retry')}
        </button>
      ) : null}
    </div>
  );
};

export const ForbiddenState: React.FC = () => {
  const { t } = useTranslation();
  return (
    <main className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
      <div className="p-4 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
        <ShieldAlert className="w-10 h-10" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-bold font-display text-stone-900 dark:text-stone-100">
        {t('states.forbiddenTitle')}
      </h1>
      <p className="text-xs text-stone-600 dark:text-stone-400">
        {t('states.forbiddenDescription')}
      </p>
      <a
        href="/dashboard"
        className="px-4 py-2 text-xs font-semibold rounded-lg bg-agri-800 text-white hover:bg-agri-700 transition-colors"
      >
        {t('app.backToDashboard')}
      </a>
    </main>
  );
};

export const NotFoundState: React.FC = () => {
  const { t } = useTranslation();
  return (
    <main className="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
      <div className="p-4 rounded-full bg-stone-100 dark:bg-stone-850 text-stone-600">
        <FileSearch className="w-10 h-10" aria-hidden="true" />
      </div>
      <h1 className="text-lg font-bold font-display text-stone-900 dark:text-stone-100">
        {t('states.notFoundTitle')}
      </h1>
      <p className="text-xs text-stone-600 dark:text-stone-400">
        {t('states.notFoundDescription')}
      </p>
      <a
        href="/dashboard"
        className="px-4 py-2 text-xs font-semibold rounded-lg bg-agri-800 text-white hover:bg-agri-700 transition-colors"
      >
        {t('app.backToDashboard')}
      </a>
    </main>
  );
};
