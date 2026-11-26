# Changelog

All notable changes to IO Convert are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-26

First public release.

### Added

- Batch conversion for images (including HEIC and SVG), video, audio, documents and spreadsheets, two files at a time with live progress and cancel.
- PDF toolkit: organize pages, edit and sign, merge, split, compress, protect and unlock, watermark, page numbers, OCR, images to PDF and document properties.
- English and Turkish interface, chosen from the system language and switchable in Settings.
- Optional LibreOffice integration for DOC, ODT, RTF and PowerPoint files.
- Windows installer built and attached to GitHub Releases by the release workflow.

### Security

- The renderer runs sandboxed with context isolation, without Node integration and under a strict Content Security Policy.
- The window cannot be navigated away from the app; web links open in the default browser.
- Release builds hide the reload and DevTools shortcuts.
- Electron fuses disable `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS` and the Node inspector flags, so the installed app cannot be used as a general Node.js runtime.

[1.0.0]: https://github.com/sm3th/io-convert/releases/tag/v1.0.0
