'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { toast } from 'sonner';
import { UsersIcon, SendIcon, Loader2Icon, ClockIcon, BookmarkIcon, AlertCircleIcon } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { fetcher } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';
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

export function ExpertResponse({ chatId }: { chatId: string }) {
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
  
  const getQuestionDisplay = () => {
    if (!currentAssignment) return null;
    
    return (
      <div className="mb-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-md text-sm border border-gray-200 dark:border-gray-700">
        <div className="font-medium mb-1 flex items-center gap-1 text-gray-700 dark:text-gray-300">
          <BookmarkIcon size={14} />
          Question from user:
        </div>
        <p className="whitespace-pre-wrap">{currentAssignment.request.question}</p>
      </div>
    );
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
  
  // If the assignment is already submitted, accepted or rejected, show a read-only view
  const isReadOnly = ['submitted', 'accepted', 'rejected'].includes(assignment.status);
  
  // Render based on assignment status
  switch (assignment.status) {
    case 'assigned':
      return (
        <Card className="mx-4 my-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <UsersIcon size={16} />
              Expert Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getQuestionDisplay()}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></div>
              <span className="text-sm font-medium">You've been assigned to answer this question</span>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setStatus('working')}
              disabled={isLoading}
              className="text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              {isLoading ? <Loader2Icon className="h-4 w-4 animate-spin mr-2" /> : <ClockIcon className="h-4 w-4 mr-2" />}
              Start Working
            </Button>
          </CardFooter>
        </Card>
      );
      
    case 'working':
      return (
        <Card className="mx-4 my-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <UsersIcon size={16} />
              Expert Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getQuestionDisplay()}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-sm font-medium">You're currently working on this request</span>
            </div>
            <Textarea
              placeholder="Write your expert response here. Be thorough and accurate - your expertise matters!"
              className="min-h-[200px] resize-none"
              value={response}
              onChange={(e) => setResponse(e.target.value)}
            />
            <div className="mt-2 text-xs text-muted-foreground">
              <AlertCircleIcon size={12} className="inline mr-1" />
              Make your response comprehensive, accurate, and concise. Use markdown for formatting if needed.
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
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
          </CardFooter>
        </Card>
      );
      
    case 'submitted':
      return (
        <Card className="mx-4 my-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <UsersIcon size={16} />
              Expert Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getQuestionDisplay()}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="text-sm font-medium">Your response has been submitted</span>
              </div>
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">Submitted</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md text-sm border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
              {assignment.response}
            </div>
          </CardContent>
        </Card>
      );
      
    case 'accepted':
      return (
        <Card className="mx-4 my-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <UsersIcon size={16} />
              Expert Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getQuestionDisplay()}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium">Your response was accepted</span>
              </div>
              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Accepted</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md text-sm border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
              {assignment.response}
            </div>
          </CardContent>
        </Card>
      );
      
    case 'rejected':
      return (
        <Card className="mx-4 my-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <UsersIcon size={16} />
              Expert Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            {getQuestionDisplay()}
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-sm font-medium">Your response was not accepted</span>
              </div>
              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Rejected</span>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-md text-sm border border-gray-200 dark:border-gray-700 whitespace-pre-wrap">
              {assignment.response}
            </div>
          </CardContent>
        </Card>
      );
      
    default:
      return (
        <Card className="mx-4 my-4 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <UsersIcon size={16} />
              Expert Response
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Unknown assignment status.</p>
          </CardContent>
        </Card>
      );
  }
} 