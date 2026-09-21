# BBSUL UniBot — Windows setup

Use this guide first. This ZIP contains the existing app and all retrieval fixes. It excludes Mac-installed node_modules, build caches and private credentials so Windows installs its own native dependencies.

## 1. Install Node.js and extract

Install Node.js 24 LTS for Windows from https://nodejs.org/ (include npm). Close and reopen your terminal after installation. Extract the ZIP fully, for example into C:\Projects. Open **Command Prompt** in the extracted bbsul-unibot folder, where package.json is located. Do not run commands from inside the ZIP viewer.

```bat
cd /d C:\Projects\bbsul-unibot
node --version
npm --version
npm ci --include=optional
copy .env.example .env.local
npm run demo
```

Copy .env.example only on the first setup; do not overwrite configured credentials later. Internet is required for npm installation. Keep optional dependencies enabled: PDF extraction and Next.js use platform-specific native packages.

Open http://localhost:3000. Click Log in and choose Student, Faculty or Admin in the demo section. No Firebase credentials are needed for this first run. Leave FIREBASE_PROJECT_ID blank in demo mode. Stop the server with Ctrl+C.

Demo supports panels, sample FAQs, TXT/PDF/DOCX/CSV uploads and retrieval, but stores data only in memory. Uploaded demo documents and changes disappear after a server restart. Gemini is disabled in demo mode. The sender's existing university documents, users and conversations live in cloud services and are NOT included in the ZIP.

On later runs:

```bat
cd /d C:\Projects\bbsul-unibot
npm run demo
```

PowerShell users can use `npm.cmd` instead of `npm` if script execution policy blocks npm.ps1. Use `Copy-Item .env.example .env.local` for the initial copy, and `cd C:\Projects\bbsul-unibot` (without /d).

## 2. Real Firebase-backed operation

For persistent data, configure .env.local using an authorized Firebase project and Cloudinary account, then use npm run dev instead of npm run demo.

- Fill NEXT_PUBLIC_FIREBASE_* from the Firebase Web app configuration.
- Fill FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY from the server service account. Keep the private key on one quoted line with escaped \n characters.
- Enable Firebase Email/Password authentication and Firestore, and include localhost in authorized domains.
- Fill CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. The current upload implementation uses Cloudinary for original documents.
- Set DEMO_MODE=false and APP_ORIGIN=http://localhost:3000.
- Keep Gemini/web disabled unless configured. If needed, fill GEMINI_API_KEY and a model supported by that account, enable the server flags and the Admin settings switches. The model in .env.example is a configurable placeholder; account access is not guaranteed.

```bat
npm run dev
```

Connecting to the same authorized Firebase and Cloudinary services accesses the existing data; a new Firebase project starts empty. The ZIP does not grant access to the sender's accounts. Obtain authorized configuration separately; private keys must not be posted in public or committed.

For a new Firebase project, follow README.md for rules and first-admin setup. The existing project uses Cloudinary for uploads, so Firebase Storage is not required by the current document adapter. Register and verify an account, set BOOTSTRAP_ADMIN_UID to its UID, then run `npm run bootstrap` only if the project has no admin. Existing projects do not need bootstrap again. Public faculty registrations require admin approval.

## 3. Verify retrieval

```bat
node --import tsx --test tests/retrieval-hybrid.test.ts tests/retrieval-library.test.ts
npm run typecheck
npm test
```

The focused suite checks English/Roman Urdu paraphrases, the library PDF spelling error, source grounding, missing facts and irrelevant evidence. In the demo Admin panel, upload a text document with clearly labeled test facts, then ask matching natural-language questions. Do not treat fixture values as actual BBSUL policies.

Optional browser tests (stop any running app on port 3000 first, use blank Firebase credentials):

```bat
npx playwright install chromium
npm run test:e2e
```

The browser test launcher is cross-platform. Firestore rules tests additionally require Java 21 or newer and `npm run test:rules`.

## 4. Production-style local run

After configuring .env.local for real operation:

```bat
npm run build -- --webpack
npm start
```

Webpack matches the development bundler and was validated on the sender's Mac. It avoids the sender's Turbopack native-binding issue without changing the app's package scripts.

## Troubleshooting and validation limits

- npm is not recognized: install Node.js and open a new terminal.
- Native binding / DOMMatrix / PDF extraction error: confirm Node 24 matches the Windows architecture and run `npm ci --include=optional` again from the extracted folder. Do not copy Mac node_modules or omit optional dependencies.
- Port 3000 already in use: stop the other server before launching this app.
- Demo role choices missing: remove real Firebase values only in your separate demo environment; FIREBASE_PROJECT_ID disables demo mode.
- Firebase or Cloudinary configuration incomplete: configure the appropriate credentials or use the credential-free demo.
- Scanned PDF has no readable text: OCR it first; the project does not perform OCR.

The source has passed retrieval regression tests and TypeScript checking on macOS. No Windows machine was available for execution testing, so Windows operation cannot be guaranteed. The sender's full suite had a PDF native-library loading failure; fresh platform-specific installation is required. Dependencies, provider credentials, quotas and firewall/network settings must also work on the recipient's laptop.
