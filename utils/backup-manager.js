const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { format } = require('date-fns');

class BackupManager {
    constructor() {
        this.uploadsDir = path.join(__dirname, '..', 'uploads');
        this.backupsDir = path.join(__dirname, '..', '..', 'academic-system-backups');
    }

    async createBackup() {
        try {
            // Create backups directory if it doesn't exist
            if (!fs.existsSync(this.backupsDir)) {
                fs.mkdirSync(this.backupsDir, { recursive: true });
            }

            const timestamp = format(new Date(), 'yyyy-MM-dd-HHmmss');
            const backupPath = path.join(this.backupsDir, `uploads-backup-${timestamp}.zip`);

            const output = fs.createWriteStream(backupPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Maximum compression
            });

            archive.pipe(output);
            archive.directory(this.uploadsDir, 'uploads');
            await archive.finalize();

            console.log(`Backup created successfully: ${backupPath}`);
            return true;
        } catch (error) {
            console.error('Backup creation failed:', error);
            return false;
        }
    }

    cleanOldBackups() {
        try {
            const files = fs.readdirSync(this.backupsDir);
            const now = new Date();

            files.forEach(file => {
                const filePath = path.join(this.backupsDir, file);
                const stats = fs.statSync(filePath);
                const daysOld = (now - stats.mtime) / (1000 * 60 * 60 * 24);

                if (daysOld > 30) {
                    fs.unlinkSync(filePath);
                    console.log(`Deleted old backup: ${file}`);
                }
            });

            return true;
        } catch (error) {
            console.error('Cleanup of old backups failed:', error);
            return false;
        }
    }
}

module.exports = new BackupManager();
