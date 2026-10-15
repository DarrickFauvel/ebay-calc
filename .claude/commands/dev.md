---
description: Start the eBay calc dev server (installs deps and seeds the DB if needed)
argument-hint: "[port]"
---

Start the local dev server for this project.

1. If `node_modules/` is missing, run `npm install`.
2. Use port `$ARGUMENTS` if one was given, otherwise 3000. If something is already listening on that port, report it and stop rather than starting a second server.
3. Run `PORT=<port> npm run dev` in the background (it uses `node --watch`, so file edits reload automatically). The database schema and seed data are created on first boot.
4. Wait until the log shows `listening on http://localhost:<port>`, then run `curl -s -o /dev/null -w "%{http_code}" http://localhost:<port>/` to confirm it answers 200.
5. Reply with the URL and the page list: `/` calculator, `/settings`, `/rates`, `/categories`. If startup failed, show the relevant log lines.
