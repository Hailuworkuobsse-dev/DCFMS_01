import React from 'react';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export const BreadcrumbNav: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
  return (
    <nav aria-label="Breadcrumb" className="mb-2">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-center gap-1.5">
            {idx > 0 && <span className="text-stone-300">/</span>}
            {item.href ? (
              <a
                href={item.href}
                className="hover:text-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-600 rounded-sm"
              >
                {item.label}
              </a>
            ) : (
              <span className="font-medium text-stone-800" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
};
