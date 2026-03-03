const { logToFile } = require('../utils/logger');
const { decodeJwt } = require('jose');

module.exports = (req, res, next) => {
    const now = new Date();
    const time = now.toISOString();
    const apiLink = req.originalUrl;
    const endpoint = req.method + ' ' + req.path;
    let userId = '-';
    let userEmail = '-';
    // Try to extract from token if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = decodeJwt(token);
            if (decoded && decoded.userId) userId = decoded.userId;
            if (decoded && decoded.email) userEmail = decoded.email;
        } catch (e) {}
    }
    // Compose log line
    const logLine = `[${time}] API: ${apiLink} | UserId: ${userId} | UserEmail: ${userEmail} | Endpoint: ${endpoint}`;
    logToFile(logLine);
    next();
};
