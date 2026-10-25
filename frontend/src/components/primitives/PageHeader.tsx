import React from 'react';
import { useTranslation } from 'react-i18next';
import { BreadcrumbNav } from './BreadcrumbNav';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  breadcrumbs,
  actions,
  badge,
}) => {
  const { t } = useTranslation();

  return (
    <header className="page-heading mb-6 border-b border-stone-200 pb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label={t('common.breadcrumbs', 'Breadcrumbs')} className="mb-2">
          <ol className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            {breadcrumbs.map((crumb, idx) => (
              <li key={idx} className="flex items-center gap-1.5">
                {idx > 0 && <span className="text-stone-300">/</span>}
                {crumb.href ? (
                  <a
                    href={crumb.href}
                    className="hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 rounded-sm"
                  >
                    {crumb.label}
                  </a>
                ) : (
                  <span className="font-medium text-stone-800" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="page-heading-row flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="page-heading-title text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
              {title}
            </h1>
            {badge && <div>{badge}</div>}
          </div>
          {subtitle && (
            <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
};
