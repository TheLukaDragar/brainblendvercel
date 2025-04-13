'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import type { ExpertRequest } from '@/lib/db/schema';
import { useEffect, useState } from 'react';
import { UsersIcon, ClockIcon, CheckCircleIcon, TagIcon } from 'lucide-react';

// Assume the API returns this field
type ExpertRequestWithCounts = ExpertRequest & { 
  completedExpertsCount: number;
};

export function ExpertRequestStatus({ chatId, isExpertRequestPending = false }: { chatId: string, isExpertRequestPending?: boolean }) {
  const [showLoadingState, setShowLoadingState] = useState(isExpertRequestPending);
  
  // Get the expert requests for this chat
  const { data: expertRequests, error, isLoading } = useSWR<Array<ExpertRequestWithCounts>>(
    `/api/expert-requests?chatId=${chatId}`,
    fetcher,
    { 
      refreshInterval: 3000,
      revalidateOnFocus: true
    }
  );

  // Get request IDs to fetch real-time counts
  const requestIds = expertRequests 
    ? expertRequests.map(req => req.id)
    : [];

  // Use the new API to get real-time counts for all requests
  const { data: requestCounts, mutate: mutateCounts } = useSWR(
    requestIds.length > 0 
      ? `/api/expert-request-counts?requestIds=${requestIds.join(',')}` 
      : null,
    fetcher,
    { 
      refreshInterval: 2000,
      revalidateOnFocus: true,
      dedupingInterval: 1000
    }
  );

  // Force refresh the counts more aggressively
  useEffect(() => {
    if (requestIds.length === 0) return;
    
    const interval = setInterval(() => {
      mutateCounts();
    }, 2000);
    
    return () => clearInterval(interval);
  }, [mutateCounts, requestIds]);

  // Immediately show loading state when isExpertRequestPending changes
  useEffect(() => {
    if (isExpertRequestPending) {
      setShowLoadingState(true);
    }
  }, [isExpertRequestPending]);

  // If we initially show loading state but then get real data, stop showing loading state
  useEffect(() => {
    if (showLoadingState && expertRequests && expertRequests.length > 0) {
      setShowLoadingState(false);
    }
    
    // If we've been waiting for 10 seconds with no data, stop showing loading state
    if (showLoadingState) {
      const timer = setTimeout(() => {
        setShowLoadingState(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [showLoadingState, expertRequests]);

  if (isLoading && !showLoadingState) {
    return null;
  }

  // Show loading state if explicitly requested or if we're still waiting for the first data
  if (showLoadingState) {
    return (
      <div className="p-2">
        <div className="mb-2 p-3 rounded-lg border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 animate-pulse relative overflow-hidden">
          {/* Shimmering effect overlay */}
          <div className="absolute inset-0 skeleton-shine bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <div className="flex justify-between items-center mb-2">
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
              <UsersIcon size={14} />
              Community Experts
            </div>
            <span className="text-xs px-2 py-1 rounded-full flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
              <ClockIcon size={12} className="animate-spin" />
              Processing
            </span>
          </div>
          
          {/* Loading skeleton for tags */}
          <div className="mb-2 flex flex-wrap gap-1">
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
          </div>
          
          <div className="flex items-center gap-2 text-blue-600/80 dark:text-blue-400/80 text-xs mt-2">
            <ClockIcon size={12} className="animate-pulse" />
            <span>Finding the right experts for your question...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !expertRequests || expertRequests.length === 0) {
    return null;
  }

  // Apply real-time counts to the expert requests
  const processedRequests = expertRequests.map(request => {
    // If we have real-time counts from the API, use them
    if (requestCounts?.[request.id]) {
      const counts = requestCounts[request.id];
      return {
        ...request,
        assignedExpertsCount: counts.assignedCount,
        completedExpertsCount: counts.completedCount
      };
    }
    
    // Fallback to the original counts or default to 0
    return {
      ...request,
      completedExpertsCount: request.completedExpertsCount || 0
    };
  });

  return (
    <div className="p-2">
      {processedRequests.map((request) => {
        const isCompleted = request.status === 'completed';
        const baseClasses = "mb-2 p-3 rounded-lg border";
        const statusClasses = isCompleted 
          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
          : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";

        return (
          <div 
            key={request.id} 
            className={`${baseClasses} ${statusClasses}`}
          >
            <div className="flex justify-between items-center mb-2">
              <div className="text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
                <UsersIcon size={14} />
                Community Experts
              </div>
              <StatusBadge status={request.status} />
            </div>
            
            {request.title && (
              <div className="mb-2 text-sm font-semibold">
                {request.title}
              </div>
            )}
            
            {request.expertiseTags && Array.isArray(request.expertiseTags) && request.expertiseTags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {request.expertiseTags.map((tag, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                  >
                    <TagIcon size={10} />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            
            <div className={`flex items-center flex-wrap gap-x-3 gap-y-1 text-xs ${ 
              isCompleted ? 'text-green-600 dark:text-green-400' : 'text-blue-600/80 dark:text-blue-400/80' 
            }`}>
              <div className="flex items-center gap-1">
                <UsersIcon size={12} />
                <span>{request.assignedExpertsCount || 0} experts assigned</span>
              </div>

              <div className="flex items-center gap-1">
                
                <span>{request.completedExpertsCount || 0} / {request.assignedExpertsCount || 0} completed</span> <CheckCircleIcon size={12} />
              </div>
              
              <div className="flex items-center gap-1">
                <ClockIcon size={12} />
                <span>Asked {formatDate(request.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
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