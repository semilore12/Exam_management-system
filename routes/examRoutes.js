const express = require("express");

const {
    createExam,
    addQuestion,
    publishExam,
    getMyExams,
    getStats,
    getPublishedExams,
    getExam,
    startExam,
    submitExam,
    getMyResults,
    getResultDetail
} = require("../controllers/examController");

const auth = require("../middleware/auth");
const admin = require("../middleware/admin");

const router = express.Router();

// --- Admin: manage exams ---
router.post("/", auth, admin, createExam);
router.get("/", auth, admin, getMyExams);
router.get("/stats", auth, admin, getStats);
router.post("/:id/questions", auth, admin, addQuestion);
router.patch("/:id/publish", auth, admin, publishExam);

// --- Student/candidate: browse and take exams ---
router.get("/published", auth, getPublishedExams);
router.get("/my-results", auth, getMyResults);
router.get("/attempts/:attemptId", auth, getResultDetail);
router.post("/attempts/:attemptId/submit", auth, submitExam);
router.post("/:id/start", auth, startExam);

// --- Shared: view a single exam ---
router.get("/:id", auth, getExam);

module.exports = router;
