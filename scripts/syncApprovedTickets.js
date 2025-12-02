// scripts/syncApprovedTickets.js
// CLI script to sync approved account request tickets
// Loops through approved tickets, checks if student/teacher records exist, creates if missing
// Usage: node scripts/syncApprovedTickets.js [--dry-run] [--verbose]

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Import models
const User = require("../models/user");
const Student = require("../models/student");
const Teacher = require("../models/teacher");
const AccountRequest = require("../models/accountRequest");

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");

// Statistics tracking
const stats = {
    totalTickets: 0,
    totalAccounts: 0,
    studentsCreated: 0,
    studentsSkipped: 0,
    teachersCreated: 0,
    teachersSkipped: 0,
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
    section: (msg) =>
        console.log(`\n${"=".repeat(50)}\n${msg}\n${"=".repeat(50)}`),
};

/**
 * Get available NIS slots for new students
 * @param {number} count - Number of NIS slots needed
 * @returns {Promise<string[]>} - Array of available NIS strings
 */
async function getAvailableNisSlots(count) {
    const currentYear = new Date().getFullYear();

    const students = await Student.find(
        { nis: new RegExp(`^${currentYear}(\\d{4})$`) },
        { nis: 1, _id: 0 }
    );

    const usedNumbers = students
        .map((s) => parseInt(s.nis.slice(4)))
        .filter((n) => n >= 10 && n <= 9999)
        .sort((a, b) => a - b);

    const availableNis = [];
    let expected = 10;
    let idx = 0;

    while (availableNis.length < count && expected <= 9999) {
        if (idx < usedNumbers.length && usedNumbers[idx] === expected) {
            idx++;
            expected++;
            continue;
        }
        availableNis.push(`${currentYear}${expected.toString().padStart(4, "0")}`);
        expected++;
    }

    return availableNis;
}

/**
 * Check if a student account already exists
 * For students, we check by name + dateOfBirth combination within the same subBranch
 * @param {Object} acc - Account data from ticket
 * @param {ObjectId} subBranchId - SubBranch ID from ticket
 * @returns {Promise<boolean>} - True if exists
 */
async function studentExists(acc, subBranchId) {
    // Strategy: Check if there's a student with same name under the same subBranch
    // First find users with matching subBranchId and role student
    const usersInSubBranch = await User.find({
        subBranchId,
        role: "student",
    }).select("_id name");

    // Then check if any of those users have a student with matching name
    for (const user of usersInSubBranch) {
        const student = await Student.findOne({ userId: user._id });
        if (student && student.name.toLowerCase() === acc.name.toLowerCase()) {
            // Additional check: if dateOfBirth is provided, match it too
            if (acc.dateOfBirth && student.dateOfBirth) {
                const accDob = new Date(acc.dateOfBirth).toDateString();
                const studentDob = new Date(student.dateOfBirth).toDateString();
                if (accDob === studentDob) {
                    return true;
                }
            } else {
                // If no DOB to compare, just name match is enough
                return true;
            }
        }
    }

    return false;
}

/**
 * Check if a teacher account already exists by email
 * @param {string} email - Teacher email
 * @returns {Promise<boolean>} - True if exists
 */
async function teacherExists(email) {
    const existing = await User.findOne({ email: email.toLowerCase() });
    return !!existing;
}

/**
 * Create a student account (User + Student records)
 * @param {Object} acc - Account data
 * @param {string} nis - Assigned NIS
 * @param {ObjectId} subBranchId - SubBranch ID
 * @param {mongoose.ClientSession} session - MongoDB session
 */
async function createStudentAccount(acc, nis, subBranchId, session) {
    const hashedPassword = await bcrypt.hash("1234", 12);

    const user = new User({
        name: acc.name,
        email: `siswa${nis}@ppgcikampek.id`,
        password: hashedPassword,
        role: "student",
        image: acc.image || "",
        thumbnail: acc.thumbnail || "",
        subBranchId,
    });
    await user.save({ session });

    const student = new Student({
        userId: user._id,
        nis,
        name: acc.name,
        dateOfBirth: acc.dateOfBirth || "",
        gender: acc.gender || "",
        parentName: acc.parentName || "",
        parentPhone: acc.parentPhone || "",
        address: acc.address || "",
        image: acc.image || "",
        thumbnail: acc.thumbnail || "",
        isProfileComplete: false,
        isInternal: true,
        attendanceIds: [],
        classIds: [],
    });
    await student.save({ session });

    return { user, student };
}

/**
 * Create a teacher account (User + Teacher records)
 * @param {Object} acc - Account data
 * @param {string} nig - Generated NIG
 * @param {ObjectId} subBranchId - SubBranch ID
 * @param {mongoose.ClientSession} session - MongoDB session
 */
async function createTeacherAccount(acc, nig, subBranchId, session) {
    const hashedPassword = await bcrypt.hash("1234", 12);

    const user = new User({
        name: acc.name,
        email: acc.email,
        password: hashedPassword,
        role: "teacher",
        image: acc.image || "",
        thumbnail: acc.thumbnail || "",
        subBranchId,
    });
    await user.save({ session });

    const teacher = new Teacher({
        userId: user._id,
        name: acc.name,
        nig,
        phone: acc.phone || "",
        position: acc.position || "",
        dateOfBirth: acc.dateOfBirth || "",
        gender: acc.gender || "",
        address: acc.address || "",
        image: acc.image || "",
        thumbnail: acc.thumbnail || "",
        positionStartDate: new Date(),
        positionEndDate: "",
        isProfileComplete: true,
        classIds: [],
    });
    await teacher.save({ session });

    return { user, teacher };
}

/**
 * Generate NIG for a teacher
 * @param {string|null} dateOfBirth - Date of birth string
 * @param {number} teacherCount - Current teacher count for sequence
 * @returns {string} - Generated NIG
 */
function generateNig(dateOfBirth, teacherCount) {
    let dob = null;
    if (dateOfBirth) {
        const parsed = new Date(dateOfBirth);
        if (!isNaN(parsed.getTime())) {
            dob = parsed;
        }
    }

    const baseDate = dob || new Date();
    const yy = baseDate.getFullYear().toString().slice(-2);
    const mm = String(baseDate.getMonth() + 1).padStart(2, "0");
    const dd = String(baseDate.getDate()).padStart(2, "0");
    const seq = String(teacherCount).padStart(4, "0");

    return `${yy}${mm}${dd}${seq}`;
}

/**
 * Main function to sync approved tickets
 */
async function syncApprovedTickets() {
    log.section(
        `🚀 SYNC APPROVED TICKETS ${isDryRun ? "- DRY RUN MODE" : ""}`
    );
    log.info(`🕐 Started at: ${new Date().toLocaleString()}`);

    if (isDryRun) {
        log.warning("DRY RUN MODE - No data will be modified");
    }

    try {
        // Step 1: Find all approved tickets
        log.info("\n🔍 Finding approved tickets...");
        const approvedTickets = await AccountRequest.find({ status: "approved" });

        if (!approvedTickets || approvedTickets.length === 0) {
            log.info("No approved tickets found.");
            return;
        }

        stats.totalTickets = approvedTickets.length;
        log.success(`Found ${approvedTickets.length} approved ticket(s)`);

        // Step 2: Collect all accounts and categorize
        const allStudentAccounts = [];
        const ticketAccounts = [];

        for (const ticket of approvedTickets) {
            const students = [];
            const teachers = [];

            (ticket.accountList || []).forEach((acc) => {
                if (acc.accountRole === "student") students.push(acc);
                else if (acc.accountRole === "teacher") teachers.push(acc);
            });

            ticketAccounts.push({ ticket, students, teachers });
            allStudentAccounts.push(
                ...students.map((s) => ({ ...s, subBranchId: ticket.subBranchId }))
            );
        }

        // Count total accounts
        const totalStudentAccounts = ticketAccounts.reduce(
            (sum, t) => sum + t.students.length,
            0
        );
        const totalTeacherAccounts = ticketAccounts.reduce(
            (sum, t) => sum + t.teachers.length,
            0
        );
        stats.totalAccounts = totalStudentAccounts + totalTeacherAccounts;

        log.info(`\n📊 Total accounts in tickets:`);
        log.info(`   Students: ${totalStudentAccounts}`);
        log.info(`   Teachers: ${totalTeacherAccounts}`);

        // Step 3: Pre-check which students need to be created
        log.info("\n🔍 Checking existing records...");

        const studentsToCreate = [];
        for (const { ticket, students } of ticketAccounts) {
            for (const acc of students) {
                const exists = await studentExists(acc, ticket.subBranchId);
                if (!exists) {
                    studentsToCreate.push({ acc, subBranchId: ticket.subBranchId });
                } else {
                    stats.studentsSkipped++;
                    log.verbose(`Student "${acc.name}" already exists - skipping`);
                }
            }
        }

        // Step 4: Get available NIS slots for students that need creation
        let availableNis = [];
        if (studentsToCreate.length > 0) {
            log.info(`\n📝 Preparing NIS for ${studentsToCreate.length} new student(s)...`);
            availableNis = await getAvailableNisSlots(studentsToCreate.length);

            if (availableNis.length < studentsToCreate.length) {
                log.error(
                    `Not enough NIS slots available. Need ${studentsToCreate.length}, got ${availableNis.length}`
                );
                stats.errors.push({
                    type: "NIS_SHORTAGE",
                    message: `Not enough NIS slots: need ${studentsToCreate.length}, available ${availableNis.length}`,
                });
                return;
            }
            log.success(`Prepared ${availableNis.length} NIS slot(s)`);
        }

        // Step 5: Get current teacher count for NIG generation
        let teacherCount = await Teacher.countDocuments();
        log.verbose(`Current teacher count: ${teacherCount}`);

        // Step 6: Process each ticket
        log.info("\n🔄 Processing tickets...");

        let nisIndex = 0;

        for (const { ticket, students, teachers } of ticketAccounts) {
            log.info(`\n📋 Ticket: ${ticket.ticketId}`);
            log.verbose(`   SubBranch ID: ${ticket.subBranchId}`);

            // Process students
            for (const acc of students) {
                const exists = await studentExists(acc, ticket.subBranchId);

                if (exists) {
                    log.verbose(`   └── Student "${acc.name}": Already exists - skipped`);
                    continue;
                }

                const nis = availableNis[nisIndex++];

                if (isDryRun) {
                    log.info(`   └── Student "${acc.name}": Would create with NIS ${nis}`);
                    stats.studentsCreated++;
                } else {
                    const session = await mongoose.startSession();
                    session.startTransaction();

                    try {
                        await createStudentAccount(acc, nis, ticket.subBranchId, session);
                        await session.commitTransaction();
                        stats.studentsCreated++;
                        log.success(`   └── Student "${acc.name}": Created with NIS ${nis}`);
                    } catch (err) {
                        await session.abortTransaction();
                        log.error(`   └── Student "${acc.name}": Failed - ${err.message}`);
                        stats.errors.push({
                            type: "STUDENT_CREATION_ERROR",
                            name: acc.name,
                            message: err.message,
                        });
                    } finally {
                        session.endSession();
                    }
                }
            }

            // Process teachers
            for (const acc of teachers) {
                if (!acc.email) {
                    log.warning(`   └── Teacher "${acc.name}": No email provided - skipped`);
                    stats.errors.push({
                        type: "MISSING_EMAIL",
                        name: acc.name,
                        message: "Teacher account missing email",
                    });
                    continue;
                }

                const exists = await teacherExists(acc.email);

                if (exists) {
                    stats.teachersSkipped++;
                    log.verbose(`   └── Teacher "${acc.name}": Already exists - skipped`);
                    continue;
                }

                teacherCount++;
                const nig = generateNig(acc.dateOfBirth, teacherCount);

                if (isDryRun) {
                    log.info(`   └── Teacher "${acc.name}": Would create with NIG ${nig}`);
                    stats.teachersCreated++;
                } else {
                    const session = await mongoose.startSession();
                    session.startTransaction();

                    try {
                        await createTeacherAccount(acc, nig, ticket.subBranchId, session);
                        await session.commitTransaction();
                        stats.teachersCreated++;
                        log.success(`   └── Teacher "${acc.name}": Created with NIG ${nig}`);
                    } catch (err) {
                        await session.abortTransaction();
                        teacherCount--; // Rollback counter
                        log.error(`   └── Teacher "${acc.name}": Failed - ${err.message}`);
                        stats.errors.push({
                            type: "TEACHER_CREATION_ERROR",
                            name: acc.name,
                            email: acc.email,
                            message: err.message,
                        });
                    } finally {
                        session.endSession();
                    }
                }
            }
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
    console.log(`Total Tickets:           ${stats.totalTickets}`);
    console.log(`Total Accounts:          ${stats.totalAccounts}`);
    console.log(`Students ${isDryRun ? "to Create" : "Created"}:     ${stats.studentsCreated}`);
    console.log(`Students Skipped:        ${stats.studentsSkipped} (already exist)`);
    console.log(`Teachers ${isDryRun ? "to Create" : "Created"}:     ${stats.teachersCreated}`);
    console.log(`Teachers Skipped:        ${stats.teachersSkipped} (already exist)`);
    console.log(`Errors:                  ${stats.errors.length}`);
    console.log(`Duration:                ${duration}s`);

    if (stats.errors.length > 0) {
        log.section("⚠️  ERRORS ENCOUNTERED");
        stats.errors.forEach((err, index) => {
            console.log(`\n${index + 1}. ${err.type}`);
            console.log(`   Message: ${err.message}`);
            if (err.name) console.log(`   Name: ${err.name}`);
            if (err.email) console.log(`   Email: ${err.email}`);
        });
    }

    console.log("\n" + "=".repeat(50));

    if (isDryRun) {
        log.warning("⚠️  DRY RUN COMPLETE - No data was modified");
        log.info("💡 Run without --dry-run flag to create missing records");
    } else {
        log.success("✅ Sync completed!");
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
        await syncApprovedTickets();

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
