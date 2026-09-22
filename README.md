# Exam Management System

A full-stack exam management app: a plain HTML/Tailwind CSS frontend and a
Node/Express + MySQL backend, connected via session-cookie authentication.

```
ExamManagementSystem/
├── backend/    Express API + MySQL
└── frontend/   Static HTML/CSS/JS (Tailwind)
```

## 1. Set up the database

```bash
mysql -u root -p -e "CREATE DATABASE exam_management"
mysql -u root -p exam_management < backend/schema.sql
```

## 2. Configure and run the backend

Edit `backend/.env` with your own MySQL credentials (a `DB_PASSWORD` is
already filled in from your original file — change it if needed) and set
`CLIENT_URL` to whatever origin you'll serve the frontend from.

```bash
cd backend
npm install
npm start
```

The API runs on `http://localhost:5000` by default (`PORT` in `.env`).

## 3. Run the frontend

The frontend is static HTML — serve it with any static file server, e.g.:

```bash
cd frontend
npx serve . -p 5173
```

Then open `http://localhost:5173/index.html` in your browser. Make sure the
port you serve it on matches `CLIENT_URL` in `backend/.env` (both default to
`5173`), otherwise the browser will block API requests as cross-origin.

If you need to point the frontend at a backend running somewhere other than
`http://localhost:5000`, edit `API_BASE` at the top of
`frontend/src/js/api.js`.

## 4. Try it out

1. Register two accounts on `/pages/register.html` — one as "Admin", one as
   "Student".
2. Log in as the admin, go to **Create Exam**, add a title/duration and at
   least one question, then publish it from the admin dashboard.
3. Log in as the student, the exam will show up on the student dashboard —
   take it, submit it, and check **My Grades**.

## What was fixed to connect the two halves

The frontend and backend were built against different, incompatible
assumptions about the API (token-based auth vs. the backend's actual
session-cookie auth, mismatched URLs and payload shapes, and some pages
with no backend endpoint to call at all). See the chat for the full list —
in short:

- Backend: added the missing `db` import in `examController.js` (every exam
  query was broken), added `cors` with credentials, wrote the missing
  `schema.sql`, fixed a validation-order bug, and added the endpoints the
  frontend actually needs (admin exam list, dashboard stats, results list,
  result detail).
- Frontend: rewrote `api.js`/`auth.js` to use session cookies and the real
  endpoints/payload shapes; fixed broken `../js/...` import paths that
  pointed at a folder that doesn't exist; removed stray literal ` ``` `
  markdown fences that had been left in two HTML files; finished
  `create-exam.html`, which was cut off mid-sentence with no question UI or
  script; wired up `student-dashboard.html`, which had no script at all;
  and fixed the take-exam flow to start a real attempt and submit real
  question/option IDs instead of array indices.

**Not implemented** (out of scope for a connection/bug-fix pass): the
"Forgot password" page has no backend support — there's no email/SMTP
service configured, so it now tells the user honestly that it isn't
available instead of pretending to send an email. The "Candidates" sidebar
link on the admin side points at the student dashboard as a placeholder;
there's no dedicated candidate-management page/endpoint yet.
