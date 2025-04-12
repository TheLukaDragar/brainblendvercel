import { Chat } from '@/lib/db/schema';
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
} from './icons';
import { memo, useEffect, useState } from 'react';
import { useChatVisibility } from '@/hooks/use-chat-visibility';
import useSWR from 'swr';
import { fetcher } from '@/lib/utils';

// Define a type for expert request statuses
type ExpertRequestStatus = 'pending' | 'in_progress' | 'completed' | null;

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibility: chat.visibility,
  });
  
  // Get expert requests for this chat to determine if it's a community chat
  const { data: expertRequests } = useSWR<Array<any>>(
    `/api/expert-requests?chatId=${chat.id}`,
    fetcher
  );
  
  // Determine status based on expert requests
  const getCommunityStatus = (): ExpertRequestStatus => {
    if (!expertRequests || expertRequests.length === 0) return null;
    
    // Check if all are completed
    if (expertRequests.every(req => req.status === 'completed')) {
      return 'completed';
    }
    
    // Check if any are in progress
    if (expertRequests.some(req => req.status === 'in_progress')) {
      return 'in_progress';
    }
    
    return 'pending';
  };
  
  const communityStatus = getCommunityStatus();
  
  // Get color for the status indicator
  const getStatusColor = (status: ExpertRequestStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500 shadow-yellow-500/50';
      case 'in_progress':
        return 'bg-blue-500 shadow-blue-500/50';
      case 'completed':
        return 'bg-green-500 shadow-green-500/50';
      default:
        return '';
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link href={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)}>
          <div className="flex items-center justify-between w-full">
            <span>{chat.title}</span>
            {communityStatus && (
              <div 
                className={`h-1.5 w-1.5 rounded-full ml-2 shadow-sm ${getStatusColor(communityStatus)}`} 
                title={`Community chat: ${communityStatus.replace('_', ' ')}`}
              />
            )}
          </div>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground mr-0.5"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="bottom" align="end">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <ShareIcon />
              <span>Share</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={() => {
                    setVisibilityType('private');
                  }}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <LockIcon size={12} />
                    <span>Private</span>
                  </div>
                  {visibilityType === 'private' ? (
                    <CheckCircleFillIcon />
                  ) : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={() => {
                    setVisibilityType('public');
                  }}
                >
                  <div className="flex flex-row gap-2 items-center">
                    <GlobeIcon />
                    <span>Public</span>
                  </div>
                  {visibilityType === 'public' ? <CheckCircleFillIcon /> : null}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="cursor-pointer text-destructive focus:bg-destructive/15 focus:text-destructive dark:text-red-500"
            onSelect={() => onDelete(chat.id)}
          >
            <TrashIcon />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) return false;
  return true;
});
