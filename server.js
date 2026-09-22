require("dotenv").config();

const express = require("express");
const session = require("express-session");
const cors = require("cors");

const auth = require("./middleware/auth");
const admin = require("./middleware/admin");

const authRoutes = require("./routes/authRoutes");
const examRoutes = require("./routes/examRoutes");

const db = require("./config/database");

const app = express();


// =========================
// MIDDLEWARE
// =========================

// The frontend (served from a different port, e.g. Vite/Live Server)
// needs CORS enabled with credentials so the session cookie is sent/received.
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

app.use(
    cors({
        origin: CLIENT_URL,
        credentials: true
    })
);

app.use(express.json());

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            // "lax" works for same-site or localhost-to-localhost dev setups.
            // If frontend and backend end up on different domains in production,
            // this (and "secure") will need to change alongside HTTPS.
            sameSite: "lax",
            secure: false,
            maxAge: 1000 * 60 * 60 * 8 // 8 hours
        }
    })
);


// =========================
// AUTH ROUTES
// =========================

app.use("/api/auth", authRoutes);


// =========================
// EXAM ROUTES
// =========================

app.use("/api/exams", examRoutes);


// =========================
// HOME ROUTE
// =========================

app.get("/", (req, res) => {
    res.json({
        message: "Exam Management API is running"
    });
});


// =========================
// TEST AUTH
// =========================

app.get("/api/test-auth", auth, (req, res) => {
    res.json({
        message: "You are logged in",
        user: req.session.user
    });
});


app.get("/api/test-admin", auth, admin, (req, res) => {
    res.json({
        message: "You are an admin"
    });
});


// =========================
// 404 + ERROR HANDLERS
// =========================

app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ message: "Server error" });
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Accepting requests from ${CLIENT_URL}`);

    try {
        await db.query("SELECT 1");
        console.log("MySQL connected successfully");
    } catch (error) {
        console.log("MySQL connection failed");
        console.log(error.message);
    }
});
