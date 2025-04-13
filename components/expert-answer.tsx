'use client';

import type { UIMessage } from 'ai';
import { useState, useEffect } from 'react';
import useSWR from 'swr';
import ReactConfetti from 'react-confetti';
import { useWindowSize } from '@react-hook/window-size';
import { ChatHeader } from '@/components/chat-header';
import type { Vote, ExpertAssignment } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';
import type { VisibilityType } from './visibility-selector';
import { toast } from 'sonner';
import { ExpertRequestStatus } from './expert-request-status';
import { 
  UsersIcon, 
  Loader2Icon, 
  AlertCircleIcon, 
  CheckCircleIcon, 
  XCircleIcon, 
  ClockIcon, 
  UserIcon,
  SparklesIcon,
  BotIcon,
  GiftIcon,
} from 'lucide-react';
import { ArrowUpIcon } from './icons';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Spinner } from './ui/spinner';
import { StarIcon } from '@heroicons/react/24/solid';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

// Custom animation classes for slower pulsing
const customAnimationStyles = `
@keyframes slow-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
.animate-slow-pulse {
  animation: slow-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
`;

// Quality assessment type
type QualityAssessment = {
  accuracy: { score: number; feedback: string };
  completeness: { score: number; feedback: string };
  clarity: { score: number; feedback: string };
  helpfulness: { score: number; feedback: string };
  conciseness: { score: number; feedback: string };
  overall: { score: number; feedback: string };
  suggestions: string[];
  passesThreshold: boolean;
};

// Add credits awarded to the assignment type
type ExpertAssignmentWithRequest = {
  assignment: ExpertAssignment & { creditsAwarded?: number | null };
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

export function ExpertAnswer({
  id,
  initialMessages,
  selectedChatModel,
  selectedVisibilityType,
}: {
  id: string;
  initialMessages: Array<UIMessage>;
  selectedChatModel: string;
  selectedVisibilityType: VisibilityType;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState('');
  const [isAssessing, setIsAssessing] = useState(false);
  const [assessment, setAssessment] = useState<QualityAssessment | null>(null);
  const [showAssessment, setShowAssessment] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [awardedCredits, setAwardedCredits] = useState<number | null>(null);
  const [showThankYouModal, setShowThankYouModal] = useState(false);

  const [width = 0, height = 0] = useWindowSize();

  // Get user question from initialMessages
  const userMessage = initialMessages.find(msg => msg.role === 'user');
  const userQuestion = userMessage?.parts?.[0]?.type === 'text' 
    ? (userMessage.parts[0] as any).text 
    : 'No question found';
  const messageTime = userMessage?.createdAt || new Date().toISOString();

  // Format timestamp to readable format
  const formatTime = (timestamp: string | Date) => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Get expert assignment information for this chat
  const { data: expertAssignments, error, isValidating } = useSWR<ExpertAssignmentWithRequest[]>(
    `/api/expert-assignments`,
    fetcher,
    { refreshInterval: 10000 } // Refresh every 10 seconds
  );

  // Find if the expert is assigned to this chat
  const currentAssignment = (Array.isArray(expertAssignments) ? expertAssignments : [])?.find(
    (item) => item.request.chatId === id
  );

  const submitResponse = async () => {
    if (!response.trim() || !currentAssignment) {
      toast.error('Please provide a response');
      return;
    }
    
    // Debug the current assignment data structure
    console.log("Current assignment (submit):", currentAssignment);
    console.log("Question value (submit):", currentAssignment.request?.question);
    console.log("User question from message:", userQuestion);
    
    // Use either the question from the assignment or fall back to the user message
    const questionToEvaluate = currentAssignment.request?.question || userQuestion;
    
    // Make sure we have a question to send
    if (!questionToEvaluate) {
      toast.error('Cannot find the original question to evaluate against');
      return;
    }
    
    try {
      setIsLoading(true);
      
      // First, assess the quality of the response
      setIsAssessing(true);
      const qualityResponse = await fetch(`/api/quality-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: questionToEvaluate,
          response: response,
        }),
      });
      
      if (!qualityResponse.ok) {
        const errorData = await qualityResponse.json().catch(() => ({}));
        if (errorData.errors && Array.isArray(errorData.errors)) {
          throw new Error(errorData.errors.join('. '));
        } else {
          throw new Error('Failed to assess response quality');
        }
      }
      
      const assessmentData = await qualityResponse.json();
      setAssessment(assessmentData);
      setShowAssessment(true);
      setIsAssessing(false);
      
      // If quality doesn't pass the threshold, don't submit
      if (!assessmentData.passesThreshold) {
        setIsLoading(false);
        toast.error('Please improve your response based on the feedback before submitting');
        return;
      }
      
      // Quality passes, proceed with submission
      const responseObj = await fetch(`/api/expert-assignments/${currentAssignment.assignment.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'submitted',
          response: response,
          creditsAwarded: 1, // Award a fixed 1 credit
        }),
      });
      
      if (!responseObj.ok) {
        throw new Error('Failed to submit response');
      }

      const credits = 1; // Fixed 1 credit
      setAwardedCredits(credits);
      
      // Show confetti, success message, and modal
      setShowConfetti(true);
      toast.success(`Your expert response has been submitted! You earned 1 credit!`);
      setShowThankYouModal(true);
      setTimeout(() => setShowConfetti(false), 6000);

      // Reset assessment display
      setShowAssessment(false);
      // Refresh data
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      fetch('/api/expert-assignments', { signal: controller.signal })
        .then(res => res.json())
        .then(() => {
          // Force a refresh of the SWR cache
          mutate();
        });
    } catch (error) {
      toast.error('Failed to submit response');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Function to assess response quality without submitting
  const checkResponseQuality = async () => {
    if (!response.trim() || !currentAssignment) {
      toast.error('Please provide a response to check');
      return;
    }
    
    // Debug the current assignment data structure
    console.log("Current assignment:", currentAssignment);
    console.log("Question value:", currentAssignment.request?.question);
    console.log("User question from message:", userQuestion);
    
    // Use either the question from the assignment or fall back to the user message
    const questionToEvaluate = currentAssignment.request?.question || userQuestion;
    
    // Make sure we have a question to send
    if (!questionToEvaluate) {
      toast.error('Cannot find the original question to evaluate against');
      return;
    }
    
    try {
      setIsAssessing(true);
      
      const qualityResponse = await fetch(`/api/quality-assessment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: questionToEvaluate,
          response: response,
        }),
      });
      
      if (!qualityResponse.ok) {
        const errorData = await qualityResponse.json().catch(() => ({}));
        if (errorData.errors && Array.isArray(errorData.errors)) {
          throw new Error(errorData.errors.join('. '));
        } else {
          throw new Error('Failed to assess response quality');
        }
      }
      
      const assessmentData = await qualityResponse.json();
      setAssessment(assessmentData);
      setShowAssessment(true);
      
      if (!assessmentData.passesThreshold) {
        toast.warning('Your response needs improvement based on the feedback');
      } else {
        toast.success('Your response meets the quality threshold!');
      }
    } catch (error) {
      toast.error('Failed to check response quality');
      console.error(error);
    } finally {
      setIsAssessing(false);
    }
  };

  // Set status when user starts working
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
      // Refresh data
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 5000);
      fetch('/api/expert-assignments', { signal: controller.signal })
        .then(res => res.json())
        .then(() => {
          // Force a refresh of the SWR cache
          mutate();
        });
    } catch (error) {
      toast.error('Failed to update status');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper for mutate
  const { mutate } = useSWR<ExpertAssignmentWithRequest[]>('/api/expert-assignments');

  // Loading state
  if (isValidating && !expertAssignments) {
  return (
      <div className="flex flex-col min-w-0 h-dvh">
        <header className="flex sticky top-0 border-t border-b border-indigo-900 py-1.5 items-center px-2 md:px-2 gap-2">
          <ChatHeader
            chatId={id}
            selectedModelId={selectedChatModel}
            selectedVisibilityType={selectedVisibilityType}
            isReadonly={true}
          />
          <div className="flex-1 p-4 px-4 h-16 flex items-center transition-colors duration-300">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm text-white font-medium flex items-center gap-2">
                <UsersIcon size={16} className="text-blue-300" />
                Community Experts
              </span>
            </div>
          </div>
        </header>
        <div className="flex flex-col flex-1 items-center justify-center">
          <Spinner className="text-blue-600 mb-4" />
          <p className="text-sm text-blue-600/80 dark:text-blue-400/80">Loading expert assignment...</p>
        </div>
      </div>
    );
  }

  // Get assignment status
  const assignmentStatus = currentAssignment?.assignment.status || 'not_assigned';

  return (
    <div className="flex flex-col min-w-0 h-dvh bg-background relative">
      {showConfetti && (
        <ReactConfetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={500}
          tweenDuration={5000}
          className="absolute top-0 left-0 w-full h-full z-50 pointer-events-none"
        />
      )}

      <div className="flex items-center">
        <ChatHeader
          chatId={id}
          selectedModelId={selectedChatModel}
          selectedVisibilityType={selectedVisibilityType}
          isReadonly={true}
        />
        <div className="flex-1 p-4 px-4 h-16 flex items-center transition-colors duration-300">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-sm text-white font-medium flex items-center gap-2">
              <UsersIcon size={16} className="text-blue-300" />
              Community Experts
            </span>
          </div>
        </div>
      </header>

        <ExpertRequestStatus chatId={id} />

      <style jsx global>{customAnimationStyles}</style>
      {/* Status bar - dark background version like in screenshot */}
      <div className="dark:bg-blue-900/20 border-t border-b border-indigo-900 p-4 px-4 sticky top-0 z-20 h-16 flex items-center transition-colors duration-300">
        <div className="max-w-3xl mx-auto flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              isAssessing ? 'bg-purple-400 animate-slow-pulse' :
              assignmentStatus === 'assigned' ? 'bg-yellow-400 animate-slow-pulse' :
              assignmentStatus === 'working' ? 'bg-blue-500 animate-slow-pulse' :
              assignmentStatus === 'submitted' ? 'bg-purple-500 animate-slow-pulse' :
              assignmentStatus === 'accepted' ? 'bg-green-500' :
              assignmentStatus === 'rejected' ? 'bg-red-500' : 'bg-gray-400'
            }`}></div>
            <span className="text-sm text-white font-medium flex items-center gap-2 transition-all duration-300">
              {isAssessing ? (
                <>
                  <SparklesIcon size={16} className="text-purple-300 transition-all duration-300" />
                  Evaluating response quality...
                </>
              ) : assignmentStatus === 'assigned' ? (
                <>
                  <ClockIcon size={16} className="text-yellow-300 transition-all duration-300" />
                  Awaiting your response
                </>
              ) : assignmentStatus === 'working' ? (
                <>
                  <UsersIcon size={16} className="text-blue-300 transition-all duration-300" />
                  Working on response
                </>
              ) : assignmentStatus === 'submitted' ? (
                <>
                  <ClockIcon size={16} className="text-purple-300 transition-all duration-300" />
                  Response submitted
                </>
              ) : assignmentStatus === 'accepted' ? (
                <>
                  <CheckCircleIcon size={16} className="text-green-300 transition-all duration-300" />
                  Response accepted
                </>
              ) : assignmentStatus === 'rejected' ? (
                <>
                  <XCircleIcon size={16} className="text-red-300 transition-all duration-300" />
                  Response rejected
                </>
              ) : (
                <>
                  <ClockIcon size={16} className="text-gray-300 transition-all duration-300" />
                  Not assigned
                </>
              )}
            </span>
          </div>
          {(assignmentStatus === 'submitted' || assignmentStatus === 'accepted' || assignmentStatus === 'rejected') && (
            <div className={`px-3 py-1 text-sm rounded-md flex items-center gap-1.5 transition-all duration-300 ${
              assignmentStatus === 'accepted' ? 'bg-green-900 text-green-100' :
              assignmentStatus === 'rejected' ? 'bg-red-900 text-red-100' :
              'bg-indigo-900 text-indigo-100'
            }`}>
              {assignmentStatus === 'accepted' ? (
                <>
                  <CheckCircleIcon size={14} />
                  Accepted
                </>
              ) : assignmentStatus === 'rejected' ? (
                <>
                  <XCircleIcon size={14} />
                  Rejected
                </>
              ) : (
                <>
                  <ClockIcon size={14} />
                  Submitted
                </>
              )}
            </div>
          )}
          {isAssessing && (
            <div className="px-3 py-1 text-sm rounded-md flex items-center gap-1.5 transition-all duration-300 bg-purple-900 text-purple-100">
              <Loader2Icon size={14} className="animate-spin" />
              Evaluating
            </div>
          )}
        </div>
      </div>

      {/* Expert Guidelines */}
      {assignmentStatus === 'working' && (
        <div className="px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-start gap-3">
              <div>
                <h4 className="font-medium text-md text-blue-700 dark:text-blue-300 mb-1">Expert Response Guidelines</h4>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm text-blue-600/90 dark:text-blue-400/90">
                  <li className="flex items-center gap-1.5">
                    <div className="size-1 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                    Be concise and accurate
                  </li>
                  <li className="flex items-center gap-1.5">
                    <div className="size-1 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                    Include relevant examples
                  </li>
                  <li className="flex items-center gap-1.5">
                    <div className="size-1 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                    Use markdown for formatting
                  </li>
                  <li className="flex items-center gap-1.5">
                    <div className="size-1 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                    Press Enter to submit
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat container */}
      <div className="flex-1 overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto flex flex-col space-y-6">
          {/* Message list */}
          <div className="flex flex-col space-y-6 pb-4">
            {/* User message - positioned at left */}
            <div className="w-full mx-auto max-w-3xl px-4 group/message" data-role="user">
              <div className="flex gap-4 max-w-2xl">
                <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
                  <div className="translate-y-px">
                    <UserIcon size={14} className="text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <div className="flex flex-col">
                  <div className="flex flex-col gap-2">
                    <div className="whitespace-pre-wrap">{userQuestion}</div>
                  </div>
                </div>
            </div>
          </div>
          
            {/* Expert response (if submitted) - positioned at right */}
            {currentAssignment && ['submitted', 'accepted', 'rejected'].includes(currentAssignment.assignment.status) && (
              <div className="w-full mx-auto max-w-3xl px-4 group/message" data-role="expert">
                <div className="flex w-full justify-end">
                  <div className="ml-auto max-w-2xl w-fit">
                    <div className="flex flex-col">
                      <div className="flex items-start gap-4 justify-end">
                        <div className="bg-primary text-primary-foreground px-3 py-2 rounded-xl">
                          <div className="whitespace-pre-wrap">
                            {currentAssignment.assignment.response}
                          </div>
                          {currentAssignment.assignment.rating && (
                            <div className="mt-2 flex items-center gap-0.5">
                              {[...Array(5)].map((_, i) => (
                                <StarIcon
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < (Number(currentAssignment.assignment.rating) || 0)
                                      ? 'text-yellow-400'
                                      : 'text-gray-300 dark:text-gray-600'
                                  }`}
                                />
                              ))}
                            </div>
                          )}
                          {currentAssignment.assignment.creditsAwarded !== null && currentAssignment.assignment.creditsAwarded !== undefined && (
                            <div className="mt-1 text-xs text-primary-foreground/80">
                              Credits Awarded: {currentAssignment.assignment.creditsAwarded}
                            </div>
                          )}
                        </div>
                        <div className="size-8 flex items-center rounded-full justify-center ring-1 shrink-0 ring-border bg-background">
                          <div className="translate-y-px">
                            <UserIcon size={14} className="text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                      </div>
                      {currentAssignment.assignment.status === 'accepted' && (
                        <div className="mt-1 px-2 py-0.5 w-fit bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs rounded-full flex items-center gap-1">
                          <CheckCircleIcon size={12} />
                          Accepted
                        </div>
                      )}
                      {currentAssignment.assignment.status === 'rejected' && (
                        <div className="mt-1 px-2 py-0.5 w-fit bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-xs rounded-full flex items-center gap-1">
                          <XCircleIcon size={12} />
                          Rejected
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quality assessment display */}
      {assessment && showAssessment && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-t border-b border-slate-200 dark:border-slate-800">
            <div className="max-w-3xl mx-auto">
            <div className="flex items-start gap-4">
              <div className="size-8 flex-shrink-0 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <SparklesIcon size={14} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">Quality Assessment</h4>
                  <div className={`px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1.5 ${
                    assessment.passesThreshold 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {assessment.passesThreshold ? (
                      <>
                        <CheckCircleIcon size={12} />
                        Passed
                      </>
                    ) : (
                      <>
                        <AlertCircleIcon size={12} />
                        Needs Improvement
                      </>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
                    {Object.entries(assessment).filter(([key]) => 
                      ['accuracy', 'completeness', 'clarity', 'helpfulness', 'conciseness'].includes(key)
                    ).map(([key, value]) => (
                      <div key={key} className="bg-white dark:bg-slate-800 rounded-lg p-2 shadow-sm">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium capitalize text-gray-700 dark:text-gray-300">{key}</span>
                          <span className={`text-xs font-bold rounded-full px-1.5 py-0.5 ${
                            (value as any).score >= 8 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            (value as any).score >= 6 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                          }`}>{(value as any).score}/10</span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">{(value as any).feedback}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="bg-white dark:bg-slate-800 rounded-lg p-3 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Assessment</span>
                      <span className={`text-sm font-bold rounded-full px-2 py-0.5 ${
                        assessment.overall.score >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                        assessment.overall.score >= 70 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                        'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>{assessment.overall.score}/100</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{assessment.overall.feedback}</p>
                    
                    {assessment.suggestions.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Suggestions for improvement:</h5>
                        <ul className="list-disc pl-4 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                          {assessment.suggestions.map((suggestion, i) => (
                            <li key={i}>{suggestion}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-3 flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowAssessment(false)}
                    className="text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Response input area */}
      {(assignmentStatus === 'assigned' || assignmentStatus === 'working') && (
        <div className="border-t border-border p-4 bg-background sticky bottom-0 left-0 right-0 shadow-md">
          <div className="max-w-3xl mx-auto">
            {assignmentStatus === 'assigned' ? (
              <div className="flex justify-center">
                <Button 
                  onClick={() => setStatus('working')}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-6 h-auto text-base font-medium"
                >
                  {isLoading ? <Loader2Icon className="h-5 w-5 animate-spin mr-2" /> : <UsersIcon className="h-5 w-5 mr-2" />}
                  i'll answer
                </Button>
      </div>
            ) : (
              <div className="relative w-full flex flex-col gap-4">
                <Textarea
                  placeholder="Write your expert response here..."
                  className="min-h-[24px] max-h-[calc(75dvh)] overflow-hidden resize-none rounded-2xl !text-base bg-muted pb-10 dark:border-zinc-700 border-blue-500"
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key === 'Enter' &&
                      !event.shiftKey &&
                      !event.nativeEvent.isComposing
                    ) {
                      event.preventDefault();
                      if (response.trim()) {
                        submitResponse();
                      }
                    }
                  }}
                  disabled={isLoading || isAssessing}
                />
                <div className="absolute bottom-0 right-0 p-2 w-fit flex flex-row items-center justify-end gap-2">
                  <Button 
                    onClick={checkResponseQuality}
                    disabled={isLoading || isAssessing || !response.trim()}
                    className="rounded-full p-2 h-8 border bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-800"
                    title="Check response quality"
                  >
                    {isAssessing ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      <SparklesIcon size={14} />
                    )}
                    <span className="sr-only">Check Quality</span>
                  </Button>
                  <Button 
                    onClick={submitResponse}
                    disabled={isLoading || isAssessing || !response.trim()}
                    className="rounded-full p-1.5 h-fit border bg-blue-500 border-blue-500 hover:bg-blue-600"
                  >
                    {isLoading ? (
                      <Loader2Icon className="h-5 w-5 animate-spin" />
                    ) : (
                      <ArrowUpIcon size={14} />
                    )}
                    <span className="sr-only">Send Response</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Thank You Modal */}
      <Dialog open={showThankYouModal} onOpenChange={setShowThankYouModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold text-green-600">Thank You!</DialogTitle>
            <DialogDescription className="text-center pt-2">
              Your expert response has been successfully submitted.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center justify-center space-y-3">
            <GiftIcon className="w-16 h-16 text-yellow-500" />
            <p className="text-lg font-medium">You earned {awardedCredits || 1} credit!</p>
            <p className="text-sm text-muted-foreground">Keep up the great work!</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowThankYouModal(false)} className="w-full bg-green-600 hover:bg-green-700">
              Awesome!
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 