## Development

Start the dev server through the Claude desktop app's browser pane (`preview_start`
with the `dev` configuration from `.claude/launch.json`). The app owns the process, but
it does not stop it when the session ends: a server left running keeps port 4321 for as
long as the app is open. Before you finish a session, stop any server you started with
`preview_stop`.

Do not run `astro dev` or `pnpm dev` from a shell in an agent session: Astro detects the
agent and forks the server into a detached background process that outlives the
session.

If port 4321 is already taken when you start, a previous session left its server
behind. `astro dev stop` cannot find it, because the launch config starts the server
with `--ignore-lock` and that flag opts it out of the lock file `stop` reads. Kill it by
port instead:

```bash
kill $(lsof -tnP -iTCP:4321 -sTCP:LISTEN)
```

In a terminal session with no browser pane, prefer a server the user starts themselves
in their own terminal and use it at http://localhost:4321. If you must start one, run
`pnpm dev --ignore-lock` as a background shell task so it stays attached to the session,
and stop it before you finish.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
