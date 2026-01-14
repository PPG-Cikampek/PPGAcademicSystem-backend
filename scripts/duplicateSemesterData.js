// scripts/duplicateSemesterData.js
// Duplicates branchYears, teachingGroups, and classes for a new semester
// Usage: node scripts/duplicateSemesterData.js [--dry-run] [--verbose] [--no-upgrade]

const mongoose = require("mongoose");
require("dotenv").config();

// Import models
const AcademicYear = require("../models/academicYear");
const BranchYear = require("../models/branchYear");
const TeachingGroup = require("../models/teachingGroup");
const Class = require("../models/class");
const Teacher = require("../models/teacher");
const Student = require("../models/student");

// Configuration
const SOURCE_BRANCH_YEAR_NAME = "20251";
const TARGET_BRANCH_YEAR_NAME = "20252";
const TARGET_ACADEMIC_YEAR_ID = "6960e71e41ef4e51e46a435b";

// Class name upgrade mapping
const CLASS_UPGRADE_MAP = {
    "Kelas PRA-PAUD": "Kelas PAUD",
    "Kelas PAUD": "Kelas 1",
    "Kelas 1": "Kelas 2",
    "Kelas 2": "Kelas 3",
    "Kelas 3": "Kelas 4",
    "Kelas 4": "Kelas 5",
    "Kelas 5": "Kelas 6",
    "Kelas 6": "Kelas 7",
    "Kelas 7": "Kelas 8",
    "Kelas 8": "Kelas 9",
    "Kelas Khusus": "Kelas Khusus",
};

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");
const noUpgrade = args.includes("--no-upgrade");

// Statistics tracking
const stats = {
    branchYearsCreated: 0,
    branchYearsSkipped: 0,
    teachingGroupsCreated: 0,
    teachingGroupsSkipped: 0,
    classesCreated: 0,
    classesSkipped: 0,
    classesAlreadyExist: 0,
    teachersUpdated: 0,
    studentsUpdated: 0,
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
 * Main function to duplicate semester data
 */
async function duplicateSemesterData() {
    log.section(`🚀 SEMESTER DATA DUPLICATION ${isDryRun ? "- DRY RUN MODE" : ""}`);
    log.info(`📅 Source: ${SOURCE_BRANCH_YEAR_NAME} → Target: ${TARGET_BRANCH_YEAR_NAME}`);
    log.info(`🎯 Target Academic Year ID: ${TARGET_ACADEMIC_YEAR_ID}`);
    log.info(`� Class upgrade mode: ${noUpgrade ? "DISABLED (keeping same class names)" : "ENABLED (upgrading class levels)"}`);
    log.info(`�🕐 Started at: ${new Date().toLocaleString()}`);

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

        // Mappings to track old → new ID relationships
        const branchYearMapping = new Map(); // oldId → { newId, branchId }
        const teachingGroupMapping = new Map(); // oldId → newId
        const newBranchYearTeachingGroups = new Map(); // newBranchYearId → [teachingGroupIds]
        const newTeachingGroupClasses = new Map(); // newTeachingGroupId → [classIds]

        // ============================================================
        // PHASE 1: Duplicate BranchYears
        // ============================================================
        log.section("PHASE 1: Duplicating BranchYears");

        const sourceBranchYears = await BranchYear.find({ name: SOURCE_BRANCH_YEAR_NAME }).lean();

        if (sourceBranchYears.length === 0) {
            throw new Error(`No BranchYears found with name '${SOURCE_BRANCH_YEAR_NAME}'`);
        }

        log.info(`Found ${sourceBranchYears.length} BranchYears to duplicate`);

        for (const branchYear of sourceBranchYears) {
            log.verbose(`Processing BranchYear: ${branchYear._id} (Branch: ${branchYear.branchId})`);

            // Idempotency check: see if target BranchYear already exists for this branch
            const existingBranchYear = await BranchYear.findOne({
                name: TARGET_BRANCH_YEAR_NAME,
                branchId: branchYear.branchId,
            }).lean();

            if (existingBranchYear) {
                log.verbose(`  → BranchYear already exists: ${existingBranchYear._id} (skipping creation)`);
                branchYearMapping.set(branchYear._id.toString(), {
                    newId: existingBranchYear._id,
                    branchId: branchYear.branchId,
                    alreadyExisted: true,
                });
                newBranchYearTeachingGroups.set(existingBranchYear._id.toString(), []);
                stats.branchYearsSkipped++;
                continue;
            }

            const newBranchYear = {
                name: TARGET_BRANCH_YEAR_NAME,
                academicYearId: new mongoose.Types.ObjectId(TARGET_ACADEMIC_YEAR_ID),
                branchId: branchYear.branchId,
                isActive: false,
                munaqasyahStatus: "notStarted",
                teachingGroups: [], // Will be populated in Phase 2
            };

            if (!isDryRun) {
                const [created] = await BranchYear.create([newBranchYear], sessionOptions);
                branchYearMapping.set(branchYear._id.toString(), {
                    newId: created._id,
                    branchId: branchYear.branchId,
                    alreadyExisted: false,
                });
                newBranchYearTeachingGroups.set(created._id.toString(), []);
                log.verbose(`  → Created new BranchYear: ${created._id}`);
            } else {
                // For dry run, use a fake ID
                const fakeId = new mongoose.Types.ObjectId();
                branchYearMapping.set(branchYear._id.toString(), {
                    newId: fakeId,
                    branchId: branchYear.branchId,
                    alreadyExisted: false,
                });
                newBranchYearTeachingGroups.set(fakeId.toString(), []);
                log.verbose(`  → Would create new BranchYear (dry run)`);
            }

            stats.branchYearsCreated++;
        }

        log.success(`Phase 1 complete: ${stats.branchYearsCreated} BranchYears ${isDryRun ? "would be " : ""}created, ${stats.branchYearsSkipped} already existed (skipped)`);

        // ============================================================
        // PHASE 2: Duplicate TeachingGroups
        // ============================================================
        log.section("PHASE 2: Duplicating TeachingGroups");

        for (const [oldBranchYearId, mapping] of branchYearMapping) {
            const teachingGroups = await TeachingGroup.find({
                branchYearId: new mongoose.Types.ObjectId(oldBranchYearId),
            }).lean();

            log.verbose(`Processing ${teachingGroups.length} TeachingGroups for BranchYear ${oldBranchYearId}`);

            for (const tg of teachingGroups) {
                log.verbose(`  Processing TeachingGroup: ${tg.name} (${tg._id})`);

                // Idempotency check: see if TeachingGroup with same name already exists in target BranchYear
                const existingTeachingGroup = await TeachingGroup.findOne({
                    name: tg.name,
                    branchYearId: mapping.newId,
                }).lean();

                if (existingTeachingGroup) {
                    log.verbose(`    → TeachingGroup already exists: ${existingTeachingGroup._id} (skipping creation)`);
                    teachingGroupMapping.set(tg._id.toString(), existingTeachingGroup._id);
                    newTeachingGroupClasses.set(existingTeachingGroup._id.toString(), []);

                    // Still track for BranchYear update (in case it's missing from the array)
                    const tgList = newBranchYearTeachingGroups.get(mapping.newId.toString());
                    tgList.push(existingTeachingGroup._id);

                    stats.teachingGroupsSkipped++;
                    continue;
                }

                const newTeachingGroup = {
                    name: tg.name,
                    address: tg.address,
                    isLocked: false,
                    branchYearId: mapping.newId,
                    subBranches: tg.subBranches || [],
                    classes: [], // Will be populated in Phase 3
                };

                if (!isDryRun) {
                    const [created] = await TeachingGroup.create([newTeachingGroup], sessionOptions);
                    teachingGroupMapping.set(tg._id.toString(), created._id);
                    newTeachingGroupClasses.set(created._id.toString(), []);

                    // Track for later update to BranchYear
                    const tgList = newBranchYearTeachingGroups.get(mapping.newId.toString());
                    tgList.push(created._id);

                    log.verbose(`    → Created new TeachingGroup: ${created._id}`);
                } else {
                    const fakeId = new mongoose.Types.ObjectId();
                    teachingGroupMapping.set(tg._id.toString(), fakeId);
                    newTeachingGroupClasses.set(fakeId.toString(), []);

                    const tgList = newBranchYearTeachingGroups.get(mapping.newId.toString());
                    tgList.push(fakeId);

                    log.verbose(`    → Would create new TeachingGroup (dry run)`);
                }

                stats.teachingGroupsCreated++;
            }
        }

        log.success(`Phase 2 complete: ${stats.teachingGroupsCreated} TeachingGroups ${isDryRun ? "would be " : ""}created, ${stats.teachingGroupsSkipped} already existed (skipped)`);

        // ============================================================
        // PHASE 3: Duplicate & Upgrade Classes
        // ============================================================
        log.section(`PHASE 3: ${noUpgrade ? "Duplicating" : "Duplicating & Upgrading"} Classes`);

        for (const [oldTeachingGroupId, newTeachingGroupId] of teachingGroupMapping) {
            const classes = await Class.find({
                teachingGroupId: new mongoose.Types.ObjectId(oldTeachingGroupId),
            }).lean();

            log.verbose(`Processing ${classes.length} Classes for TeachingGroup ${oldTeachingGroupId}`);

            for (const cls of classes) {
                // Determine the class name for the new semester
                let newClassName;
                
                if (noUpgrade) {
                    // No upgrade mode: keep the same class name
                    newClassName = cls.name;
                    log.verbose(`  Duplicating Class: '${cls.name}' (no upgrade)`);
                } else {
                    // Upgrade mode: skip Kelas 9 and upgrade others
                    if (cls.name === "Kelas 9") {
                        log.verbose(`  Skipping '${cls.name}' (graduation class)`);
                        stats.classesSkipped++;
                        continue;
                    }

                    // Get upgraded class name
                    const upgradedName = CLASS_UPGRADE_MAP[cls.name];
                    if (!upgradedName) {
                        log.warning(`  Unknown class name '${cls.name}', skipping...`);
                        stats.classesSkipped++;
                        continue;
                    }
                    
                    newClassName = upgradedName;
                    log.verbose(`  Upgrading Class: '${cls.name}' → '${newClassName}'`);
                }

                // Idempotency check: see if Class with same name already exists in target TeachingGroup
                const existingClass = await Class.findOne({
                    name: newClassName,
                    teachingGroupId: newTeachingGroupId,
                }).lean();

                if (existingClass) {
                    log.verbose(`    → Class '${newClassName}' already exists: ${existingClass._id} (skipping creation)`);
                    
                    // Still track for TeachingGroup update (in case it's missing from the array)
                    const classList = newTeachingGroupClasses.get(newTeachingGroupId.toString());
                    classList.push(existingClass._id);

                    stats.classesAlreadyExist++;
                    continue;
                }

                const newClass = {
                    name: newClassName,
                    startTime: cls.startTime,
                    endTime: cls.endTime,
                    isLocked: false,
                    teachers: cls.teachers || [],
                    students: cls.students || [],
                    teachingGroupId: newTeachingGroupId,
                };

                if (!isDryRun) {
                    const [created] = await Class.create([newClass], sessionOptions);

                    // Track for later update to TeachingGroup
                    const classList = newTeachingGroupClasses.get(newTeachingGroupId.toString());
                    classList.push(created._id);

                    log.verbose(`    → Created new Class: ${created._id}`);

                    // Update teachers' classIds
                    if (cls.teachers && cls.teachers.length > 0) {
                        for (const teacherId of cls.teachers) {
                            await Teacher.findByIdAndUpdate(
                                teacherId,
                                { $addToSet: { classIds: created._id } },
                                sessionOptions
                            );
                            stats.teachersUpdated++;
                        }
                        log.verbose(`    → Updated ${cls.teachers.length} teacher(s) with new class`);
                    }

                    // Update students' classIds
                    if (cls.students && cls.students.length > 0) {
                        for (const studentId of cls.students) {
                            await Student.findByIdAndUpdate(
                                studentId,
                                { $addToSet: { classIds: created._id } },
                                sessionOptions
                            );
                            stats.studentsUpdated++;
                        }
                        log.verbose(`    → Updated ${cls.students.length} student(s) with new class`);
                    }
                } else {
                    const fakeId = new mongoose.Types.ObjectId();
                    const classList = newTeachingGroupClasses.get(newTeachingGroupId.toString());
                    classList.push(fakeId);

                    log.verbose(`    → Would create new Class (dry run)`);
                    
                    // Count teachers that would be updated in dry run
                    if (cls.teachers && cls.teachers.length > 0) {
                        stats.teachersUpdated += cls.teachers.length;
                        log.verbose(`    → Would update ${cls.teachers.length} teacher(s)`);
                    }

                    // Count students that would be updated in dry run
                    if (cls.students && cls.students.length > 0) {
                        stats.studentsUpdated += cls.students.length;
                        log.verbose(`    → Would update ${cls.students.length} student(s)`);
                    }
                }

                stats.classesCreated++;
            }
        }

        log.success(`Phase 3 complete: ${stats.classesCreated} Classes ${isDryRun ? "would be " : ""}created, ${stats.classesSkipped} skipped (graduation/unknown), ${stats.classesAlreadyExist} already existed`);

        // ============================================================
        // PHASE 4: Update TeachingGroup.classes[] arrays
        // ============================================================
        log.section("PHASE 4: Updating TeachingGroup.classes[] arrays");

        if (!isDryRun) {
            for (const [tgId, classIds] of newTeachingGroupClasses) {
                // Use $addToSet to avoid duplicates when re-running
                await TeachingGroup.findByIdAndUpdate(
                    tgId,
                    { $addToSet: { classes: { $each: classIds } } },
                    sessionOptions
                );
                log.verbose(`Updated TeachingGroup ${tgId} with ${classIds.length} classes (using $addToSet)`);
            }
        }

        log.success(`Phase 4 complete: ${newTeachingGroupClasses.size} TeachingGroups ${isDryRun ? "would be " : ""}updated`);

        // ============================================================
        // PHASE 5: Update BranchYear.teachingGroups[] arrays
        // ============================================================
        log.section("PHASE 5: Updating BranchYear.teachingGroups[] arrays");

        if (!isDryRun) {
            for (const [byId, tgIds] of newBranchYearTeachingGroups) {
                // Use $addToSet to avoid duplicates when re-running
                await BranchYear.findByIdAndUpdate(
                    byId,
                    { $addToSet: { teachingGroups: { $each: tgIds } } },
                    sessionOptions
                );
                log.verbose(`Updated BranchYear ${byId} with ${tgIds.length} teachingGroups (using $addToSet)`);
            }
        }

        log.success(`Phase 5 complete: ${newBranchYearTeachingGroups.size} BranchYears ${isDryRun ? "would be " : ""}updated`);

        // ============================================================
        // PHASE 6: Update AcademicYear.branchYears[]
        // ============================================================
        log.section("PHASE 6: Updating AcademicYear.branchYears[]");

        const newBranchYearIds = Array.from(branchYearMapping.values()).map((m) => m.newId);

        if (!isDryRun) {
            await AcademicYear.findByIdAndUpdate(
                TARGET_ACADEMIC_YEAR_ID,
                { $push: { branchYears: { $each: newBranchYearIds } } },
                sessionOptions
            );
            log.verbose(`Pushed ${newBranchYearIds.length} BranchYear IDs to AcademicYear`);
        }

        log.success(`Phase 6 complete: ${newBranchYearIds.length} BranchYear IDs ${isDryRun ? "would be " : ""}added to AcademicYear`);

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
│  SEMESTER DATA DUPLICATION ${isDryRun ? "(DRY RUN)" : "COMPLETE"}                    │
├─────────────────────────────────────────────────────────┤
│  Source Branch Year:    ${SOURCE_BRANCH_YEAR_NAME.padEnd(32)}│
│  Target Branch Year:    ${TARGET_BRANCH_YEAR_NAME.padEnd(32)}│
│  Upgrade Mode:          ${(noUpgrade ? "Disabled" : "Enabled").padEnd(32)}│
├─────────────────────────────────────────────────────────┤
│  BranchYears created:   ${String(stats.branchYearsCreated).padEnd(32)}│
│  BranchYears skipped:   ${String(stats.branchYearsSkipped).padEnd(32)}│
│  TeachingGroups created:${String(stats.teachingGroupsCreated).padEnd(32)}│
│  TeachingGroups skipped:${String(stats.teachingGroupsSkipped).padEnd(32)}│
│  Classes created:       ${String(stats.classesCreated).padEnd(32)}│
│  Classes skipped:       ${String(stats.classesSkipped).padEnd(32)}│
│  Classes already exist: ${String(stats.classesAlreadyExist).padEnd(32)}│
│  Teachers updated:      ${String(stats.teachersUpdated).padEnd(32)}│
│  Students updated:      ${String(stats.studentsUpdated).padEnd(32)}│
├─────────────────────────────────────────────────────────┤
│  Duration:              ${(duration + " seconds").padEnd(32)}│
│  Errors:                ${String(stats.errors.length).padEnd(32)}│
└─────────────────────────────────────────────────────────┘
`);

    if (isDryRun) {
        log.warning("This was a DRY RUN - no data was actually modified.");
        log.info("Run without --dry-run flag to apply changes.");
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

        await duplicateSemesterData();

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
