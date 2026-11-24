"use client";

import { useEffect, useMemo, useRef } from "react";
import { Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { ChatMessage } from "./types";

type ChatPanelProps = {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  authed: boolean;
  savedCount: number;
  hasActiveItinerary: boolean;
  onInputChange: (value: string) => void;
  onSend: (overrideText?: string) => void;
  onClose?: () => void;
};

export function ChatPanel({
  messages,
  input,
  loading,
  authed,
  savedCount,
  hasActiveItinerary,
  onInputChange,
  onSend,
  onClose,
}: ChatPanelProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages.length === 0 && !loading) return;
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, loading]);

  const starterPrompts = useMemo(() => {
    const prompts = ["Explore Kyoto", "Attractions in Toronto"];
    if (authed && savedCount > 0) {
      if (hasActiveItinerary) {
        prompts.push("Fill my itinerary", "Shuffle my itinerary");
      } else {
        prompts.push("Plan a 3-day trip with my saved places");
      }
    }
    return prompts;
  }, [authed, savedCount, hasActiveItinerary]);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={14} className="text-primary" />
          Assistant
        </p>
        {onClose ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close assistant"
          >
            <X size={14} />
          </Button>
        ) : null}
      </div>
      <Separator />

      {/* Message list */}
      <div ref={listRef} className="my-3 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              Ask me to discover a city, create a trip, or arrange your saved places into a schedule.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={loading}
                  onClick={() => onSend(prompt)}
                  className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-left text-xs text-foreground transition-colors hover:border-primary/50 hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-snug ${
                m.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : m.isError
                  ? "self-start border border-destructive/30 bg-destructive/10 text-destructive"
                  : "self-start bg-muted text-foreground"
              }`}
            >
              {m.content}
            </div>
          ))
        )}

        {loading ? (
          <div className="self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Thinking…
          </div>
        ) : null}
      </div>

      <Separator />

      {/* Input row */}
      <div className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Ask about a city or trip…"
          className="text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
        />
        <Button
          type="button"
          disabled={!input.trim() || loading}
          onClick={() => onSend()}
        >
          Send
        </Button>
      </div>
    </div>
  );
}
