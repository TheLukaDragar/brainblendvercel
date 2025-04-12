'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';
import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon, UsersIcon, MessageCircleIcon, CheckIcon, XIcon } from 'lucide-react';

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
    question: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    assignedExpertsCount: number;
  };
};

export function ExpertAssignments() {
  const { data: assignments, error, isLoading } = useSWR<Array<ExpertAssignmentWithRequest>>(
    '/api/expert-assignments',
    fetcher,
    { refreshInterval: 15000 } // Refresh every 15 seconds
  );
  
  const [isExpanded, setIsExpanded] = useState(true);
  const router = useRouter();

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium">
        <div className="flex items-center gap-2">
          <UsersIcon size={14} className="text-blue-500" />
          <span>Expert Assignments</span>
        </div>
        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 w-4 rounded-full"></div>
      </div>
    );
  }

  if (error || !assignments || assignments.length === 0) {
    return (
      <div className="flex items-center justify-between px-2 py-2 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <UsersIcon size={14} />
          <span>No Expert Assignments</span>
        </div>
      </div>
    );
  }

  const pendingCount = assignments.filter(a => 
    a.assignment.status === 'assigned' || a.assignment.status === 'working'
  ).length;

  return (
    <div className="border-t border-border pt-2">
      <div 
        className="flex items-center justify-between px-2 py-1.5 cursor-pointer text-sm font-medium hover:bg-muted/50 rounded-md"
        onClick={toggleExpand}
      >
        <div className="flex items-center gap-2">
          <UsersIcon size={14} className="text-blue-500" />
          <span>Expert Assignments</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full">
              {pendingCount}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
      </div>

      {isExpanded && (
        <div className="mt-1 space-y-1 max-h-[300px] overflow-y-auto px-1">
          {assignments.map((item) => (
            <AssignmentItem 
              key={item.assignment.id} 
              assignment={item.assignment} 
              request={item.request} 
              onClick={() => router.push(`/answer/${item.request.chatId}`)}
            />
          ))}
        </div>
      )}
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
  const [isActionOpen, setIsActionOpen] = useState(false);
  
  // Format the request creation date to a readable format
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // If it's today, just show the time
    if (new Date().toDateString() === date.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // Otherwise show the date
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
      case 'working':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
      case 'submitted':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
      case 'accepted':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'assigned':
        return <UsersIcon size={10} />;
      case 'working':
        return <MessageCircleIcon size={10} />;
      case 'submitted':
        return <CheckIcon size={10} />;
      case 'accepted':
        return <CheckIcon size={10} />;
      case 'rejected':
        return <XIcon size={10} />;
      default:
        return null;
    }
  };

  // Truncate the question to a reasonable length
  const truncateQuestion = (question: string, maxLength = 50) => {
    if (question.length <= maxLength) return question;
    return `${question.substring(0, maxLength)}...`;
  };

  return (
    <div 
      className="px-2 py-1.5 cursor-pointer text-sm rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="font-medium">{truncateQuestion(request.question)}</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
            <div className="flex items-center gap-1">
              <UsersIcon size={10} />
              <span>{request.assignedExpertsCount || 0} experts</span>
            </div>
            <span>•</span>
            <div>{formatDate(request.createdAt)}</div>
          </div>
        </div>
        <div className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ml-2 whitespace-nowrap ${getStatusColor(assignment.status)}`}>
          {getStatusIcon(assignment.status)}
          {assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
        </div>
      </div>
    </div>
  );
} 