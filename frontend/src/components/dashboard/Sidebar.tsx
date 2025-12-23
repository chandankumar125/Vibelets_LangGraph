import { Plus, MessageSquare, History, Clock, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

interface Thread {
    id: string;
    title: string;
    updated_at: string;
    current_step: string;
    has_product: boolean;
}

interface SidebarProps {
    threads: Thread[];
    activeThreadId: string | null;
    onThreadSelect: (threadId: string) => void;
    onThreadDelete: (threadId: string) => void;
    onNewCampaign: () => void;
    onRefresh: () => void;
    isCollapsed?: boolean;
}

export const Sidebar = ({
    threads,
    activeThreadId,
    onThreadSelect,
    onThreadDelete,
    onNewCampaign,
    onRefresh,
    isCollapsed = false
}: SidebarProps) => {

    useEffect(() => {
        onRefresh();
    }, []);

    const formatTime = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const date = new Date(dateStr);
            const now = new Date();
            const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

            if (diffInMinutes < 1) return 'Just now';
            if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

            const diffInHours = Math.floor(diffInMinutes / 60);
            if (diffInHours < 24) return `${diffInHours}h ago`;

            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } catch (e) {
            return '';
        }
    };

    return (
        <div className={cn(
            "h-full bg-slate-900 text-slate-200 flex flex-col border-r border-slate-800 shadow-xl overflow-hidden transition-all duration-300 ease-in-out",
            isCollapsed ? "w-20" : "w-64"
        )}>
            {/* Header / New Campaign */}
            <div className="p-4 border-b border-slate-800">
                <Button
                    onClick={onNewCampaign}
                    className={cn(
                        "w-full justify-start gap-2 bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700 transition-all duration-300",
                        isCollapsed && "px-0 justify-center"
                    )}
                    variant="outline"
                    title={isCollapsed ? "New Campaign" : ""}
                >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Plus className="w-4 h-4 text-primary" />
                    </div>
                    {!isCollapsed && (
                        <div className="text-left animate-in fade-in duration-500">
                            <div className="font-semibold text-xs leading-tight">New Campaign</div>
                            <div className="text-[10px] text-slate-400 font-normal">Start from scratch</div>
                        </div>
                    )}
                </Button>
            </div>

            {/* History section */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className={cn("px-4 py-3 flex items-center justify-between", isCollapsed && "justify-center px-0")}>
                    {!isCollapsed ? (
                        <div className="flex items-center gap-2 text-slate-400 uppercase text-[10px] font-bold tracking-wider animate-in slide-in-from-left-2 duration-300">
                            <History className="w-3 h-3" />
                            History
                        </div>
                    ) : (
                        <History className="w-4 h-4 text-slate-500" />
                    )}
                </div>

                <div className="flex-1 overflow-y-auto px-2 space-y-1 custom-scrollbar">
                    {threads.length === 0 ? (
                        <div className="px-4 py-8 text-center text-slate-500 text-xs italic">
                            {!isCollapsed ? "No recent campaigns" : "..."}
                        </div>
                    ) : (
                        threads.map((thread) => (
                            <div key={thread.id} className="relative group">
                                <button
                                    onClick={() => onThreadSelect(thread.id)}
                                    title={isCollapsed ? thread.title : ""}
                                    className={cn(
                                        "w-full flex items-start gap-3 p-3 rounded-xl transition-all text-left",
                                        activeThreadId === thread.id
                                            ? "bg-primary/20 text-primary ring-1 ring-primary/30"
                                            : "hover:bg-slate-800/50 text-slate-400",
                                        isCollapsed && "p-2 justify-center"
                                    )}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                        activeThreadId === thread.id ? "bg-primary/20" : "bg-slate-800 group-hover:bg-slate-700"
                                    )}>
                                        <MessageSquare className={cn(
                                            "w-4 h-4",
                                            activeThreadId === thread.id ? "text-primary" : "text-slate-500"
                                        )} />
                                    </div>
                                    {!isCollapsed && (
                                        <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300 pr-6">
                                            <div className={cn(
                                                "text-xs font-semibold truncate leading-tight",
                                                activeThreadId === thread.id ? "text-slate-100" : "text-slate-300 group-hover:text-slate-100"
                                            )}>
                                                {thread.title}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <Clock className="w-2.5 h-2.5 text-slate-500" />
                                                <span className="text-[10px] text-slate-500 font-medium">
                                                    {formatTime(thread.updated_at)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onThreadDelete(thread.id);
                                    }}
                                    className={cn(
                                        "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-500 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all duration-200",
                                        isCollapsed && "hidden"
                                    )}
                                    title="Delete Campaign"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Footer / User Profile or Settings placeholder */}
            <div className={cn(
                "p-4 border-t border-slate-800 text-[10px] text-slate-500 text-center font-medium transition-all duration-300",
                isCollapsed && "p-2 text-[8px]"
            )}>
                {!isCollapsed ? "Powered by Vibelets AI" : "VA"}
            </div>
        </div>
    );
};
