# Contributing

Thanks for your interest in IO Convert. Bug reports, translations and pull requests are welcome.

## Setup

Requires Node.js 20 or newer.

```bash
npm install     # also copies the PDF.js assets the renderer needs
npm run dev     # start the app with hot reload
```

If `npm run dev` fails with `Error: Electron uninstall`, the Electron binary is missing from `node_modules`. Run `node node_modules/electron/install.js` to fetch it again.

## Before you open a pull request

```bash
npm run typecheck
npm test
```

Both must pass; CI runs the same commands. The tests convert real files end to end. On Linux and macOS they print PDFs with a local Google Chrome or Chromium, and on Windows with Chrome or Edge. Set `CHROME_PATH` if yours is somewhere else.

## Guidelines

- **Keep it offline.** IO Convert never uploads files. A change must not add network calls, telemetry or remote assets. The one exception is the OCR language data, which is downloaded once and cached.
- **Main process does the work, the renderer shows it.** File access, conversion and PDF editing live in `src/main/services`. The renderer reaches them only through the typed bridge in `src/preload`.
- **Translate new UI copy.** Wrap visible text in `t('…')` and add the Turkish entry to `src/renderer/src/lib/i18n.ts`. An error that can reach the user also needs an entry there (see `translateError`).
- **Add a test** for new conversions or PDF operations in `tests/services.test.ts`.
- Match the existing style: 2-space indentation, single quotes, no semicolons.

## Reporting bugs

Open an issue with your OS, the app version (shown in Settings) and the steps to reproduce. If a specific file fails to convert, say what kind of file it is; please don't attach anything private.
