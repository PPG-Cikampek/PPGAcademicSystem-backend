// scripts/downgradeClasses.js
// Downgrades all classes in a specific BranchYear (semester)
// Usage: node scripts/downgradeClasses.js [--dry-run] [--verbose]

const mongoose = require("mongoose");
require("dotenv").config();

// Import models
const BranchYear = require("../models/branchYear");
const TeachingGroup = require("../models/teachingGroup");
const Class = require("../models/class");

// Configuration
const TARGET_BRANCH_YEAR_NAME = "20252";

// Class name downgrade mapping (reverse of upgrade)
const CLASS_DOWNGRADE_MAP = {
    "Kelas PAUD": "Kelas PRA-PAUD",
    "Kelas 1": "Kelas PAUD",
    "Kelas 2": "Kelas 1",
    "Kelas 3": "Kelas 2",
    "Kelas 4": "Kelas 3",
    "Kelas 5": "Kelas 4",
    "Kelas 6": "Kelas 5",
    "Kelas 7": "Kelas 6",
    "Kelas 8": "Kelas 7",
    "Kelas 9": "Kelas 8",
    "Kelas Khusus": "Kelas Khusus",
};

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");

// Statistics tracking
const stats = {
    classesDowngraded: 0,
    classesSkipped: 0,
    teachingGroupsProcessed: 0,
    branchYearsProcessed: 0,
    errors: [],
    startTime: Date.now(),
};

// MongoDB connection string
const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

// Logging utilities
const log = {
    info: (msg) => console.log(`ℹ️  ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warning: (msg) => console.log(`⚠️  ${msg}`),
    error: (msg) => console.log(`❌ ${msg}`),
    verbose: (msg) => {
        if (isVerbose) console.log(`   📝 ${msg}`);
    },
    section: (msg) => console.log(`\n${"=".repeat(60)}\n${msg}\n${"=".repeat(60)}`),
};

/**
 * Main function to downgrade classes
 */
async function downgradeClasses() {
    log.section(`🔽 CLASS DOWNGRADE SCRIPT ${isDryRun ? "- DRY RUN MODE" : ""}`);
    log.info(`📅 Target Branch Year: ${TARGET_BRANCH_YEAR_NAME}`);
    log.info(`🕐 Started at: ${new Date().toLocaleString()}`);

    if (isDryRun) {
        log.warning("DRY RUN MODE - No data will be modified\n");
    }

    // Start a session for transaction support
    const session = await mongoose.startSession();

    try {
        // Only use transaction if not dry run
        if (!isDryRun) {
            session.startTransaction();
        }

        const sessionOptions = isDryRun ? {} : { session };

        // ============================================================
        // PHASE 1: Find Target BranchYears
        // ============================================================
        log.section("PHASE 1: Finding Target BranchYears");

        const targetBranchYears = await BranchYear.find({ 
            name: TARGET_BRANCH_YEAR_NAME 
        }).lean();

        if (targetBranchYears.length === 0) {
            throw new Error(`No BranchYears found with name '${TARGET_BRANCH_YEAR_NAME}'`);
        }

        log.info(`Found ${targetBranchYears.length} BranchYears to process`);
        stats.branchYearsProcessed = targetBranchYears.length;

        // ============================================================
        // PHASE 2: Process TeachingGroups and Classes
        // ============================================================
        log.section("PHASE 2: Processing Classes");

        for (const branchYear of targetBranchYears) {
            log.verbose(`Processing BranchYear: ${branchYear._id} (Branch: ${branchYear.branchId})`);

            // Find all teaching groups for this branch year
            const teachingGroups = await TeachingGroup.find({
                branchYearId: branchYear._id,
            }).lean();

            log.verbose(`  Found ${teachingGroups.length} TeachingGroups`);
            stats.teachingGroupsProcessed += teachingGroups.length;

            for (const tg of teachingGroups) {
                log.verbose(`  Processing TeachingGroup: ${tg.name} (${tg._id})`);

                // Find all classes for this teaching group
                const classes = await Class.find({
                    teachingGroupId: tg._id,
                }).lean();

                log.verbose(`    Found ${classes.length} Classes`);

                for (const cls of classes) {
                    // Check if class has a downgrade mapping
                    const downgradedName = CLASS_DOWNGRADE_MAP[cls.name];

                    if (!downgradedName) {
                        log.warning(`    No downgrade mapping for '${cls.name}', skipping...`);
                        stats.classesSkipped++;
                        continue;
                    }

                    // Skip if downgrade results in same name (like Kelas Khusus)
                    if (downgradedName === cls.name) {
                        log.verbose(`    Class '${cls.name}' remains unchanged`);
                        stats.classesSkipped++;
                        continue;
                    }

                    // Skip PRA-PAUD if it somehow exists (no class below it)
                    if (cls.name === "Kelas PRA-PAUD") {
                        log.warning(`    Skipping '${cls.name}' (no lower class level)`);
                        stats.classesSkipped++;
                        continue;
                    }

                    log.verbose(`    Downgrading: '${cls.name}' → '${downgradedName}'`);

                    if (!isDryRun) {
                        await Class.findByIdAndUpdate(
                            cls._id,
                            { name: downgradedName },
                            sessionOptions
                        );
                        log.verbose(`      → Updated Class ${cls._id}`);
                    } else {
                        log.verbose(`      → Would update Class ${cls._id} (dry run)`);
                    }

                    stats.classesDowngraded++;
                }
            }
        }

        log.success(`Phase 2 complete: ${stats.classesDowngraded} Classes ${isDryRun ? "would be " : ""}downgraded, ${stats.classesSkipped} skipped`);

        // Commit transaction
        if (!isDryRun) {
            await session.commitTransaction();
            log.success("\n🎉 Transaction committed successfully!");
        }

        // Print summary
        printSummary();

    } catch (error) {
        // Rollback transaction on error
        if (!isDryRun) {
            await session.abortTransaction();
            log.error("\n💥 Transaction aborted due to error!");
        }

        log.error(`Error: ${error.message}`);
        stats.errors.push(error.message);

        if (isVerbose) {
            console.error(error.stack);
        }
    } finally {
        session.endSession();
    }
}

/**
 * Print final summary
 */
function printSummary() {
    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

    log.section("📊 SUMMARY");

    console.log(`
┌─────────────────────────────────────────────────────────┐
│  CLASS DOWNGRADE ${isDryRun ? "(DRY RUN)" : "COMPLETE"}                          │
├─────────────────────────────────────────────────────────┤
│  Target Branch Year:    ${TARGET_BRANCH_YEAR_NAME.padEnd(32)}│
├─────────────────────────────────────────────────────────┤
│  BranchYears processed: ${String(stats.branchYearsProcessed).padEnd(32)}│
│  TeachingGroups processed:${String(stats.teachingGroupsProcessed).padEnd(30)}│
│  Classes downgraded:    ${String(stats.classesDowngraded).padEnd(32)}│
│  Classes skipped:       ${String(stats.classesSkipped).padEnd(32)}│
├─────────────────────────────────────────────────────────┤
│  Duration:              ${(duration + " seconds").padEnd(32)}│
│  Errors:                ${String(stats.errors.length).padEnd(32)}│
└─────────────────────────────────────────────────────────┘
`);

    if (isDryRun) {
        log.warning("This was a DRY RUN - no data was actually modified.");
        log.info("Run without --dry-run flag to apply changes.");
    } else {
        log.success("All classes have been successfully downgraded!");
    }
}

/**
 * Connect to MongoDB and run the script
 */
async function main() {
    try {
        log.info("Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        log.success("Connected to MongoDB\n");

        await downgradeClasses();

    } catch (error) {
        log.error(`Failed to connect to MongoDB: ${error.message}`);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        log.info("\nDisconnected from MongoDB");
    }
}

// Run the script
main();
