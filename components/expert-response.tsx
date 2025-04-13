'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { 
  SendIcon, 
  Loader2Icon, 
  ClockIcon, 
  AlertCircleIcon, 
  UserIcon, 
  BotIcon 
} from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/utils';
import { Spinner } from './ui/spinner';

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

export function ExpertResponse({ 
  chatId,
  isExpertView = false, // Add a prop to detect if we're in the expert view
}: { 
  chatId: string;
  isExpertView?: boolean;
}) {
  const { data: expertAssignments, error, isValidating } = useSWR<ExpertAssignmentWithRequest[]>(
    '/api/expert-assignments',
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );
  
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  
  // Find if the expert is assigned to this chat
  const currentAssignment = expertAssignments?.find(
    (item) => item.request.chatId === chatId
  );
  
  // Initialize response from assignment if available
  useEffect(() => {
    if (currentAssignment?.assignment?.response && !response) {
      setResponse(currentAssignment.assignment.response);
    }
  }, [currentAssignment, response]);
  
  const setStatus = async (newStatus: string) => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`/api/expert-assignments/${currentAssignment?.assignment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update status');
      }
      
      toast.success('You are now working on this request');
      mutate('/api/expert-assignments');
    } catch (error) {
      toast.error('Failed to update status');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const submitResponse = async () => {
    if (!response.trim() || !currentAssignment) {
      toast.error('Please provide a response');
      return;
    }
    
    try {
      setIsLoading(true);
      
      const responseObj = await fetch(`/api/expert-assignments/${currentAssignment.assignment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'submitted',
          response: response,
        }),
      });
      
      if (!responseObj.ok) {
        throw new Error('Failed to submit response');
      }
      
      toast.success('Your expert response has been submitted');
      mutate('/api/expert-assignments');
    } catch (error) {
      toast.error('Failed to submit response');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Format timestamp to readable time
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  // If loading, show spinner
  if (isValidating && !expertAssignments) {
    return (
      <div className="flex flex-col justify-center items-center p-6 border-t border-border mt-auto">
        <Spinner className="mb-2" />
        <p className="text-sm text-muted-foreground">Loading assignment status...</p>
      </div>
    );
  }
  
  // If no assignment, don't show anything
  if (!currentAssignment) {
    return null;
  }
  
  // At this point we know we have a currentAssignment
  const { assignment, request } = currentAssignment;
  
  // Status indicator component
  const StatusIndicator = ({ status }: { status: string }) => {
    const statusConfig = {
      assigned: { color: 'bg-yellow-400', text: 'Awaiting your response' },
      working: { color: 'bg-blue-500', text: 'Working on response' },
      submitted: { color: 'bg-purple-500', text: 'Response submitted' },
      accepted: { color: 'bg-green-500', text: 'Response accepted' },
      rejected: { color: 'bg-red-500', text: 'Response rejected' },
    }[status] || { color: 'bg-gray-500', text: 'Unknown status' };
    
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground border-b border-border mb-4">
        <div className={`w-2 h-2 rounded-full ${statusConfig.color} ${status === 'assigned' || status === 'working' ? 'animate-pulse' : ''}`} />
        <span>{statusConfig.text}</span>
      </div>
    );
  };
  
  // If isExpertView is true, we're in the dedicated expert answer page
  // If not, we're in the regular chat page with expertMode toggled on
  return (
    <div className={`flex flex-col ${isExpertView ? '' : 'border rounded-lg shadow-sm'}`}>
      {/* Chat container */}
      <div className="flex-1 flex flex-col overflow-auto p-4 space-y-4">
        <StatusIndicator status={assignment.status} />
        
        {/* User question - always show in regular chat view, hide in expert view since it's redundant */}
        {!isExpertView && (
          <div className="flex flex-col max-w-[75%]">
            <div className="flex items-start gap-2">
              <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-full">
                <UserIcon size={16} />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs">User</span>
                  <span className="text-xs text-muted-foreground">{formatTime(request.createdAt)}</span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mt-1 whitespace-pre-wrap text-sm">
                  {request.question}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Expert response - show if status is submitted, accepted, or rejected */}
        {['submitted', 'accepted', 'rejected'].includes(assignment.status) && (
          <div className="flex flex-col max-w-[75%]">
            <div className="flex items-start gap-2">
              <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full">
                <BotIcon size={16} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-xs">You</span>
                  <span className="text-xs text-muted-foreground">{formatTime(assignment.updatedAt)}</span>
                  {assignment.status === 'accepted' && (
                    <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full">Accepted</span>
                  )}
                  {assignment.status === 'rejected' && (
                    <span className="px-1.5 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-xs rounded-full">Rejected</span>
                  )}
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/50 rounded-lg p-3 mt-1 whitespace-pre-wrap text-sm border border-blue-200 dark:border-blue-800">
                  {assignment.response}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Input area - only show if status is assigned or working */}
      {['assigned', 'working'].includes(assignment.status) && (
        <div className="border-t border-border p-4">
          {assignment.status === 'assigned' ? (
            <div className="flex justify-center">
              <Button 
                variant="outline" 
                onClick={() => setStatus('working')}
                disabled={isLoading}
                className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:text-blue-700"
              >
                {isLoading ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <ClockIcon className="h-4 w-4 mr-2" />}
                Start Working
              </Button>
            </div>
          ) : (
            <div className="flex flex-col space-y-3">
              <Textarea
                placeholder="Write your expert response here. Be thorough and accurate - your expertise matters!"
                className="min-h-[120px] resize-none"
                value={response}
                onChange={(e) => setResponse(e.target.value)}
              />
              <div className="flex justify-between items-center">
                <div className="text-xs text-muted-foreground flex items-center">
                  <AlertCircleIcon size={12} className="mr-1" />
                  Use markdown for formatting if needed
                </div>
                <Button 
                  onClick={submitResponse}
                  disabled={isLoading || !response.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isLoading ? (
                    <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <SendIcon className="h-4 w-4 mr-2" />
                  )}
                  Submit Response
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 