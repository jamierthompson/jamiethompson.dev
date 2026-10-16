import { describe, expect, it } from "vitest";
import { checkFeatured } from "./featured";

const entry = (id: string, draft = false) => ({ id, data: { draft } });

describe("checkFeatured", () => {
  it("returns the entries in the order the file lists them", () => {
    const b = entry("b");
    const a = entry("a");
    expect(checkFeatured("writing", ["b", "a"], [b, a])).toEqual([b, a]);
  });

  it("allows an empty list", () => {
    expect(checkFeatured("projects", [], [])).toEqual([]);
  });

  it("fails on a slug no entry has, naming the slug and the collection", () => {
    expect(() =>
      checkFeatured("writing", ["a", "missing"], [entry("a"), undefined]),
    ).toThrow(/"missing" under writing/);
  });

  it("fails on a draft, which has no page to link to", () => {
    expect(() =>
      checkFeatured("projects", ["wip"], [entry("wip", true)]),
    ).toThrow(/"wip" under projects.*draft/);
  });

  it("fails on the same entry listed twice", () => {
    const a = entry("a");
    expect(() => checkFeatured("writing", ["a", "a"], [a, a])).toThrow(
      /"a" under writing twice/,
    );
  });
});
