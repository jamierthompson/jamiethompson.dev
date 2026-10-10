import { describe, expect, it } from "vitest";
import { initial } from "./initial";

describe("initial", () => {
  it("takes the first letter of a plain title", () => {
    expect(initial("Palette")).toBe("P");
  });

  it("keeps an emoji whole rather than splitting its surrogate pair", () => {
    expect(initial("🎨 Palette")).toBe("🎨");
    expect(initial("🎨 Palette")).not.toContain("�");
  });

  it("keeps a multi-code-point grapheme whole", () => {
    expect(initial("🇬🇧 Project")).toBe("🇬🇧");
    expect(initial("👩‍💻 Desk")).toBe("👩‍💻");
    expect(initial("étude")).toBe("é");
  });

  it("skips leading whitespace", () => {
    expect(initial("  Leading space")).toBe("L");
    expect(initial("\n\tTabbed")).toBe("T");
  });

  it("is empty for an empty or whitespace-only title", () => {
    expect(initial("")).toBe("");
    expect(initial("   ")).toBe("");
  });
});
