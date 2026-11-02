import type { ChatStatus } from "ai";
import {
  CircleCheckIcon,
  CloudSunIcon,
  LoaderCircleIcon,
  RotateCwIcon,
  Trash2Icon,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from "@/components/ui/trace";
import {
  type DemoMessage,
  type DemoToolPart,
  messageText,
  type WireEntry,
} from "./script";
import type { Transition } from "./useTurn";

const STATUSES: ChatStatus[] = ["ready", "submitted", "streaming", "error"];

/** The box every island sits in, outside the prose styles. */
export function Frame({
  label,
  onReset,
  resetDisabled,
  children,
}: {
  label: string;
  onReset?: () => void;
  resetDisabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="not-prose my-8 flex flex-col gap-4 rounded-xl border bg-card p-4 text-sm text-card-foreground sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {label}
        </p>
        {onReset && (
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="Reset"
            disabled={resetDisabled}
            onClick={onReset}
          >
            <RotateCwIcon />
          </Button>
        )}
      </div>
      {children}
    </div>
  );
}

export function StatusPills({ status }: { status: ChatStatus }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-status={status}>
      {STATUSES.map((value) => (
        <Badge
          key={value}
          variant={value === status ? "default" : "outline"}
          className="font-mono"
        >
          {value}
        </Badge>
      ))}
    </div>
  );
}

export function Flags({ items }: { items: [string, boolean][] }) {
  return (
    <dl className="flex flex-col gap-1 rounded-md border bg-background p-3 font-mono text-xs">
      {items.map(([name, value]) => (
        <div key={name} className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">{name}</dt>
          <dd data-value={value}>{String(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TransitionLog({ transitions }: { transitions: Transition[] }) {
  // The first entry is the initial status; every later one shows the time since the one before.
  return (
    <ol className="flex flex-col gap-0.5 font-mono text-xs text-muted-foreground">
      {transitions.map((transition, index) => {
        const previous = transitions[index - 1];
        return (
          <li key={transition.at} className="flex justify-between gap-3">
            <span>
              {previous ? `${previous.status} → ` : ""}
              <span className="text-foreground">{transition.status}</span>
            </span>
            {previous && previous.status !== "ready" && (
              <span className="tabular-nums">
                +{transition.at - previous.at}ms
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function partState(part: DemoMessage["parts"][number]) {
  return "state" in part && part.state ? part.state : "";
}

function partDetail(part: DemoMessage["parts"][number]) {
  if (part.type === "text" || part.type === "reasoning")
    return `${part.text.length} chars`;
  if (part.type === "tool-getWeather" || part.type === "tool-deleteFile") {
    if (part.approval && "approved" in part.approval) {
      return `approved: ${String(part.approval.approved)}`;
    }
  }
  return "";
}

export function PartsList({ message }: { message: DemoMessage | undefined }) {
  if (!message) {
    return (
      <p className="text-xs text-muted-foreground">
        No assistant message yet, so there is no part to ask. Only{" "}
        <code>status</code> knows a turn has started.
      </p>
    );
  }
  return (
    <ol className="flex flex-col gap-1 font-mono text-xs">
      {message.parts.map((part, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: parts have no id; order is stable
        <li
          key={index}
          className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-2"
        >
          <span className="text-muted-foreground">{index}</span>
          <span className="truncate">
            {part.type}
            <span className="text-muted-foreground"> {partDetail(part)}</span>
          </span>
          {partState(part) ? (
            <Badge variant="secondary" className="font-mono">
              {partState(part)}
            </Badge>
          ) : (
            <span />
          )}
        </li>
      ))}
    </ol>
  );
}

function chunkDetail(chunk: Extract<WireEntry, { kind: "chunk" }>["chunk"]) {
  switch (chunk.type) {
    case "text-delta":
    case "reasoning-delta":
      return JSON.stringify(chunk.delta.slice(0, 18));
    case "tool-input-start":
      return chunk.toolName;
    case "tool-input-available":
      return `${chunk.toolName} ${JSON.stringify(chunk.input)}`;
    case "tool-output-available":
      return JSON.stringify(chunk.output).slice(0, 36);
    case "error":
      return chunk.errorText;
    default:
      return "";
  }
}

export function WireLog({ entries }: { entries: WireEntry[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const list = listRef.current;
    if (list && entries.length) list.scrollTop = list.scrollHeight;
  }, [entries.length]);

  return (
    <ol
      ref={listRef}
      aria-label="Chunks received"
      className="flex h-72 flex-col gap-0.5 overflow-y-auto rounded-md border bg-background p-3 font-mono text-xs"
    >
      {entries.length === 0 && (
        <li className="text-muted-foreground">Nothing sent yet.</li>
      )}
      {entries.map((entry) => {
        if (entry.kind === "request") {
          return (
            <li
              key={entry.at}
              className="mt-2 border-t pt-2 text-muted-foreground first:mt-0 first:border-t-0 first:pt-0"
            >
              request
            </li>
          );
        }
        if (entry.kind === "close") {
          return (
            <li key={entry.at} className="text-muted-foreground">
              stream closed
            </li>
          );
        }
        return (
          <li
            key={`${entry.at}-${entry.chunk.type}`}
            className="grid grid-cols-[auto_1fr] gap-2"
          >
            <span>{entry.chunk.type}</span>
            <span className="truncate text-muted-foreground">
              {chunkDetail(entry.chunk)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

type Approve = (response: { id: string; approved: boolean }) => void;

/** A thread small enough to sit inside a post, rendered by `part.type` then `part.state`. */
export function MiniThread({
  messages,
  busy,
  onApproval,
}: {
  messages: DemoMessage[];
  busy: boolean;
  onApproval: Approve;
}) {
  const last = messages.at(-1);
  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) =>
        message.role === "user" ? (
          <div key={message.id} className="flex justify-end">
            <div className="max-w-[85%] rounded-xl bg-muted px-3 py-2 leading-relaxed">
              {messageText(message)}
            </div>
          </div>
        ) : (
          <div key={message.id} className="flex flex-col gap-2">
            {message.parts.map((part, index) => {
              const key = `${message.id}-${index}`;
              if (part.type === "text") {
                return (
                  <p
                    key={key}
                    data-state={part.state}
                    className="leading-relaxed whitespace-pre-wrap data-[state=streaming]:after:ml-0.5 data-[state=streaming]:after:inline-block data-[state=streaming]:after:h-[1em] data-[state=streaming]:after:w-[0.5em] data-[state=streaming]:after:translate-y-[0.15em] data-[state=streaming]:after:animate-pulse data-[state=streaming]:after:bg-foreground data-[state=streaming]:after:content-['']"
                  >
                    {part.text}
                  </p>
                );
              }
              if (part.type === "reasoning") {
                return (
                  <Trace key={key}>
                    <ReasoningLine
                      text={part.text}
                      running={part.state === "streaming"}
                    />
                  </Trace>
                );
              }
              if (
                part.type === "tool-getWeather" ||
                part.type === "tool-deleteFile"
              ) {
                return (
                  <ToolBlock
                    key={part.toolCallId}
                    part={part}
                    streaming={busy && message === last}
                    onApproval={onApproval}
                  />
                );
              }
              return null;
            })}
          </div>
        ),
      )}
      {busy && last?.role === "user" && (
        <Trace>
          <TraceLine status="running">
            <TraceTitle>Waiting for the first chunk</TraceTitle>
          </TraceLine>
        </Trace>
      )}
    </div>
  );
}

function ReasoningLine({ text, running }: { text: string; running: boolean }) {
  const [open, setOpen] = useState<boolean>();
  const line = (
    <TraceLine status={running ? "running" : undefined}>
      <TraceIcon>
        {running ? (
          <LoaderCircleIcon className="animate-spin" />
        ) : (
          <CircleCheckIcon />
        )}
      </TraceIcon>
      <TraceTitle>{running ? "Thinking" : "Thought"}</TraceTitle>
    </TraceLine>
  );
  if (text.length === 0) return line;
  return (
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="whitespace-pre-wrap">
        {text}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  );
}

function labelFor(part: DemoToolPart) {
  if (part.type === "tool-getWeather") {
    const city = part.input?.city;
    return {
      icon: <CloudSunIcon />,
      doing: city ? `Checking weather in ${city}` : "Checking weather",
      done: city ? `Checked weather in ${city}` : "Checked weather",
      object: city ? `weather in ${city}` : "weather",
    };
  }
  const path = part.input?.path ?? "a file";
  return {
    icon: <Trash2Icon />,
    doing: `Deleting ${path}`,
    done: `Deleted ${path}`,
    object: path,
  };
}

export function ToolBlock({
  part,
  streaming,
  onApproval,
}: {
  part: DemoToolPart;
  streaming: boolean;
  onApproval: Approve;
}) {
  const { icon, doing, done, object } = labelFor(part);

  // A pending approval is a question for the person, not a step the agent took.
  if (part.state === "approval-requested") {
    return (
      <Item variant="outline" size="sm">
        <ItemMedia variant="icon">{icon}</ItemMedia>
        <ItemContent>
          <ItemTitle>Delete {object}?</ItemTitle>
          <ItemDescription>
            The stream has closed. Status is back at ready.
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              onApproval({ id: part.approval.id, approved: false })
            }
          >
            Deny
          </Button>
          <Button
            size="sm"
            onClick={() => onApproval({ id: part.approval.id, approved: true })}
          >
            Approve
          </Button>
        </ItemActions>
      </Item>
    );
  }

  const denied =
    part.state === "output-denied" ||
    (part.state === "approval-responded" && !part.approval.approved);
  const failed = part.state === "output-error";
  const finished = part.state === "output-available";
  const running = !denied && !failed && !finished && streaming;
  const title = denied
    ? `Denied: ${object}`
    : failed
      ? `Failed: ${object}`
      : finished
        ? done
        : running
          ? doing
          : `Waiting: ${object}`;
  const output = finished
    ? JSON.stringify(part.output)
    : failed
      ? part.errorText
      : undefined;
  const line = (
    <TraceLine status={failed ? "error" : running ? "running" : undefined}>
      <TraceIcon>{icon}</TraceIcon>
      <TraceTitle>{title}</TraceTitle>
    </TraceLine>
  );
  return (
    <Trace>
      {output ? (
        <TraceCollapsible>
          <TraceCollapsibleTrigger>{line}</TraceCollapsibleTrigger>
          <TraceCollapsibleContent className="font-mono text-xs">
            {output}
          </TraceCollapsibleContent>
        </TraceCollapsible>
      ) : (
        line
      )}
    </Trace>
  );
}

/** The island's composer stand-in: the next scripted message and the one primary control. */
export function Composer({
  nextText,
  busy,
  awaiting = false,
  canSend,
  onSend,
  onStop,
  children,
}: {
  nextText: string | undefined;
  busy: boolean;
  awaiting?: boolean;
  canSend: boolean;
  onSend: () => void;
  onStop: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-background p-2">
      <p className="px-1 py-1 text-muted-foreground" aria-live="polite">
        {nextText ??
          (awaiting
            ? "Waiting on the decision above."
            : "The script is finished. Reset to play it again.")}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {children}
        {busy ? (
          <Button size="sm" className="ml-auto" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            className="ml-auto"
            disabled={!canSend}
            onClick={onSend}
          >
            Send
          </Button>
        )}
      </div>
    </div>
  );
}
