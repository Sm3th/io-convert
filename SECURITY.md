# Security policy

IO Convert processes private files such as contracts, IDs and invoices, so security reports are taken seriously.

## Supported versions

Only the latest release receives security fixes.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Report it privately through
[GitHub's private vulnerability reporting](https://github.com/sm3th/io-convert/security/advisories/new) instead.

Include the IO Convert version, your operating system, the steps to reproduce the problem and, if possible, a sample file. You can expect a first reply within a week.

## Scope

In scope: anything that lets a crafted input file, or content inside it, run code, read or write files outside the ones the user chose, or send data off the computer.

Out of scope: vulnerabilities in bundled third-party tools (FFmpeg, libvips, LibreOffice) that are already public upstream. Those are fixed by updating the dependency, but reports that point out an outdated bundled version are welcome.
