# Rent Lens Capture Extension

This is the local Chrome / Edge capture extension for Rent Lens.

It does not bypass Facebook permissions. It only reads post content already visible in your browser and sends it to the local Rent Lens API.

## Requirement

Start the main project first:

```bash
npm run dev
```

The local API must be running at:

```txt
http://127.0.0.1:8787
```

## Install

1. Open Chrome or Edge.
2. Go to:

   ```txt
   chrome://extensions
   ```

3. Enable Developer mode.
4. Click Load unpacked.
5. Select this project's `extension/` folder.

## Use

1. Log in to Facebook normally.
2. Open a rental post, preferably in the post modal.
3. Click Rent Lens Capture in the browser toolbar.
4. Click Preview capture to check the detected content.
5. Click Save current post to save it into local Rent Lens.
6. Return to `http://127.0.0.1:5173/` to view the result.

## Detection Strategy

- The extension prioritizes the current Facebook modal.
- If there is no modal, it reads the post near the center of the page.
- If detection is inaccurate, select the post text manually before clicking the extension.
- It keeps larger post images where possible and filters avatars and small UI icons.

## How It Connects

The extension connects to:

```txt
http://127.0.0.1:8787
```

So the main project must be running while using the extension. This keeps API keys, post data, and notes on the user's own computer.
