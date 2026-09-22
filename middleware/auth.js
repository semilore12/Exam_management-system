const auth = (req, res, next) => {
    if (!req.session.user) {
        return res.status(401).json({
            message: "Please login first"
        });
    }

    next();
};

module.exports = auth;
