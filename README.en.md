# Rent Lens

Rent Lens is a local rental research workspace. It turns scattered Facebook rental posts into searchable, categorized, trackable local notes.

It is designed for these problems:

- Rental posts may be written in Hungarian or English.
- Facebook posts are scattered and easy to lose after messaging landlords.
- Rent, deposits, addresses, contact info, images, and notes are mixed together.
- Multiple listings need categories and follow-up status.

## Features

- Save Facebook rental URLs, post text, and images.
- Recommended with the Chrome / Edge browser extension for more reliable Facebook modal capture.
- Keep the original text and switch between original / translation in one compact reader.
- Extract rent, deposit, other fees, city, address, rooms, availability, contact info, and important details.
- Show detected money values in a reference currency.
- Show map location, Google Maps link, and commute estimates to a target address.
- Organize posts with categories, city filters, contact status, and personal notes.
- Configure multiple AI providers with fallback order.
- Switch the app UI between English and Chinese without changing saved post content.
- Use the browser extension to capture visible Facebook posts.
- Clean duplicate posts by URL and text similarity.

## Data And Privacy

This is a local-first project. Your posts, notes, and API keys are stored on your own machine:

```txt
data/store.json
```

This file is not committed to GitHub. The repository only keeps `data/.gitkeep` so the folder exists after cloning.

Ignored files include:

```txt
data/store.json
node_modules/
dist/
.env
release/
```

On first launch, if `data/store.json` does not exist, the app creates an empty local store:

- Default UI language: English
- Default translation language: English
- Default reference currency: USD
- AI providers: empty, users add their own
- Posts: empty

So the GitHub repository contains only the project structure and source code, not personal data.

## Easiest Start

### macOS

1. Install Node.js 20 or newer: <https://nodejs.org/>
2. Double-click:

   ```txt
   start-mac.command
   ```

The script installs dependencies and opens:

```txt
http://127.0.0.1:5173/
```

The script also opens the extension folder and browser extension page. Browsers do not allow scripts to install local extensions automatically, so the first setup still requires one manual Load unpacked action.

If macOS blocks the script, run:

```bash
cd /path/to/rent-lens
chmod +x start-mac.command
./start-mac.command
```

### Windows

1. Install Node.js 20 or newer: <https://nodejs.org/>
2. Double-click:

   ```txt
   start-windows.cmd
   ```

The script installs dependencies and opens:

```txt
http://127.0.0.1:5173/
```

The script checks whether Node.js is installed. If it is missing, it tries to install Node.js LTS with Windows `winget`. After installation, you usually need to run the script again.

The script also opens the extension folder and browser extension page. Browsers do not allow scripts to install local extensions automatically, so the first setup still requires one manual Load unpacked action.

If Windows blocks the script, allow it or run this from the project folder:

```bat
start-windows.cmd
```

### Terminal

```bash
npm install
npm run dev
```

Open:

```txt
http://127.0.0.1:5173/
```

The local API runs at:

```txt
http://127.0.0.1:8787/
```

## Recommended Browser Extension

Rent Lens can be used by manually pasting post text, but the browser extension is recommended. Facebook often uses modals and dynamic pages, and the extension reads the post content already visible in your browser.

Extension folder:

```txt
extension/
```

Install:

1. Start Rent Lens first.
2. Open Chrome or Edge.
3. Go to:

   ```txt
   chrome://extensions
   ```

4. Enable Developer mode.
5. Click Load unpacked.
6. Select the project's `extension/` folder.

Use:

1. Log in to Facebook normally.
2. Open a rental post, preferably in the post modal.
3. Click Rent Lens Capture in the browser toolbar.
4. Preview the detected content if needed.
5. Save the post.
6. Return to `http://127.0.0.1:5173/` to view the result.

The extension only reads content already visible in your browser. It does not bypass Facebook permissions. It sends captured data to the local API at `http://127.0.0.1:8787`.

More extension details: [extension/README.en.md](extension/README.en.md)

## AI Setup

Posts can still be saved without AI, but translation and structured extraction need an AI provider.

Built-in provider presets:

- OpenAI
- Gemini
- Claude
- DeepSeek
- Kimi
- Qwen
- GLM
- NVIDIA AI
- MiniMax
- Custom OpenAI-compatible endpoint

API keys are stored only in local `data/store.json` and are not committed to GitHub.

## Commands

```bash
npm run dev      # start frontend and local API
npm run start    # same as npm run dev
npm run build    # build check
npm run check    # build + npm security audit
npm run preview  # preview production build
```

## Project Structure

```txt
extension/       Chrome / Edge capture extension
server/          local API, AI calls, maps, dedupe, local store
src/             React app, styles, i18n, AI provider presets, types
data/            local runtime data folder, empty in GitHub
```
