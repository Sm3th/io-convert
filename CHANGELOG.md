# Changelog

All notable changes to IO Convert are listed here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Thumbnails for HEIC and TIFF images in Images to PDF.
- Overall progress bar while a batch converts.
- Supported-format overview on the Convert start screen.
- "Check for updates" and "Report a problem" links in Settings.

### Changed

- Sidebar tools are grouped into Page tools, Content and Security.
- Output file names follow the interface language, for example `doc — sıkıştırılmış.pdf` and `doc — sayfa 3.pdf` in Turkish.
- Finished conversions show the output file name instead of the full path.
- Refreshed controls: filled sliders, loading spinners on action buttons, clearer disabled buttons, before/after bars for compression and a page grid in place of the side-scrolling strip.

### Fixed

- Converting a video without sound to audio now says the file has no audio track instead of showing the raw FFmpeg log.
- The screenshot mode used for development no longer clashes with an already open copy of the app.

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

[Unreleased]: https://github.com/sm3th/io-convert/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sm3th/io-convert/releases/tag/v1.0.0
