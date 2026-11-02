import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Arrowhead, Edge, Label, Node } from "./diagram";
import { Composer, Frame, MiniThread, TransitionLog } from "./primitives";
import { messageText, statusScript } from "./script";
import { useTurn } from "./useTurn";

/**
 * The coarse machine as a diagram, lit by the real `status` of a scripted
 * turn. Send runs a normal turn; the second scripted message fails partway,
 * so the error edge gets walked too.
 */
export function StatusMachine() {
  const [script] = useState(statusScript);
  const turn = useTurn(script);
  const { status, busy, messages, nextMessage, transitions } = turn;

  return (
    <Frame label="status, live" onReset={turn.reset} resetDisabled={busy}>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 520 204"
          role="img"
          aria-label={`The four values of status and the transitions between them. Current: ${status}.`}
          className="w-full min-w-[30rem]"
        >
          <Arrowhead id="arrow-status" />
          {/* ready → submitted → streaming, left to right */}
          <Edge d="M100 80 H203" marker="arrow-status" />
          <Label x={152} y={70}>
            sendMessage()
          </Label>
          <Edge d="M296 80 H383" marker="arrow-status" />
          <Label x={340} y={70}>
            first part written
          </Label>
          {/* streaming → ready, over the top */}
          <Edge d="M430 66 C430 14 70 14 70 66" marker="arrow-status" />
          <Label x={250} y={24}>
            stream ends: finish, or stop()
          </Label>
          {/* submitted → ready, underneath */}
          <Edge d="M250 94 C250 134 70 134 70 94" marker="arrow-status" />
          <Label x={160} y={140}>
            stop() before a chunk
          </Label>
          {/* throws */}
          <Edge d="M262 94 L322 156" marker="arrow-status" />
          <Edge d="M418 94 L358 156" marker="arrow-status" />
          <Label x={340} y={128}>
            throws
          </Label>
          {/* error → ready */}
          <Edge d="M310 172 C200 172 70 172 70 96" marker="arrow-status" />
          <Label x={200} y={186}>
            clearError(), or send again
          </Label>
          <Node x={70} y={80} label="ready" active={status === "ready"} />
          <Node
            x={250}
            y={80}
            label="submitted"
            active={status === "submitted"}
          />
          <Node
            x={430}
            y={80}
            label="streaming"
            active={status === "streaming"}
          />
          <Node x={340} y={170} label="error" active={status === "error"} />
        </svg>
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="flex flex-col gap-3">
          <MiniThread
            messages={messages}
            busy={busy}
            onApproval={turn.addToolApprovalResponse}
          />
          {turn.error && (
            <div className="flex items-center justify-between gap-3 rounded-md border border-destructive/40 px-3 py-2">
              <span className="truncate">{turn.error.message}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => turn.clearError()}
              >
                clearError()
              </Button>
            </div>
          )}
          <Composer
            nextText={nextMessage ? messageText(nextMessage) : undefined}
            busy={busy}
            canSend={Boolean(nextMessage) && status !== "error"}
            onSend={turn.sendNext}
            onStop={() => turn.stop()}
          />
        </div>
        <TransitionLog transitions={transitions} />
      </div>
    </Frame>
  );
}
