/**
 * @fileoverview Script to update teacher NIG format: YYMMDD + 4-digit sequential number
 * @description This script updates teacher NIGs based on their date of birth in YYMMDD format
 * followed by a 4-digit sequential number. It supports dry-run mode for testing.
 * Usage: node scripts/updateTeacherNIG.js [--dry-run] [--verbose]
 */

const mongoose = require("mongoose");
require("dotenv").config();

// Import models
const Teacher = require("../models/teacher");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");
const isHelp = args.includes("--help") || args.includes("-h");
const isRun = args.includes("--run");

/**
 * Display help information
 */
function showHelp() {
    console.log(`
TEACHER NIG UPDATE SCRIPT

DESCRIPTION:
    This script updates teacher NIGs based on their date of birth in YYMMDD format
    followed by a 4-digit sequential number. It supports dry-run mode for testing.

USAGE:
    node scripts/updateTeacherNIG.js [options]

OPTIONS:
    --run            Execute the NIG update (modifies data)
    --dry-run        Run in dry-run mode (no data will be modified)
    --verbose        Enable verbose logging
    --help, -h       Show this help message

EXAMPLES:
    node scripts/updateTeacherNIG.js --run --verbose
    node scripts/updateTeacherNIG.js --dry-run
    node scripts/updateTeacherNIG.js --help

`);
}

// Show help if requested or no arguments provided
if (args.length === 0 || isHelp) {
    showHelp();
    process.exit(0);
}

// Proceed with script execution if --run or --dry-run is specified
if (!isRun && !isDryRun) {
    console.log("❌ Error: Must specify --run to execute the update or --dry-run to test.");
    showHelp();
    process.exit(1);
}

/**
 * @typedef {Object} UpdateStats
 * @property {number} totalTeachers - Total number of teachers processed
 * @property {number} teachersUpdated - Number of teachers whose NIG was updated
 * @property {number} teachersSkipped - Number of teachers skipped
 * @property {Object} skippedReasons - Reasons for skipping teachers
 * @property {number} skippedReasons.noDOB - Teachers without date of birth
 * @property {number} skippedReasons.validNIG - Teachers with already valid NIG
 * @property {Array} errors - List of errors encountered
 * @property {number} startTime - Timestamp when the script started
 */

/** @type {UpdateStats} */
const stats = {
    totalTeachers: 0,
    teachersUpdated: 0,
    teachersSkipped: 0,
    skippedReasons: {
        noDOB: 0,
        validNIG: 0,
    },
    errors: [],
    startTime: Date.now(),
};

// MongoDB connection string
const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

/**
 * @typedef {Object} Logger
 * @property {function(string): void} info - Log info message
 * @property {function(string): void} success - Log success message
 * @property {function(string): void} warning - Log warning message
 * @property {function(string): void} error - Log error message
 * @property {function(string): void} verbose - Log verbose message (if verbose mode)
 * @property {function(string): void} section - Log section header
 */

/** @type {Logger} */
const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warning: (msg) => console.log(`⚠️  ${msg}`),
    error: (msg) => console.log(`❌ ${msg}`),
    verbose: (msg) => {
        if (isVerbose) console.log(`   ${msg}`);
    },
    section: (msg) => console.log(`\n${"=".repeat(50)}\n${msg}\n${"=".repeat(50)}`),
};

/**
 * Format date to YYMMDD string
 * @param {Date} date - Date object
 * @returns {string} - YYMMDD formatted string
 */
function formatDateToYYMMDD(date) {
    const year = date.getFullYear().toString().slice(-2); // Last 2 digits of year
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}${month}${day}`;
}

/**
 * Check if NIG already has valid YYMMDD format matching teacher's DOB
 * @param {string} nig - Current NIG
 * @param {Date} dateOfBirth - Teacher's date of birth
 * @returns {boolean} - True if NIG is valid (starts with correct YYMMDD)
 */
function isNIGValid(nig, dateOfBirth) {
    if (!nig || nig.length < 6) return false;
    
    const nigPrefix = nig.substring(0, 6);
    const expectedPrefix = formatDateToYYMMDD(new Date(dateOfBirth));
    
    // Check if the first 6 digits match the expected YYMMDD from DOB
    if (nigPrefix === expectedPrefix) {
        return true;
    }
    
    // Additional check: is the prefix a valid date format at all?
    // Extract YY, MM, DD from NIG
    const yy = parseInt(nigPrefix.substring(0, 2), 10);
    const mm = parseInt(nigPrefix.substring(2, 4), 10);
    const dd = parseInt(nigPrefix.substring(4, 6), 10);
    
    // Check if MM is valid (01-12) and DD is valid (01-31)
    const isValidDateFormat = mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31;
    
    // If it's not even a valid date format, it's definitely invalid
    if (!isValidDateFormat) {
        return false;
    }
    
    // If it's a valid date format but doesn't match DOB, it's still invalid
    return false;
}

/**
 * Main function to update teacher NIGs
 * @returns {Promise<void>}
 */
async function updateTeacherNIGs() {
    log.section(`🚀 TEACHER NIG UPDATE ${isDryRun ? "- DRY RUN MODE" : ""}`);
    log.info(`🕐 Started at: ${new Date().toLocaleString()}`);
    log.info(`📋 NIG Format: YYMMDD (from dateOfBirth) + 4-digit sequential number`);

    if (isDryRun) {
        log.warning("DRY RUN MODE - No data will be modified\n");
    }

    try {
        // Step 1: Fetch all teachers with dateOfBirth, sorted by dateOfBirth for sequential numbering
        // Using lean() for better memory efficiency and projection to only get needed fields
        log.info("🔍 Fetching teachers...");
        
        const teachers = await Teacher.find({}, { _id: 1, name: 1, nig: 1, dateOfBirth: 1 })
            .sort({ dateOfBirth: 1 })
            .lean();

        stats.totalTeachers = teachers.length;
        log.success(`Found ${teachers.length} teacher(s)`);

        if (teachers.length === 0) {
            log.warning("No teachers found in database!");
            return;
        }

        // Step 2: Filter teachers that need NIG update
        log.info("\n📊 Analyzing teacher NIGs...");
        
        const teachersToUpdate = [];
        
        for (const teacher of teachers) {
            if (!teacher.dateOfBirth) {
                stats.teachersSkipped++;
                stats.skippedReasons.noDOB++;
                log.verbose(`⏭️  Skipping "${teacher.name}" (NIG: ${teacher.nig}) - No date of birth`);
                continue;
            }
            
            // Check if current NIG is already valid
            if (isNIGValid(teacher.nig, teacher.dateOfBirth)) {
                stats.teachersSkipped++;
                stats.skippedReasons.validNIG++;
                log.verbose(`✓  Skipping "${teacher.name}" (NIG: ${teacher.nig}) - Already valid`);
                continue;
            }
            
            const expectedPrefix = formatDateToYYMMDD(new Date(teacher.dateOfBirth));
            log.verbose(`⚠️  Invalid NIG "${teacher.name}": ${teacher.nig} (expected prefix: ${expectedPrefix})`);
            teachersToUpdate.push(teacher);
        }

        log.success(`Teachers needing update: ${teachersToUpdate.length}`);
        log.success(`Teachers with valid NIG: ${stats.skippedReasons.validNIG}`);
        log.warning(`Teachers without DOB (skipped): ${stats.skippedReasons.noDOB}`);

        if (teachersToUpdate.length === 0) {
            log.success("\n✅ All teachers already have valid NIGs!");
            printSummary();
            return;
        }

        // Step 3: Generate new NIGs and prepare bulk operations
        // Global sequential counter across all teachers needing update (sorted by DOB)
        log.info("\n🔄 Generating new NIGs...");
        
        const bulkOps = [];
        
        // Sort teachers to update by dateOfBirth
        teachersToUpdate.sort((a, b) => new Date(a.dateOfBirth) - new Date(b.dateOfBirth));
        
        // Get the highest existing sequential number for each DOB prefix to avoid conflicts
        // Group by DOB prefix and find max sequence
        const existingMaxSequence = new Map(); // Map<YYMMDD, maxSequence>
        
        // Check existing valid NIGs to find max sequence per prefix
        for (const teacher of teachers) {
            if (teacher.dateOfBirth && isNIGValid(teacher.nig, teacher.dateOfBirth)) {
                const prefix = teacher.nig.substring(0, 6);
                const seqStr = teacher.nig.substring(6);
                const seq = parseInt(seqStr, 10) || 0;
                
                if (!existingMaxSequence.has(prefix) || seq > existingMaxSequence.get(prefix)) {
                    existingMaxSequence.set(prefix, seq);
                }
            }
        }
        
        // Generate new NIGs for teachers needing update
        for (const teacher of teachersToUpdate) {
            const datePrefix = formatDateToYYMMDD(new Date(teacher.dateOfBirth));
            
            // Get next available sequence for this prefix
            const currentMax = existingMaxSequence.get(datePrefix) || 0;
            const nextSeq = currentMax + 1;
            existingMaxSequence.set(datePrefix, nextSeq);
            
            const sequentialNum = nextSeq.toString().padStart(4, "0");
            const newNIG = `${datePrefix}${sequentialNum}`;
            
            log.verbose(`📝 "${teacher.name}": ${teacher.nig} → ${newNIG}`);
            
            bulkOps.push({
                updateOne: {
                    filter: { _id: teacher._id },
                    update: { $set: { nig: newNIG } },
                },
            });
        }
        
        stats.teachersUpdated = bulkOps.length;

        // Step 4: Execute bulk update (if not dry run)
        if (bulkOps.length > 0) {
            if (isDryRun) {
                log.info(`\n📋 Would update ${bulkOps.length} teacher(s)`);
            } else {
                log.info(`\n💾 Executing bulk update for ${bulkOps.length} teacher(s)...`);
                
                const result = await Teacher.bulkWrite(bulkOps, { ordered: false });
                
                log.success(`Modified: ${result.modifiedCount} teacher(s)`);
                
                if (result.modifiedCount !== bulkOps.length) {
                    log.warning(`Expected ${bulkOps.length} modifications, got ${result.modifiedCount}`);
                }
            }
        } else {
            log.warning("No teachers to update!");
        }

        // Print summary
        printSummary();
    } catch (error) {
        log.error(`\n❌ Fatal error: ${error.message}`);
        if (isVerbose) {
            console.error(error);
        }
        throw error;
    }
}

/**
 * Print summary report
 */
function printSummary() {
    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

    log.section("📊 SUMMARY REPORT");
    console.log(`Mode:                    ${isDryRun ? "DRY RUN" : "REAL EXECUTION"}`);
    console.log(`Total Teachers:          ${stats.totalTeachers}`);
    console.log(`Teachers ${isDryRun ? "to Update" : "Updated"}:      ${stats.teachersUpdated}`);
    console.log(`Teachers Skipped:        ${stats.teachersSkipped}`);
    console.log(`  - No Date of Birth:    ${stats.skippedReasons.noDOB}`);
    console.log(`  - Already Valid NIG:   ${stats.skippedReasons.validNIG}`);
    console.log(`Errors:                  ${stats.errors.length}`);
    console.log(`Duration:                ${duration}s`);

    if (stats.errors.length > 0) {
        log.section("⚠️  ERRORS ENCOUNTERED");
        stats.errors.forEach((err, index) => {
            console.log(`\n${index + 1}. ${err.type}`);
            console.log(`   Message: ${err.message}`);
            if (err.teacherId) console.log(`   Teacher ID: ${err.teacherId}`);
        });
    }

    console.log("\n" + "=".repeat(50));

    if (isDryRun) {
        log.warning("⚠️  DRY RUN COMPLETE - No data was modified");
        log.info("💡 Run without --dry-run flag to update NIG records");
    } else {
        log.success("✅ Teacher NIG update completed successfully!");
    }

    log.info(`\n🕐 Completed at: ${new Date().toLocaleString()}`);
}

/**
 * Main execution
 * @returns {Promise<void>}
 */
async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI, {
            serverApi: { version: "1", strict: true, deprecationErrors: true },
        });
        log.success(`Connected to MongoDB -> ${process.env.DB_NAME}\n`);

        // Run the main function
        await updateTeacherNIGs();

        // Disconnect
        await mongoose.disconnect();
        log.success("\n✅ Disconnected from MongoDB");

        process.exit(0);
    } catch (error) {
        log.error(`\n❌ Script failed: ${error.message}`);
        if (isVerbose) {
            console.error(error);
        }

        // Ensure disconnection
        try {
            await mongoose.disconnect();
        } catch (disconnectError) {
            // Ignore disconnect errors
        }

        process.exit(1);
    }
}

// Run the script
main();
