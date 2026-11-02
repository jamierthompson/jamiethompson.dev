import { useChat } from "@ai-sdk/react";
import type { AiSdkChat } from "@shadcn/helpers/ai-sdk";
import {
  type ChatStatus,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useEffect, useRef, useState } from "react";
import { type DemoMessage, tap, type WireEntry } from "./script";

export type Transition = { status: ChatStatus; at: number };

/**
 * One scripted conversation driven through the real `useChat`, with the
 * instrument readings every island shares: the status and its transitions,
 * the latest assistant message, the wire, and the two values the composer
 * derives.
 */
export function useTurn(
  script: AiSdkChat<DemoMessage>,
  options: { autoContinue?: boolean; wire?: boolean } = {},
) {
  const [wire, setWire] = useState<WireEntry[]>([]);
  const [transport] = useState(() => {
    const base = script.transport({ delayMs: 24 });
    return options.wire
      ? tap(base, (entry) => setWire((log) => [...log, entry]))
      : base;
  });

  const autoContinue = options.autoContinue ?? true;
  const autoContinueRef = useRef(autoContinue);
  autoContinueRef.current = autoContinue;

  const chat = useChat<DemoMessage>({
    messages: script.get(0),
    transport,
    sendAutomaticallyWhen: (args) =>
      autoContinueRef.current &&
      lastAssistantMessageIsCompleteWithApprovalResponses(args),
  });
  const { messages, status, setMessages, clearError } = chat;

  const [transitions, setTransitions] = useState<Transition[]>([]);
  useEffect(() => {
    setTransitions((log) => [...log.slice(-7), { status, at: Date.now() }]);
  }, [status]);

  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const lastAssistant = last?.role === "assistant" ? last : undefined;
  const awaitingApproval =
    lastAssistant?.parts.some(
      (part) => isToolUIPart(part) && part.state === "approval-requested",
    ) ?? false;
  const canContinue =
    !busy &&
    (lastAssistant?.parts.some(
      (part) => isToolUIPart(part) && part.state === "approval-responded",
    ) ??
      false);

  const nextMessage = script.next(messages);

  function sendNext() {
    if (nextMessage && !busy) void chat.sendMessage(nextMessage);
  }

  function reset() {
    setMessages(script.get(0));
    clearError();
    setWire([]);
    setTransitions([]);
  }

  return {
    ...chat,
    busy,
    showStop: busy,
    awaitingApproval,
    canContinue,
    lastAssistant,
    nextMessage,
    sendNext,
    reset,
    wire,
    transitions,
  };
}
