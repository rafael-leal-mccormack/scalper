# Scalper

A modular web scraping tool built with Puppeteer and TypeScript.

## Structure

```
src/
├── core/           # Puppeteer abstraction layer
│   └── Browser.ts  # Browser management class
└── projects/       # Individual scraping projects
    └── ubereats/   # UberEats scraper
        └── index.ts
```

## Setup

```bash
npm install
```

## Usage

Run the UberEats scraper:
```bash
npm run ubereats
```

## Core Browser API

The `Browser` class provides:
- `launch(headless?)` - Launch browser instance
- `newPage()` - Create new page
- `close()` - Close browser
- `screenshot(page, path)` - Take screenshot
- `waitForSelector(page, selector, timeout?)` - Wait for element
- `wait(ms)` - Sleep utility

## Adding New Projects

Create a new folder under `src/projects/` with an `index.ts` file that imports and uses the `Browser` core.
