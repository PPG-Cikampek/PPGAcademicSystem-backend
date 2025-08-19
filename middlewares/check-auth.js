const jwt = require('jsonwebtoken');
const HttpError = require('../models/http-error')

module.exports = (req, res, next) => {
    try {
        // Allow preflight requests to pass through
        if (req.method === 'OPTIONS') {
            return next();
        }

        if (!req.headers || !req.headers.authorization) {
            throw new Error('No authorization header');
        }

        const parts = req.headers.authorization.split(' ');
        if (parts.length !== 2) {
            throw new Error('Malformed authorization header');
        }

        const token = parts[1];
        if (!token) {
            throw new Error('Invalid token');
        }

        const decodedToken = jwt.verify(token, process.env.JWT_KEY);

        console.log('Auth decoded token:', decodedToken);

        req.userData = {
            userId: decodedToken.userId,
            userRole: decodedToken.role,
            userBranchId: decodedToken.userBranchId
        };
        next();
    } catch (err) {
        console.error('Authentication error:', err.message || err);
        return next(new HttpError('Authentication Failed!', 401));
    }

};
