const { logToFile } = require('../utils/logger');
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    const now = new Date();
    const time = now.toISOString();
    const apiLink = req.originalUrl;
    const endpoint = req.method + ' ' + req.path;
    let userId = '-';
    let userName = '-';
    // Try to extract from token if present
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const token = authHeader.split(' ')[1];
            const decoded = jwt.decode(token);
            if (decoded && decoded.userId) userId = decoded.userId;
            if (decoded && decoded.userName) userName = decoded.userName;
        } catch (e) {}
    }
    // Compose log line
    const logLine = `[${time}] API: ${apiLink} | UserId: ${userId} | UserName: ${userName} | Endpoint: ${endpoint}`;
    logToFile(logLine);
    next();
};
