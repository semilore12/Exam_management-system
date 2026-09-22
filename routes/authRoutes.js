const express = require("express");

const {
    register,
    login,
    getCurrentUser,
    logout
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", getCurrentUser);
router.post("/logout", logout);

module.exports = router;
