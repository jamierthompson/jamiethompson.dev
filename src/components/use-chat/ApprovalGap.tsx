import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Composer, Flags, Frame, MiniThread, StatusPills } from "./primitives";
import { fullTurn, messageText } from "./script";
import { useTurn } from "./useTurn";

/**
 * The gap: a composer that derives Send and Stop from `status` alone, next to
 * the one value it would need from the parts. Untick the box to see that
 * nothing resumes until the app calls `sendMessage()` with no arguments.
 */
export function ApprovalGap() {
  const [script] = useState(fullTurn);
  const [autoContinue, setAutoContinue] = useState(true);
  const turn = useTurn(script, { autoContinue });
  const {
    status,
    busy,
    messages,
    nextMessage,
    showStop,
    awaitingApproval,
    canContinue,
  } = turn;

  return (
    <Frame label="the composer, live" onReset={turn.reset} resetDisabled={busy}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <MiniThread
          messages={messages}
          busy={busy}
          onApproval={turn.addToolApprovalResponse}
        />
        <div className="flex flex-col gap-3">
          <StatusPills status={status} />
          <Flags
            items={[
              ["showStop", showStop],
              ["awaitingApproval", awaitingApproval],
            ]}
          />
        </div>
      </div>
      {canContinue && !autoContinue && (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <span>
            Answered. Nothing happens until the app continues the turn.
          </span>
          <Button size="sm" onClick={() => turn.sendMessage()}>
            sendMessage()
          </Button>
        </div>
      )}
      <Composer
        nextText={nextMessage ? messageText(nextMessage) : undefined}
        busy={busy}
        awaiting={turn.awaitingApproval}
        canSend={Boolean(nextMessage)}
        onSend={turn.sendNext}
        onStop={() => turn.stop()}
      >
        <label className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={autoContinue}
            onChange={(event) => setAutoContinue(event.target.checked)}
            className="accent-foreground"
          />
          sendAutomaticallyWhen
        </label>
      </Composer>
    </Frame>
  );
}
