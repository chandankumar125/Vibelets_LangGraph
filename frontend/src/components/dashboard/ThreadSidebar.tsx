import { useEffect, useState } from "react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarGroupContent,
    SidebarMenuAction,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Plus, MessageSquare, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { vibeletsAPI } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Thread {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

interface ThreadSidebarProps {
    currentThreadId: string | null;
    onSelectThread: (threadId: string) => void;
    onNewThread: () => void;
}

export function ThreadSidebar({ currentThreadId, onSelectThread, onNewThread }: ThreadSidebarProps) {
    const [threads, setThreads] = useState<Thread[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchThreads = async () => {
        try {
            setIsLoading(true);
            const data = await vibeletsAPI.getThreads();
            // Sort threads by updated_at descending
            const sortedThreads = (data.threads || []).sort(
                (a: Thread, b: Thread) => {
                    const bDate = new Date(b.updated_at).getTime();
                    const aDate = new Date(a.updated_at).getTime();
                    // Handle invalid dates - put them at the end
                    if (isNaN(bDate)) return 1;
                    if (isNaN(aDate)) return -1;
                    return bDate - aDate;
                }
            );
            setThreads(sortedThreads);
        } catch (error) {
            console.error("Failed to fetch threads:", error);
            toast.error("Failed to load conversation history");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchThreads();
    }, [currentThreadId]); // Refresh when current thread changes (e.g. title update)

    const handleDeleteThread = async (e: React.MouseEvent, threadId: string) => {
        e.stopPropagation();
        try {
            await vibeletsAPI.deleteThread(threadId);
            setThreads((prev) => prev.filter((t) => t.id !== threadId));
            if (currentThreadId === threadId) {
                onNewThread();
            }
            toast.success("Conversation deleted");
        } catch (error) {
            console.error("Failed to delete thread:", error);
            toast.error("Failed to delete conversation");
        }
    };

    return (
        <Sidebar collapsible="icon">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                            onClick={onNewThread}
                        >
                            <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                                <Plus className="size-4" />
                            </div>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-semibold">New Campaign</span>
                                <span className="truncate text-xs">Start from scratch</span>
                            </div>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>History</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {isLoading && threads.length === 0 ? (
                                <div className="flex items-center justify-center p-4">
                                    <Loader2 className="animate-spin h-4 w-4 text-muted-foreground" />
                                </div>
                            ) : threads.length === 0 ? (
                                <div className="p-4 text-sm text-muted-foreground text-center">
                                    No previous campaigns
                                </div>
                            ) : (
                                threads.map((thread) => {
                                    // Format the date safely
                                    let timeText = "recently";
                                    const updatedDate = new Date(thread.updated_at);
                                    if (!isNaN(updatedDate.getTime())) {
                                        try {
                                            timeText = formatDistanceToNow(updatedDate, { addSuffix: true })
                                                .replace("about ", "")
                                                .replace(" ago", "");
                                        } catch (e) {
                                            timeText = "recently";
                                        }
                                    }
                                    
                                    return (
                                        <SidebarMenuItem key={thread.id}>
                                            <SidebarMenuButton
                                                onClick={() => onSelectThread(thread.id)}
                                                isActive={currentThreadId === thread.id}
                                                className="group/item"
                                                tooltip={thread.title || "Untitled Campaign"}
                                            >
                                                <MessageSquare className="mr-2 h-4 w-4 opacity-50" />
                                                <span className="truncate font-medium">{thread.title || "Untitled Campaign"}</span>
                                                <span className="ml-auto text-xs text-muted-foreground opacity-50">
                                                    {timeText}
                                                </span>
                                            </SidebarMenuButton>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <SidebarMenuAction showOnHover>
                                                        <MoreHorizontal />
                                                        <span className="sr-only">More</span>
                                                    </SidebarMenuAction>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent className="w-48" side="right" align="start">
                                                    <DropdownMenuItem onClick={(e) => handleDeleteThread(e as any, thread.id)}>
                                                        <Trash2 className="text-muted-foreground mr-2 h-4 w-4" />
                                                        <span>Delete Campaign</span>
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </SidebarMenuItem>
                                    );
                                })
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
                {/* User profile could go here */}
            </SidebarFooter>
        </Sidebar>
    );
}
