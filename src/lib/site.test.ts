import { describe, expect, it } from "vitest";
import { isCurrentSection } from "./site";

describe("isCurrentSection", () => {
  it("marks a section's index and every page under it", () => {
    expect(isCurrentSection("/writing/", "/writing/")).toBe(true);
    expect(isCurrentSection("/writing/no-prior-context/", "/writing/")).toBe(
      true,
    );
  });

  it("leaves other sections and the home page unmarked", () => {
    expect(isCurrentSection("/projects/", "/writing/")).toBe(false);
    expect(isCurrentSection("/", "/writing/")).toBe(false);
  });

  // Astro serves `/writing` as well as `/writing/` under the default
  // `trailingSlash: "ignore"`, and both are the section.
  it("ignores how either side spells its trailing slash", () => {
    expect(isCurrentSection("/writing", "/writing/")).toBe(true);
    expect(isCurrentSection("/writing/", "/writing")).toBe(true);
  });

  it("matches whole path segments, not a shared prefix", () => {
    expect(isCurrentSection("/writing-x/", "/writing/")).toBe(false);
    expect(isCurrentSection("/writing-x/", "/writing")).toBe(false);
  });

  it("does not let the root claim every page", () => {
    expect(isCurrentSection("/", "/")).toBe(true);
    expect(isCurrentSection("/writing/", "/")).toBe(false);
  });
});
