// scripts/createTodayAttendances.js
// Bulk attendance creation script for all students in active branch years
// Usage: node scripts/createTodayAttendances.js [--dry-run] [--verbose]

const mongoose = require("mongoose");
require("dotenv").config();

// Import models (import all dependencies to ensure schemas are registered)
const Branch = require("../models/branch");
const SubBranch = require("../models/subBranch");
const User = require("../models/user");
const AcademicYear = require("../models/academicYear");
const BranchYear = require("../models/branchYear");
const TeachingGroup = require("../models/teachingGroup");
const Class = require("../models/class");
const Student = require("../models/student");
const Attendance = require("../models/attendance");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");

// Statistics tracking
const stats = {
    academicYearName: "",
    activeBranchYears: 0,
    totalTeachingGroups: 0,
    totalClasses: 0,
    totalStudents: 0,
    recordsToCreate: 0,
    recordsSkipped: 0,
    emptyClasses: 0,
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
        if (isVerbose) console.log(`   ${msg}`);
    },
    section: (msg) => console.log(`\n${"=".repeat(50)}\n${msg}\n${"=".repeat(50)}`),
};

/**
 * Main function to create attendance records
 */
async function createTodayAttendances() {
    const forDate = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format
    const timestamp = new Date().toISOString();

    log.section(
        `🚀 BULK ATTENDANCE CREATION ${isDryRun ? "- DRY RUN MODE" : ""}`
    );
    log.info(`📅 Date: ${forDate}`);
    log.info(`🕐 Started at: ${new Date().toLocaleString()}`);

    if (isDryRun) {
        log.warning("DRY RUN MODE - No data will be modified");
    }

    try {
        // Step 1: Find active academic year
        log.info("\n🔍 Finding active academic year...");
        const academicYear = await AcademicYear.findOne({ isActive: true })
            .populate({
                path: "branchYears",
                populate: {
                    path: "branchId",
                    select: "name",
                },
            })
            .lean();

        if (!academicYear) {
            log.error("No active academic year found!");
            log.info("Please ensure at least one academic year has isActive: true");
            return;
        }

        stats.academicYearName = academicYear.name;
        log.success(`Found: ${academicYear.name} (ID: ${academicYear._id})`);

        // Step 2: Filter active branch years
        log.info("\n🔍 Finding active branch years...");
        const activeBranchYears = academicYear.branchYears.filter(
            (by) => by.isActive === true
        );

        if (activeBranchYears.length === 0) {
            log.warning("No active branch years found in this academic year!");
            log.info("Please ensure at least one branch year has isActive: true");
            return;
        }

        stats.activeBranchYears = activeBranchYears.length;
        log.success(`Found ${activeBranchYears.length} active branch year(s)`);

        // Step 3: Process each active branch year
        // Note: Not using transactions due to MongoDB transaction timeout limits for large operations
        // Each document insert is atomic, and we check for duplicates before inserting

        for (let byIndex = 0; byIndex < activeBranchYears.length; byIndex++) {
            const branchYear = activeBranchYears[byIndex];
            const branchName = branchYear.branchId?.name || "Unknown Branch";

            log.info(
                `\n📚 Processing BranchYear ${byIndex + 1}/${activeBranchYears.length}: ${branchName}`
            );
            log.verbose(`   BranchYear ID: ${branchYear._id}`);

            // Get teaching groups for this branch year
            const teachingGroups = await TeachingGroup.find({
                branchYearId: branchYear._id,
            })
                .populate("subBranches")
                .lean();

            if (teachingGroups.length === 0) {
                log.warning(`   No teaching groups found for ${branchName}`);
                continue;
            }

            stats.totalTeachingGroups += teachingGroups.length;
            log.info(`   └── Found ${teachingGroups.length} teaching group(s)`);

            // Process each teaching group
            for (const teachingGroup of teachingGroups) {
                log.info(`\n   📖 Teaching Group: ${teachingGroup.name}`);
                log.verbose(`      TeachingGroup ID: ${teachingGroup._id}`);

                // Validate teaching group has subBranches
                if (!teachingGroup.subBranches || teachingGroup.subBranches.length === 0) {
                    const errorMsg = `TeachingGroup "${teachingGroup.name}" has no subBranches - skipping`;
                    log.error(`      ${errorMsg}`);
                    stats.errors.push({
                        type: "MISSING_SUBBRANCH",
                        teachingGroup: teachingGroup.name,
                        message: errorMsg,
                    });
                    continue;
                }

                // Get classes for this teaching group
                const classes = await Class.find({
                    teachingGroupId: teachingGroup._id,
                })
                    .select("_id name students teachingGroupId")
                    .lean();

                if (classes.length === 0) {
                    log.verbose(`      No classes found`);
                    continue;
                }

                stats.totalClasses += classes.length;
                log.info(`      └── Processing ${classes.length} class(es)`);

                // Process each class
                for (const classDoc of classes) {
                    const studentCount = classDoc.students?.length || 0;

                    if (studentCount === 0) {
                        log.warning(
                            `         ├── Class "${classDoc.name}": 0 students (empty class)`
                        );
                        stats.emptyClasses++;
                        continue;
                    }

                    log.info(
                        `         ├── Class "${classDoc.name}": ${studentCount} student(s)`
                    );
                    log.verbose(`            Class ID: ${classDoc._id}`);

                    stats.totalStudents += studentCount;

                    let created = 0;
                    let skipped = 0;

                    // Process each student in the class
                    for (const studentId of classDoc.students) {
                        try {
                            // Check if attendance already exists
                            const existingAttendance = await Attendance.findOne({
                                forDate,
                                studentId,
                            });

                            if (existingAttendance) {
                                skipped++;
                                stats.recordsSkipped++;
                                log.verbose(
                                    `            └── Student ${studentId}: Already has attendance - skipping`
                                );
                                continue;
                            }

                            // Determine subBranchId (Option B: Student-specific via User)
                            let subBranchId = null;
                            try {
                                const student = await Student.findById(studentId)
                                    .populate("userId")
                                    .select("userId")
                                    .lean();

                                if (student?.userId?.subBranchId) {
                                    subBranchId = student.userId.subBranchId;
                                    log.verbose(
                                        `            └── Student ${studentId}: Using student's subBranch`
                                    );
                                } else {
                                    // Fallback to first subBranch in teaching group
                                    subBranchId = teachingGroup.subBranches[0]._id;
                                    log.verbose(
                                        `            └── Student ${studentId}: Using teaching group's first subBranch`
                                    );
                                }
                            } catch (err) {
                                // Fallback to first subBranch on error
                                subBranchId = teachingGroup.subBranches[0]._id;
                                log.verbose(
                                    `            └── Student ${studentId}: Error fetching student, using fallback subBranch`
                                );
                            }

                            if (!subBranchId) {
                                const errorMsg = `Cannot determine subBranchId for student ${studentId}`;
                                log.error(`            └── ${errorMsg}`);
                                stats.errors.push({
                                    type: "MISSING_SUBBRANCH_ID",
                                    studentId,
                                    class: classDoc.name,
                                    message: errorMsg,
                                });
                                continue;
                            }

                            // Create attendance record
                            if (isDryRun) {
                                // Dry run: just count
                                created++;
                                stats.recordsToCreate++;
                                log.verbose(
                                    `            └── Student ${studentId}: Would create attendance`
                                );
                            } else {
                                // Real mode: create attendance
                                const attendance = new Attendance({
                                    forDate,
                                    timestamp,
                                    status: "Tanpa Keterangan",
                                    violations: {
                                        attribute: false,
                                        attitude: false,
                                        tidiness: false,
                                    },
                                    teachersNotes: "",
                                    studentId,
                                    branchId: branchYear.branchId._id,
                                    branchYearId: branchYear._id,
                                    subBranchId,
                                    teachingGroupId: teachingGroup._id,
                                    classId: classDoc._id,
                                });

                                await attendance.save();
                                created++;
                                stats.recordsToCreate++;
                                log.verbose(
                                    `            └── Student ${studentId}: Attendance created ✓`
                                );
                            }
                        } catch (err) {
                            const errorMsg = `Error processing student ${studentId}: ${err.message}`;
                            log.error(`            └── ${errorMsg}`);
                            stats.errors.push({
                                type: "STUDENT_PROCESSING_ERROR",
                                studentId,
                                class: classDoc.name,
                                message: errorMsg,
                            });
                        }
                    }

                    // Summary for this class
                    const createMsg = isDryRun ? "Would create" : "Created";
                    log.success(
                        `         └── ${createMsg}: ${created}, Skipped: ${skipped}`
                    );
                }
            }
        }

        // Print summary
        printSummary(forDate);
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
function printSummary(forDate) {
    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

    log.section("📊 SUMMARY REPORT");
    console.log(`Mode:                    ${isDryRun ? "DRY RUN" : "REAL EXECUTION"}`);
    console.log(`Date:                    ${forDate}`);
    console.log(`Academic Year:           ${stats.academicYearName}`);
    console.log(`Active Branch Years:     ${stats.activeBranchYears}`);
    console.log(`Total Teaching Groups:   ${stats.totalTeachingGroups}`);
    console.log(`Total Classes:           ${stats.totalClasses}`);
    console.log(`Total Students:          ${stats.totalStudents}`);
    console.log(
        `Records ${isDryRun ? "to Create" : "Created"}:       ${stats.recordsToCreate}`
    );
    console.log(`Records Skipped:         ${stats.recordsSkipped} (already exist)`);
    console.log(`Empty Classes:           ${stats.emptyClasses}`);
    console.log(`Errors:                  ${stats.errors.length}`);
    console.log(`Duration:                ${duration}s`);

    if (stats.errors.length > 0) {
        log.section("⚠️  ERRORS ENCOUNTERED");
        stats.errors.forEach((err, index) => {
            console.log(`\n${index + 1}. ${err.type}`);
            console.log(`   Message: ${err.message}`);
            if (err.class) console.log(`   Class: ${err.class}`);
            if (err.teachingGroup) console.log(`   Teaching Group: ${err.teachingGroup}`);
            if (err.studentId) console.log(`   Student ID: ${err.studentId}`);
        });
    }

    console.log("\n" + "=".repeat(50));

    if (isDryRun) {
        log.warning("⚠️  DRY RUN COMPLETE - No data was modified");
        log.info("💡 Run without --dry-run flag to create attendance records");
    } else {
        log.success("✅ All attendance records created successfully!");
    }

    log.info(`\n🕐 Completed at: ${new Date().toLocaleString()}`);
}

/**
 * Main execution
 */
async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGO_URI, {
            serverApi: { version: "1", strict: true, deprecationErrors: true },
        });
        log.success(`Connected to MongoDB -> ${process.env.DB_NAME}\n`);

        // Run the main function
        await createTodayAttendances();

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
