# CSV Viewer

A lightweight, browser-based tool for visualizing CSV files as a table. No server, no backend, no data leaves your machine — everything runs locally in the browser.

## Features

- **Drag-and-drop or file picker upload** — drop a `.csv` file onto the page or click to browse
- **Instant table rendering** — the first row is used as column headers, remaining rows as data
- **Column resizing** — drag the handle on the right edge of any header to resize that column; content that doesn't fit is truncated with an ellipsis
- **Virtual scrolling** — only the rows currently visible in the viewport are in the DOM, so files with hundreds of thousands of rows load and scroll without slowdown

## Getting started

Install dependencies:

```bash
bun install
```

Start the dev server:

```bash
bun run dev
```

Build for production:

```bash
bun run build
```

Preview the production build:

```bash
bun run preview
```

## Tech stack

| Tool | Purpose |
|------|---------|
| [Vite](https://vite.dev/) | Build tool and dev server |
| [TypeScript](https://www.typescriptlang.org/) | Type-safe JavaScript |
| [SheetJS (xlsx)](https://sheetjs.com/) | CSV parsing |

## Built with

Developed using [Cursor](https://cursor.com) (AI-assisted IDE).

## How it works

**CSV parsing** — when a file is uploaded, the browser reads it as an `ArrayBuffer` using the `FileReader` API. SheetJS parses the buffer and converts the spreadsheet into a 2D JavaScript array, where the first row becomes the column headers and the rest become data rows.

**Virtual scrolling** — instead of rendering every row at once, the table body only ever contains the rows visible in the viewport plus a small buffer above and below. Two invisible spacer rows sit at the top and bottom of the table body, and their heights are adjusted on every scroll event to represent all the off-screen rows. This keeps the scrollbar accurate while the DOM stays small regardless of file size.

**Column resizing** — the table uses `table-layout: fixed` with a `<colgroup>` so column widths are explicitly controlled. Each header cell has a hidden drag handle on its right edge. Dragging it updates the corresponding `<col>` element's width directly, and the table's total width is kept in sync so horizontal scrolling works correctly for wide tables.
