const HttpError = require("../models/http-error");

/**
 * Usage: router.post('/createUser', checkAuth, requireRole('admin'), controller.createUser)
 */
const requireRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.userData) {
            return next(new HttpError("Authentication required", 401));
        }
        if (!allowedRoles.includes(req.userData.userRole)) {
            return next(new HttpError("Forbidden: insufficient role", 403));
        }
        next();
    };
};

module.exports = requireRole;
