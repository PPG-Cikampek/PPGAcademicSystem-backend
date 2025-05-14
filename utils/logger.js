const fs = require('fs');
const path = require('path');

// Returns log file path for today (e.g., logs/2025-05-14.log)
function getLogFilePath() {
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir);
    }
    const date = new Date().toISOString().slice(0, 10);
    return path.join(logDir, `${date}.log`);
}

function logToFile(logLine) {
    const filePath = getLogFilePath();
    fs.appendFile(filePath, logLine + '\n', err => {
        if (err) console.error('Failed to write log:', err);
    });
}

module.exports = { logToFile };
