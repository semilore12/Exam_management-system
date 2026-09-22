const db = require("../config/database");

// =========================
// CREATE EXAM (admin)
// =========================
const createExam = async (req, res) => {
    try {
        const { title, description, duration } = req.body;

        if (!title || !duration) {
            return res.status(400).json({
                message: "Title and duration are required"
            });
        }

        const [result] = await db.query(
            `INSERT INTO exams 
            (title, description, duration, created_by)
            VALUES (?, ?, ?, ?)`,
            [
                title,
                description || null,
                duration,
                req.session.user.id
            ]
        );

        res.status(201).json({
            message: "Exam created successfully",
            examId: result.insertId
        });

    } catch (error) {
        console.error("Create exam error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// =========================
// ADD QUESTION (admin)
// =========================
const addQuestion = async (req, res) => {
    try {
        const examId = req.params.id;
        const { question, options } = req.body;

        // Validate presence/shape BEFORE using .filter on options
        if (!question || !options || !Array.isArray(options) || options.length < 2) {
            return res.status(400).json({
                message: "Question and at least two options are required"
            });
        }

        const correctOptions = options.filter(
            option => option.isCorrect === true
        );

        if (correctOptions.length !== 1) {
            return res.status(400).json({
                message: "Exactly one correct option is required"
            });
        }

        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const [exams] = await connection.query(
                `SELECT id FROM exams
                 WHERE id = ? AND created_by = ?`,
                [examId, req.session.user.id]
            );

            if (exams.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({
                    message: "Exam not found"
                });
            }

            const [questionResult] = await connection.query(
                `INSERT INTO questions (exam_id, question_text)
                 VALUES (?, ?)`,
                [examId, question]
            );

            const questionId = questionResult.insertId;

            for (const option of options) {
                await connection.query(
                    `INSERT INTO options
                    (question_id, option_text, is_correct)
                    VALUES (?, ?, ?)`,
                    [
                        questionId,
                        option.text,
                        !!option.isCorrect
                    ]
                );
            }

            await connection.commit();

            res.status(201).json({
                message: "Question added successfully",
                questionId
            });
        } catch (innerError) {
            await connection.rollback();
            throw innerError;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error("Add question error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// =========================
// PUBLISH EXAM (admin)
// =========================
const publishExam = async (req, res) => {
    try {
        const examId = req.params.id;

        const [questions] = await db.query(
            `SELECT id FROM questions WHERE exam_id = ?`,
            [examId]
        );

        if (questions.length === 0) {
            return res.status(400).json({
                message: "Add at least one question before publishing"
            });
        }

        const [result] = await db.query(
            `UPDATE exams
             SET status = 'published'
             WHERE id = ? AND created_by = ?`,
            [examId, req.session.user.id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: "Exam not found"
            });
        }

        res.json({
            message: "Exam published successfully"
        });

    } catch (error) {
        console.error("Publish exam error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// =========================
// GET EXAMS CREATED BY THE LOGGED-IN ADMIN (admin dashboard)
// =========================
const getMyExams = async (req, res) => {
    try {
        const [exams] = await db.query(
            `SELECT
                e.id,
                e.title,
                e.description,
                e.duration,
                e.status,
                e.created_at,
                (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS questionCount,
                (SELECT COUNT(*) FROM exam_attempts a WHERE a.exam_id = e.id AND a.status = 'submitted') AS attemptCount
             FROM exams e
             WHERE e.created_by = ?
             ORDER BY e.created_at DESC`,
            [req.session.user.id]
        );

        res.json(exams);

    } catch (error) {
        console.error("Get my exams error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// =========================
// ADMIN DASHBOARD STATS
// =========================
const getStats = async (req, res) => {
    try {
        const adminId = req.session.user.id;

        const [[{ totalExams }]] = await db.query(
            `SELECT COUNT(*) AS totalExams FROM exams WHERE created_by = ?`,
            [adminId]
        );

        const [[{ activeExams }]] = await db.query(
            `SELECT COUNT(*) AS activeExams FROM exams WHERE created_by = ? AND status = 'published'`,
            [adminId]
        );

        const [[{ totalStudents }]] = await db.query(
            `SELECT COUNT(*) AS totalStudents FROM users WHERE role = 'student'`
        );

        const [[{ totalResults }]] = await db.query(
            `SELECT COUNT(*) AS totalResults
             FROM exam_attempts a
             JOIN exams e ON e.id = a.exam_id
             WHERE e.created_by = ? AND a.status = 'submitted'`,
            [adminId]
        );

        res.json({ totalExams, activeExams, totalStudents, totalResults });

    } catch (error) {
        console.error("Get stats error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// =========================
// GET PUBLISHED EXAMS (students)
// =========================
const getPublishedExams = async (req, res) => {
    try {
        const [exams] = await db.query(
            `SELECT
                e.id, e.title, e.description, e.duration,
                (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS questionCount
             FROM exams e
             WHERE e.status = 'published'`
        );

        res.json(exams);

    } catch (error) {
        console.error("Get published exams error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// =========================
// GET A SINGLE EXAM (questions + options, no correct-answer flags)
// =========================
const getExam = async (req, res) => {
    try {
        const examId = req.params.id;

        const [exams] = await db.query(
            `SELECT id, title, description, duration
             FROM exams
             WHERE id = ? AND status = 'published'`,
            [examId]
        );

        if (exams.length === 0) {
            return res.status(404).json({
                message: "Exam not found"
            });
        }

        const [questions] = await db.query(
            `SELECT id, question_text
             FROM questions
             WHERE exam_id = ?`,
            [examId]
        );

        for (const question of questions) {
            const [options] = await db.query(
                `SELECT id, option_text
                 FROM options
                 WHERE question_id = ?`,
                [question.id]
            );

            question.options = options;
        }

        res.json({
            exam: exams[0],
            questions
        });

    } catch (error) {
        console.error("Get exam error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// =========================
// START AN EXAM ATTEMPT (student)
// =========================
const startExam = async (req, res) => {
    try {
        const examId = req.params.id;
        const candidateId = req.session.user.id;

        const [exams] = await db.query(
            `SELECT id FROM exams
             WHERE id = ? AND status = 'published'`,
            [examId]
        );

        if (exams.length === 0) {
            return res.status(404).json({
                message: "Exam not found"
            });
        }

        // Reuse an in-progress attempt if one already exists
        const [existing] = await db.query(
            `SELECT id FROM exam_attempts
             WHERE exam_id = ? AND candidate_id = ? AND status = 'in_progress'`,
            [examId, candidateId]
        );

        if (existing.length > 0) {
            return res.status(201).json({
                message: "Resuming existing attempt",
                attemptId: existing[0].id
            });
        }

        const [result] = await db.query(
            `INSERT INTO exam_attempts
             (exam_id, candidate_id)
             VALUES (?, ?)`,
            [examId, candidateId]
        );

        res.status(201).json({
            message: "Exam started",
            attemptId: result.insertId
        });

    } catch (error) {
        console.error("Start exam error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// =========================
// SUBMIT AN EXAM ATTEMPT (student)
// =========================
const submitExam = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const attemptId = req.params.attemptId;
        const { answers } = req.body;

        if (!answers || !Array.isArray(answers)) {
            connection.release();
            return res.status(400).json({
                message: "Answers are required"
            });
        }

        const [attempts] = await connection.query(
            `SELECT * FROM exam_attempts
             WHERE id = ? AND candidate_id = ?`,
            [attemptId, req.session.user.id]
        );

        if (attempts.length === 0) {
            connection.release();
            return res.status(404).json({
                message: "Attempt not found"
            });
        }

        const attempt = attempts[0];

        if (attempt.status === "submitted") {
            connection.release();
            return res.status(400).json({
                message: "Exam already submitted"
            });
        }

        const [totalRows] = await connection.query(
            `SELECT COUNT(*) AS total FROM questions WHERE exam_id = ?`,
            [attempt.exam_id]
        );
        const total = totalRows[0].total;

        await connection.beginTransaction();

        let score = 0;

        for (const answer of answers) {
            const [options] = await connection.query(
                `SELECT id, is_correct
                 FROM options
                 WHERE id = ? AND question_id = ?`,
                [answer.optionId, answer.questionId]
            );

            if (options.length === 0) {
                continue;
            }

            if (options[0].is_correct) {
                score++;
            }

            await connection.query(
                `INSERT INTO answers
                (attempt_id, question_id, option_id)
                VALUES (?, ?, ?)`,
                [
                    attemptId,
                    answer.questionId,
                    answer.optionId
                ]
            );
        }

        await connection.query(
            `UPDATE exam_attempts
             SET score = ?, status = 'submitted',
                 submitted_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [score, attemptId]
        );

        await connection.commit();

        res.json({
            message: "Exam submitted successfully",
            attemptId: Number(attemptId),
            score,
            total
        });

    } catch (error) {
        await connection.rollback();
        console.error("Submit exam error:", error);
        res.status(500).json({
            message: "Server error"
        });
    } finally {
        connection.release();
    }
};

// =========================
// LIST MY RESULTS (student)
// =========================
const getMyResults = async (req, res) => {
    try {
        const [results] = await db.query(
            `SELECT
                a.id AS attemptId,
                e.title AS examTitle,
                a.score,
                (SELECT COUNT(*) FROM questions q WHERE q.exam_id = e.id) AS total,
                a.submitted_at AS submittedAt
             FROM exam_attempts a
             JOIN exams e ON e.id = a.exam_id
             WHERE a.candidate_id = ? AND a.status = 'submitted'
             ORDER BY a.submitted_at DESC`,
            [req.session.user.id]
        );

        res.json(results);

    } catch (error) {
        console.error("Get my results error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// =========================
// RESULT DETAIL (owner student, or the exam's admin)
// =========================
const getResultDetail = async (req, res) => {
    try {
        const attemptId = req.params.attemptId;

        const [attempts] = await db.query(
            `SELECT a.*, e.title AS examTitle, e.created_by
             FROM exam_attempts a
             JOIN exams e ON e.id = a.exam_id
             WHERE a.id = ?`,
            [attemptId]
        );

        if (attempts.length === 0) {
            return res.status(404).json({
                message: "Result not found"
            });
        }

        const attempt = attempts[0];
        const isOwner = attempt.candidate_id === req.session.user.id;
        const isExamOwner = attempt.created_by === req.session.user.id;

        if (!isOwner && !isExamOwner) {
            return res.status(403).json({
                message: "You do not have access to this result"
            });
        }

        const [questions] = await db.query(
            `SELECT id, question_text FROM questions WHERE exam_id = ?`,
            [attempt.exam_id]
        );

        for (const question of questions) {
            const [options] = await db.query(
                `SELECT id, option_text, is_correct AS isCorrect FROM options WHERE question_id = ?`,
                [question.id]
            );
            question.options = options;

            const [answerRows] = await db.query(
                `SELECT option_id AS selectedOptionId FROM answers WHERE attempt_id = ? AND question_id = ?`,
                [attemptId, question.id]
            );
            question.selectedOptionId = answerRows.length > 0 ? answerRows[0].selectedOptionId : null;
        }

        const [totalRows] = await db.query(
            `SELECT COUNT(*) AS total FROM questions WHERE exam_id = ?`,
            [attempt.exam_id]
        );

        res.json({
            attemptId: attempt.id,
            examTitle: attempt.examTitle,
            score: attempt.score,
            total: totalRows[0].total,
            submittedAt: attempt.submitted_at,
            questions
        });

    } catch (error) {
        console.error("Get result detail error:", error);
        res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = {
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
};
