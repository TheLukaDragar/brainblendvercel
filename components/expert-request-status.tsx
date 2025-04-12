'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { type ExpertRequest } from '@/lib/db/schema';
import { useEffect } from 'react';
import { UsersIcon, ClockIcon, CheckCircleIcon } from 'lucide-react';

export function ExpertRequestStatus({ chatId }: { chatId: string }) {
  const { data: expertRequests, error, isLoading } = useSWR<Array<ExpertRequest>>(
    `/api/expert-requests?chatId=${chatId}`,
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );

  if (isLoading) {
    return null;
  }

  if (error || !expertRequests || expertRequests.length === 0) {
    return null;
  }

  return (
    <div className="p-2">
      {expertRequests.map((request) => (
        <div 
          key={request.id} 
          className="mb-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
        >
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <UsersIcon size={14} />
              Community Experts
            </div>
            <StatusBadge status={request.status} />
          </div>
          
          <div className="flex items-center gap-2 text-xs text-blue-600/80 dark:text-blue-400/80">
            <div className="flex items-center gap-1">
              <UsersIcon size={12} />
              <span>{request.assignedExpertsCount || 0} experts assigned</span>
            </div>
            
            <span>•</span>
            
            <div className="flex items-center gap-1">
              <ClockIcon size={12} />
              <span>Asked {formatDate(request.createdAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let bgColor = 'bg-yellow-100 dark:bg-yellow-900/30';
  let textColor = 'text-yellow-800 dark:text-yellow-300';
  let label = 'Pending';
  let icon = <ClockIcon size={12} />;

  if (status === 'in_progress') {
    bgColor = 'bg-blue-100 dark:bg-blue-900/30';
    textColor = 'text-blue-800 dark:text-blue-300';
    label = 'In Progress';
    icon = <UsersIcon size={12} />;
  } else if (status === 'completed') {
    bgColor = 'bg-green-100 dark:bg-green-900/30';
    textColor = 'text-green-800 dark:text-green-300';
    label = 'Completed';
    icon = <CheckCircleIcon size={12} />;
  }

  return (
    <span className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${bgColor} ${textColor}`}>
      {icon}
      {label}
    </span>
  );
}

function formatDate(dateString: string | Date) {
  const date = new Date(dateString);
  
  // If less than 24 hours ago, show relative time
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  
  if (diffHours < 24) {
    if (diffHours < 1) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    }
    return `${Math.floor(diffHours)} hour${Math.floor(diffHours) !== 1 ? 's' : ''} ago`;
  }
  
  // Otherwise show date
  return date.toLocaleDateString();
} 