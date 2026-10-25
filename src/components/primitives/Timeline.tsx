import React from 'react';
import { CheckCircle2, Clock, AlertTriangle, XCircle, Circle } from 'lucide-react';
import { formatShortDate } from '../../lib/utils/format';

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  actor?: string;
  actorRole?: string;
  status?: 'completed' | 'in_progress' | 'pending' | 'failed' | 'warning';
  metadata?: Record<string, any>;
}

export interface TimelineProps {
  events: TimelineEvent[];
  className?: string;
}

export const Timeline: React.FC<TimelineProps> = ({ events, className = '' }) => {
  const getIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-forest-700" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-harvest-600 animate-spin" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-harvest-600" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-rose-700" />;
      default:
        return <Circle className="w-3.5 h-3.5 text-stone-400" />;
    }
  };

  const getNodeColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-forest-50 border-forest-600';
      case 'in_progress':
        return 'bg-harvest-50 border-harvest-500';
      case 'warning':
        return 'bg-harvest-50 border-harvest-500';
      case 'failed':
        return 'bg-rose-50 border-rose-600';
      default:
        return 'bg-stone-50 border-stone-300';
    }
  };

  return (
    <div className={`relative pl-4 space-y-6 before:absolute before:left-6 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200 ${className}`}>
      {events.map((evt) => (
        <div key={evt.id} className="relative flex items-start gap-3 group">
          <div
            className={`relative z-10 flex items-center justify-center w-6 h-6 rounded-none border ${getNodeColor(
              evt.status
            )} shrink-0 bg-white shadow-xs`}
          >
            {getIcon(evt.status)}
          </div>

          <div className="flex-1 min-w-0 pt-0.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-sm font-semibold text-stone-900">{evt.title}</h4>
              <time className="text-xs font-mono text-stone-500">
                {formatShortDate(evt.timestamp)}
              </time>
            </div>

            {evt.description && (
              <p className="mt-1 text-xs text-stone-600 leading-relaxed">
                {evt.description}
              </p>
            )}

            {(evt.actor || evt.actorRole) && (
              <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-500">
                {evt.actor && <span className="font-medium text-stone-700">{evt.actor}</span>}
                {evt.actor && evt.actorRole && <span>•</span>}
                {evt.actorRole && <span className="font-mono text-stone-500">{evt.actorRole}</span>}
              </div>
            )}

            {evt.metadata && Object.keys(evt.metadata).length > 0 && (
              <div className="mt-2 bg-stone-50 p-2 text-xs border border-stone-200 font-mono text-stone-600 overflow-x-auto">
                {JSON.stringify(evt.metadata, null, 2)}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
