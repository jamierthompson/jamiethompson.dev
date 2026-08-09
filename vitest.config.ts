/// <reference types="vitest/config" />
// `getViteConfig` takes Vite's `UserConfig`, which knows nothing about `test`
// until Vitest's module augmentation is in scope — hence the reference above.
import { getViteConfig } from "astro/config";

// `getViteConfig` gives the tests Astro's own Vite pipeline, so `.astro`
// components can be imported and rendered with the container API.
export default getViteConfig({
  test: {
    include: ["src/**/*.test.ts"],
  },
});
