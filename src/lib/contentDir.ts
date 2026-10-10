/**
 * Where the collections live. Overridable so the E2E suite can build against
 * `e2e/fixtures/content` — the specs then assert on entries that exist for
 * them, and renaming or deleting real writing never breaks the gate.
 */
export const CONTENT_DIR = process.env.CONTENT_DIR ?? "./src/content";
