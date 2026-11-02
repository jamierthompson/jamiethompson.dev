import { createChat } from "@shadcn/helpers/ai-sdk";
import type { ChatTransport, UIDataTypes, UIMessage, UIMessageChunk } from "ai";

/**
 * The scripted conversations behind the islands in "The two state machines
 * inside useChat". They stream through the real `useChat` with no model and
 * no network: `@shadcn/helpers/ai-sdk` plays the UI message stream the server
 * would send, chunk for chunk, so every state the components show is the real
 * one.
 */

export type DemoMessage = UIMessage<
  unknown,
  UIDataTypes,
  {
    getWeather: {
      input: { city: string };
      output: { city: string; temperatureF: number; condition: string };
    };
    deleteFile: {
      input: { path: string };
      output: { deleted: string };
    };
  }
>;

export type DemoPart = DemoMessage["parts"][number];
export type DemoToolPart = Extract<
  DemoPart,
  { type: "tool-getWeather" | "tool-deleteFile" }
>;

/**
 * The script behind the status diagram: a plain turn that goes round the
 * machine, then one that fails partway through the text, so the partial
 * part stays and `status` lands on `error`.
 */
export function statusScript() {
  return createChat<DemoMessage>()
    .user("Say hello in one sentence.")
    .sleep(700)
    .assistant(({ writer }) => {
      writer.stepStart();
      writer.reasoning("A one-line greeting. Nothing to look up.", {
        delayMs: 30,
      });
      writer.sleep(300);
      writer.text(
        "Hello. It is good to have you here, and this sentence is the whole reply.",
        {
          delayMs: 35,
        },
      );
    })
    .user("Say hello, then fall over.")
    .sleep(700)
    .assistant(({ writer }) => {
      writer.stepStart();
      writer.text("Hello. This is going fine until", { delayMs: 40 });
      writer.error("The provider closed the connection.");
    });
}

/**
 * The full turn: reasoning, a tool that runs on its own, a tool that waits for
 * approval, and the continuation that runs once the person has answered.
 */
export function fullTurn() {
  return createChat<DemoMessage>()
    .user(
      "What's the weather in Kansas City, MO? Then delete scratch/notes.md.",
    )
    .sleep(700)
    .assistant(({ writer }) => {
      writer.stepStart();
      writer.reasoning(
        "Two requests. The weather is a lookup I can do now. Deleting a file is irreversible, so that one needs approval first.",
        { delayMs: 25 },
      );
      writer.sleep(300);
      writer
        .tool("getWeather", { input: { city: "Kansas City, MO" } })
        .sleep(1100)
        .output({
          city: "Kansas City, MO",
          temperatureF: 64,
          condition: "sunny",
        });
      writer.sleep(300);
      writer.tool("deleteFile", {
        input: { path: "scratch/notes.md" },
        needsApproval: true,
        output: { deleted: "scratch/notes.md" },
      });
    })
    .assistant(({ writer, toolCall }) => {
      writer.stepStart();
      writer.sleep(500);
      writer.text(
        toolCall?.approved
          ? "Kansas City is 64°F and sunny. scratch/notes.md is gone."
          : "Kansas City is 64°F and sunny. I left scratch/notes.md where it was.",
        { delayMs: 35 },
      );
    });
}

export type WireEntry =
  | { kind: "request"; at: number }
  | { kind: "chunk"; chunk: UIMessageChunk; at: number }
  | { kind: "close"; at: number };

/** The helper's transport with a tap, so an island can show the wire as `useChat` reads it. */
export function tap<M extends UIMessage>(
  transport: ChatTransport<M>,
  log: (entry: WireEntry) => void,
): ChatTransport<M> {
  return {
    ...transport,
    sendMessages: async (options) => {
      log({ kind: "request", at: Date.now() });
      const stream = await transport.sendMessages(options);
      return stream.pipeThrough(
        new TransformStream<UIMessageChunk, UIMessageChunk>({
          transform: (chunk, controller) => {
            log({ kind: "chunk", chunk, at: Date.now() });
            controller.enqueue(chunk);
          },
          flush: () => log({ kind: "close", at: Date.now() }),
        }),
      );
    },
    reconnectToStream: (options) => transport.reconnectToStream(options),
  };
}

/** The text parts of a message joined. */
export function messageText(message: UIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}
