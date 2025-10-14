const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { format } = require('date-fns');

/**
 * BackupManager class handles the creation and management of backup files
 * for the uploads directory in the academic system.
 * 
 * @class BackupManager
 */
class BackupManager {
    /**
     * Creates an instance of BackupManager.
     * Initializes the uploads directory path and backups directory path.
     * 
     * @constructor
     */
    constructor() {
        this.uploadsDir = path.join(__dirname, '..', 'uploads');
        this.backupsDir = path.join(__dirname, '..', '..', 'academic-system-backups');
    }

    /**
     * Creates a compressed backup of the uploads directory.
     * Generates a timestamped zip file and stores it in the backups directory.
     * Creates the backups directory if it doesn't exist.
     * 
     * @async
     * @returns {Promise<boolean>} Returns true if backup was created successfully, false otherwise
     * @throws {Error} Logs error to console if backup creation fails
     */
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

    /**
     * Cleans up old backup files that are older than 30 days.
     * Iterates through all files in the backups directory and deletes those
     * whose modification time is more than 30 days ago.
     * 
     * @returns {boolean} Returns true if cleanup was successful, false otherwise
     * @throws {Error} Logs error to console if cleanup fails
     */
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
