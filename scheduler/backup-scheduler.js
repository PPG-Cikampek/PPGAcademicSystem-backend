const cron = require('node-cron');
const backupManager = require('../utils/backup-manager');

// Schedule backup every day at 1:00 AM
cron.schedule('0 1 * * *', async () => {
    console.log('Starting daily backup...');
    await backupManager.createBackup();
    backupManager.cleanOldBackups();
});

console.log('Backup scheduler initialized');
