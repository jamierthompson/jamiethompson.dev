import { useState } from "react";
import { Arrowhead, Edge, Label, Node, RowLabel } from "./diagram";
import { Composer, Frame, MiniThread } from "./primitives";
import { fullTurn, messageText } from "./script";
import { useTurn } from "./useTurn";

/**
 * The fine machine: the states a text or reasoning part and a tool part walk
 * through, lit by the parts of the latest assistant message as a scripted
 * turn plays. The delete tool needs approval, so the detour gets walked.
 */
export function PartLifecycle() {
  const [script] = useState(fullTurn);
  const turn = useTurn(script);
  const { busy, messages, nextMessage, lastAssistant } = turn;

  const lit = new Set<string>();
  for (const part of lastAssistant?.parts ?? []) {
    if (part.type === "text" || part.type === "reasoning")
      lit.add(`a:${part.state}`);
    if (part.type === "tool-getWeather" || part.type === "tool-deleteFile") {
      lit.add(`b:${part.state}`);
    }
  }
  const on = (key: string) => lit.has(key);

  return (
    <Frame label="part states, live" onReset={turn.reset} resetDisabled={busy}>
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 820 300"
          role="img"
          aria-label="The states of a text or reasoning part, and of a tool part, including the approval detour."
          className="w-full min-w-[40rem]"
        >
          <Arrowhead id="arrow-parts" />
          <RowLabel x={8} y={44}>
            text, reasoning
          </RowLabel>
          <RowLabel x={8} y={124}>
            tool-&lt;name&gt;
          </RowLabel>
          <RowLabel x={8} y={264}>
            with approval
          </RowLabel>

          <Edge d="M245 40 H311" marker="arrow-parts" />

          <Edge d="M268 120 H321" marker="arrow-parts" />
          <Edge d="M458 120 H548" marker="arrow-parts" />
          <Label x={503} y={110}>
            ran
          </Label>
          <Edge d="M440 134 C480 190 520 190 562 190" marker="arrow-parts" />
          <Label x={505} y={178}>
            threw
          </Label>
          <Edge d="M390 134 V244" marker="arrow-parts" />
          <Label x={398} y={192} anchor="start">
            needs a decision
          </Label>
          <Edge d="M468 260 H505" marker="arrow-parts" />
          <Edge d="M640 246 C650 200 620 170 620 134" marker="arrow-parts" />
          <Label x={662} y={232} anchor="start">
            approved
          </Label>
          <Edge d="M664 260 H683" marker="arrow-parts" />

          <Node x={200} y={40} label="streaming" active={on("a:streaming")} />
          <Node x={340} y={40} label="done" active={on("a:done")} />
          <Node
            x={200}
            y={120}
            label="input-streaming"
            active={on("b:input-streaming")}
          />
          <Node
            x={390}
            y={120}
            label="input-available"
            active={on("b:input-available")}
          />
          <Node
            x={620}
            y={120}
            label="output-available"
            active={on("b:output-available")}
          />
          <Node
            x={620}
            y={190}
            label="output-error"
            active={on("b:output-error")}
          />
          <Node
            x={390}
            y={260}
            label="approval-requested"
            active={on("b:approval-requested")}
          />
          <Node
            x={585}
            y={260}
            label="approval-responded"
            active={on("b:approval-responded")}
          />
          <Node
            x={745}
            y={260}
            label="output-denied"
            active={on("b:output-denied")}
          />
        </svg>
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
