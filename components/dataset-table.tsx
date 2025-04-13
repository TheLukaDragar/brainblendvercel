'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, formatDate } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Search, Users, User, } from 'lucide-react';

type DatasetEntry = {
  assignment: {
    id: string;
    expertRequestId: string;
    expertId: string;
    status: string;
    response: string;
    createdAt: string;
    updatedAt: string;
  };
  request: {
    id: string;
    chatId: string;
    title: string;
    question: string;
    status: string;
    createdAt: string;
    assignedExpertsCount?: number;
    submittedExpertsCount?: number;
  };
  expert: {
    id: string;
    email: string;
    expertise: string;
    expertiseTags: string[];
  };
};

export function DatasetTable() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: dataset, error, isLoading } = useSWR<DatasetEntry[]>(
    '/api/dataset',
    fetcher
  );

  // Filter data based on search query
  const filteredData = dataset?.filter((entry) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      entry.request.title?.toLowerCase().includes(searchLower) ||
      entry.request.question.toLowerCase().includes(searchLower) ||
      entry.assignment.response?.toLowerCase().includes(searchLower) ||
      entry.expert.email.toLowerCase().includes(searchLower) ||
      entry.expert.expertiseTags?.some(tag => 
        tag.toLowerCase().includes(searchLower)
      )
    );
  });

  const handleViewChat = (chatId: string) => {
    router.push(`/chat/${chatId}`);
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error</CardTitle>
          <CardDescription>Failed to load dataset</CardDescription>
        </CardHeader>
        <CardContent>
          <p>An error occurred while loading the dataset. Please try again.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Community Dataset</h2>
        <div className="relative w-80">
          <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search dataset..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Title</TableHead>
              <TableHead className="w-[300px]">Question</TableHead>
              <TableHead className="w-[400px]">Answer</TableHead>
              <TableHead>Expert</TableHead>
              <TableHead>Responses</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-12 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-12 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-12 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-12 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-12 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-12 w-24" /></TableCell>
                </TableRow>
              ))
            ) : filteredData && filteredData.length > 0 ? (
              filteredData.map((entry) => (
                <TableRow 
                  key={entry.assignment.id}
                  className="hover:bg-muted/50"
                >
                  <TableCell className="font-medium py-5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="max-w-[200px] text-base line-clamp-2">
                            {entry.request.title || 'Untitled'}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-sm">
                          <p>{entry.request.title || 'Untitled'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="py-5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="max-w-[300px] text-base line-clamp-2">
                            {entry.request.question}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="max-w-md p-4">
                          <p className="whitespace-pre-wrap">{entry.request.question}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="py-5">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="max-w-[400px] text-base line-clamp-3">
                            {entry.assignment.response}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-md p-4">
                          <p className="whitespace-pre-wrap">{entry.assignment.response}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex items-center gap-2">
                      <User className="size-4 text-blue-600" />
                      <span className="truncate max-w-[140px] text-base">
                        {entry.expert.email.split('@')[0]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5">
                    <div className="flex items-center gap-1">
                      <Users className="size-4 text-blue-600" />
                      <span className="text-base font-medium">
                        {entry.request.submittedExpertsCount || 1}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-5 text-base">{formatDate(entry.assignment.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  {searchQuery ? 'No results found.' : 'No data available.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 