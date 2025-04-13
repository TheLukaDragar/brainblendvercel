'use client';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';
import { ChevronDownIcon, ChevronRightIcon, UsersIcon, MessageCircleIcon, CheckIcon, XIcon, ClockIcon } from 'lucide-react';

type ExpertAssignmentWithRequest = {
  assignment: {
    id: string;
    expertRequestId: string;
    expertId: string;
    status: string;
    response?: string;
    rating?: string;
    createdAt: string;
    updatedAt: string;
  };
  request: {
    id: string;
    chatId: string;
    title?: string;
    question: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    assignedExpertsCount: number;
    completedExpertsCount?: number;
  };
};

// Type for the counts response
type RequestCounts = {
  [requestId: string]: {
    assignedCount: number;
    completedCount: number;
  };
};

// We'll add a function to calculate completed experts count
function getCompletedExpertsCount(assignments: ExpertAssignmentWithRequest[]) {
  if (!assignments || !Array.isArray(assignments)) {
    return [];
  }
  
  const requestCompletionMap = new Map<string, { total: number, completed: number }>();
  
  // Group by request and count completed assignments
  assignments.forEach(item => {
    if (!item || !item.request || !item.request.id || !item.assignment) {
      return; // Skip invalid items
    }
    
    const requestId = item.request.id;
    if (!requestCompletionMap.has(requestId)) {
      requestCompletionMap.set(requestId, { total: 0, completed: 0 });
    }
    
    const counts = requestCompletionMap.get(requestId)!;
    counts.total++;
    
    if (item.assignment.status === 'submitted' || 
        item.assignment.status === 'accepted') {
      counts.completed++;
    }
  });
  
  // Create a new array of assignments with completedExpertsCount added
  return assignments.map(item => {
    if (!item || !item.request || !item.request.id) {
      return item; // Return unchanged if invalid
    }
    
    const requestId = item.request.id;
    const counts = requestCompletionMap.get(requestId) || { total: 0, completed: 0 };
    
    return {
      ...item,
      request: {
        ...item.request,
        completedExpertsCount: counts.completed
      }
    };
  });
}

export function ExpertAssignments() {
  const { data: rawAssignments, error, isLoading } = useSWR<Array<ExpertAssignmentWithRequest>>(
    '/api/expert-assignments',
    fetcher,
    { 
      refreshInterval: 5000, // Refresh every 5 seconds
      revalidateOnFocus: true 
    }
  );
  
  // Get all unique request IDs
  const requestIds = rawAssignments 
    ? [...new Set(rawAssignments.map(a => a.request.id))]
    : [];
  
  // Use our new API to get real-time counts for all requests
  const { data: requestCounts, mutate: mutateCounts } = useSWR<RequestCounts>(
    requestIds.length > 0 
      ? `/api/expert-request-counts?requestIds=${requestIds.join(',')}` 
      : null,
    fetcher,
    { 
      refreshInterval: 3000, // Refresh every 3 seconds
      revalidateOnFocus: true,
      dedupingInterval: 1000
    }
  );
  
  // Force refresh the counts more aggressively
  useEffect(() => {
    if (requestIds.length === 0) return;
    
    const interval = setInterval(() => {
      mutateCounts();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [mutateCounts, requestIds]);
  
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium">
        <div className="flex items-center gap-2">
          <UsersIcon size={14} className="text-blue-500" />
          <span>Community questions</span>
        </div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-4 rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between px-2 py-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <UsersIcon size={14} />
          <span>{error.message}</span>
        </div>
      </div>
    );
  }

  // Process assignments and apply real-time counts from the API
  const assignments = rawAssignments ? rawAssignments.map(item => {
    // If we have real-time counts, use them
    if (requestCounts && requestCounts[item.request.id]) {
      const counts = requestCounts[item.request.id];
      return {
        ...item,
        request: {
          ...item.request,
          assignedExpertsCount: counts.assignedCount,
          completedExpertsCount: counts.completedCount
        }
      };
    }
    
    // Fallback to original data
    return item;
  }) : [];

  const pendingCount = assignments.filter(a => 
    a.assignment.status === 'assigned' || a.assignment.status === 'working'
  ).length;

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-2 py-2 text-sm font-medium border-t border-border">
        <div className="flex items-center gap-2">
          <UsersIcon size={14} className="text-blue-500" />
          <span>Community questions</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full font-medium">
              {pendingCount} pending
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-1 space-y-1">
        {assignments.map((item) => (
          <AssignmentItem 
            key={item.assignment.id} 
            assignment={item.assignment} 
            request={item.request} 
            onClick={() => router.push(`/answer/${item.request.chatId}`)}
          />
        ))}
      </div>
    </div>
  );
}

function AssignmentItem({ 
  assignment, 
  request, 
  onClick 
}: { 
  assignment: ExpertAssignmentWithRequest['assignment'];
  request: ExpertAssignmentWithRequest['request'];
  onClick: () => void;
}) {
  // Format the request creation date to a readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    
    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'assigned':
        return {
          color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
          icon: <ClockIcon size={12} />,
          label: 'Help Wanted'
        };
      case 'working':
        return {
          color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
          icon: <MessageCircleIcon size={12} />,
          label: 'In Progress'
        };
      case 'submitted':
        return {
          color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
          icon: <CheckIcon size={12} />,
          label: 'Submitted'
        };
      case 'accepted':
        return {
          color: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
          icon: <CheckIcon size={12} />,
          label: 'Accepted'
        };
      case 'rejected':
        return {
          color: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
          icon: <XIcon size={12} />,
          label: 'Rejected'
        };
      default:
        return {
          color: 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300',
          icon: null,
          label: status.charAt(0).toUpperCase() + status.slice(1)
        };
    }
  };

  // Truncate the question to a reasonable length
  const truncateQuestion = (question: string, maxLength = 50) => {
    if (question.length <= maxLength) return question;
    return `${question.substring(0, maxLength)}...`;
  };

  const statusInfo = getStatusInfo(assignment.status);

  // Calculate completion percentage
  const completedCount = request.completedExpertsCount || 0;
  const totalExperts = request.assignedExpertsCount || 0;
  const completionText = totalExperts > 0 
    ? `${completedCount}/${totalExperts} completed` 
    : 'No experts assigned';

  return (
    <div 
      className="px-3 py-3 cursor-pointer text-sm rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
      onClick={onClick}
    >
      <div className="flex flex-col gap-3">
        <div className="font-medium line-clamp-2">{request.title || request.question}</div>
        
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <UsersIcon size={12} />
                <span>{completionText}</span>
              </div>
              <span>•</span>
              <div>{formatDate(request.createdAt)}</div>
            </div>
            
            <div className={`text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5 whitespace-nowrap ${statusInfo.color}`}>
              {statusInfo.icon}
              <span>{statusInfo.label}</span>
            </div>
          </div>
          
          {totalExperts > 0 && (
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mt-1">
              <div 
                className="bg-blue-500 h-1.5 rounded-full" 
                style={{ width: `${(completedCount / totalExperts) * 100}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
