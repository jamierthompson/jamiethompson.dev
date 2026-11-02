import { useState } from "react";
import {
  Composer,
  Frame,
  MiniThread,
  PartsList,
  StatusPills,
  WireLog,
} from "./primitives";
import { fullTurn, messageText } from "./script";
import { useTurn } from "./useTurn";

/**
 * The wire and what it writes, side by side: every chunk as the transport
 * hands it over, and the status and parts it changes.
 */
export function WireReplay() {
  const [script] = useState(fullTurn);
  const turn = useTurn(script, { wire: true });
  const { status, busy, messages, nextMessage, lastAssistant, wire } = turn;

  return (
    <Frame label="the wire, live" onReset={turn.reset} resetDisabled={busy}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">chunks, in order</p>
          <WireLog entries={wire} />
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">status</p>
            <StatusPills status={status} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              parts of the last assistant message
            </p>
            <PartsList message={lastAssistant} />
          </div>
        </div>
      </div>
      <MiniThread
        messages={messages}
        busy={busy}
        onApproval={turn.addToolApprovalResponse}
      />
      <Composer
        nextText={nextMessage ? messageText(nextMessage) : undefined}
        busy={busy}
        awaiting={turn.awaitingApproval}
        canSend={Boolean(nextMessage)}
        onSend={turn.sendNext}
        onStop={() => turn.stop()}
      />
    </Frame>
  );
}
