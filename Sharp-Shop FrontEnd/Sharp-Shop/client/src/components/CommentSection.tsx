import { useState } from "react";
import { Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { getGuestId, getGuestName } from "@/lib/guest";
import { promptLogin } from "@/lib/auth-prompt";

interface Comment {
  id: string;
  productId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  content: string;
  emojiReaction?: string;
  createdAt: string;
}

const EMOJIS = ["❤️", "😍", "😂", "😭", "🔥", "🙏", "😊"];

// Postgres text timestamps ("2026-07-01 12:34:56") aren't parseable by
// new Date() in all browsers; normalize and never let a bad date crash the UI.
function formatCommentTime(raw: string): string {
  if (!raw) return "";
  let date = new Date(raw);
  if (isNaN(date.getTime())) {
    date = new Date(raw.replace(" ", "T") + "Z");
  }
  if (isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true });
}

interface CommentSectionProps {
  children?: React.ReactNode;
  trigger?: (count: number) => React.ReactNode;
  productId: string;
}

export function CommentSection({ children, trigger, productId }: CommentSectionProps) {
  const [open, setOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const userId = user?.id || getGuestId();
  const userName = user?.username || getGuestName();

  // One shared request serves every card's comment-count badge.
  // Realtime invalidation is handled centrally in use-realtime-sync.
  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ["comments", "counts"],
    queryFn: async () => {
      const res = await fetch("/api/comments/counts");
      if (!res.ok) return {};
      return res.json();
    },
  });
  const commentCount = counts[productId] ?? 0;

  // Full comment list is only fetched when the drawer is actually opened
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['comments', productId],
    queryFn: async () => {
      const res = await fetch(`/api/comments/${productId}`);
      if (!res.ok) throw new Error('Failed to fetch comments');
      return res.json() as Promise<Comment[]>;
    },
    enabled: open,
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          userId,
          userName,
          userAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
          content,
        }),
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', productId] });
      queryClient.invalidateQueries({ queryKey: ['comments', 'counts'] });
      setNewComment("");
    },
  });

  const handleAddComment = () => {
    // Guests can read comments but must sign in to post
    if (!user) {
      promptLogin();
      return;
    }
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger ? trigger(commentCount) : children}</DrawerTrigger>
      <DrawerContent className="h-[75vh] bg-[#121212] border-t border-white/10 text-white">
        <DrawerHeader className="border-b border-white/10 pb-4 pt-2">
          <div className="flex items-center justify-center">
            <DrawerTitle className="text-center text-sm">
              Comments
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-6">
            {isLoading ? (
              <div className="text-center text-white/50 py-8">Loading comments...</div>
            ) : comments.length === 0 ? (
              <div className="text-center text-white/50 py-8">
                No comments yet. Be the first to comment!
              </div>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <Avatar className="h-8 w-8 border-none">
                    <AvatarImage src={comment.userAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${comment.userId}`} />
                    <AvatarFallback>{comment.userName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-white/90">
                        {comment.userName}
                      </span>
                      <span className="text-[10px] text-white/50">
                        {formatCommentTime(comment.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-white/90 leading-snug">
                      {comment.content}
                    </p>
                  </div>
                  {comment.emojiReaction && (
                    <div className="text-lg">
                      {comment.emojiReaction}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-white/10 bg-[#121212]">
          <div className="flex justify-between mb-3 px-2">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => (user ? setNewComment((prev) => prev + emoji) : promptLogin())}
                className="text-2xl hover:scale-110 transition-transform"
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8 border-none">
              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`} />
              <AvatarFallback>{userName[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onClick={() => !user && promptLogin()}
                readOnly={!user}
                placeholder={user ? "Add a comment..." : "Log in to comment..."}
                className="bg-white/10 border-none text-white placeholder:text-white/50 pr-10 h-10 rounded-full focus-visible:ring-1 focus-visible:ring-white/20"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddComment();
                }}
                disabled={addCommentMutation.isPending}
              />
            </div>
            {newComment && (
              <Button
                size="icon"
                onClick={handleAddComment}
                disabled={addCommentMutation.isPending}
                className="h-10 w-10 rounded-full bg-primary text-white hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
