const mongoose = require('mongoose');
require('dotenv').config();

const Class = require('../models/class');
const Student = require('../models/student');
const BranchYear = require('../models/branchYear');
const TeachingGroup = require('../models/teachingGroup');

/**
 * Script to synchronize the bidirectional relationship between Classes and Students
 * 
 * Options:
 * --mode=class-to-student : Sync from classes to students (add missing classIds to students)
 * --mode=student-to-class : Sync from students to classes (add missing students to classes)
 * --mode=both : Sync in both directions (default)
 * --branch-year=NAME : Only sync classes within specified BranchYear (e.g., --branch-year=20252)
 * --dry-run : Show what would be changed without making changes
 * --verbose : Show detailed information
 */

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const modeArg = args.find(arg => arg.startsWith('--mode='));
const mode = modeArg ? modeArg.split('=')[1] : 'both';
const branchYearArg = args.find(arg => arg.startsWith('--branch-year='));
const targetBranchYearName = branchYearArg ? branchYearArg.split('=')[1] : null;

// Validate mode
const validModes = ['class-to-student', 'student-to-class', 'both'];
if (!validModes.includes(mode)) {
    console.error(`❌ Invalid mode: ${mode}`);
    console.error(`   Valid modes: ${validModes.join(', ')}`);
    process.exit(1);
}

// Statistics tracking
const stats = {
    totalClasses: 0,
    totalStudents: 0,
    studentsUpdated: 0,
    classesUpdated: 0,
    studentClassIdsAdded: 0,
    classStudentsAdded: 0,
    errors: 0,
    targetBranchYear: targetBranchYearName || 'All'
};

/**
 * Get class IDs filtered by branch year if specified
 */
async function getFilteredClassIds() {
    if (!targetBranchYearName) {
        return null; // No filter, return all
    }
    
    if (isVerbose) {
        console.log(`   🔍 Filtering by BranchYear: ${targetBranchYearName}`);
    }
    
    // Find target branch years
    const branchYears = await BranchYear.find({ name: targetBranchYearName }).lean();
    
    if (branchYears.length === 0) {
        console.error(`❌ No BranchYear found with name '${targetBranchYearName}'`);
        process.exit(1);
    }
    
    if (isVerbose) {
        console.log(`   Found ${branchYears.length} BranchYear(s)`);
    }
    
    // Find teaching groups for these branch years
    const branchYearIds = branchYears.map(by => by._id);
    const teachingGroups = await TeachingGroup.find({ 
        branchYearId: { $in: branchYearIds } 
    }).lean();
    
    if (isVerbose) {
        console.log(`   Found ${teachingGroups.length} TeachingGroup(s)`);
    }
    
    // Find classes for these teaching groups
    const teachingGroupIds = teachingGroups.map(tg => tg._id);
    const classes = await Class.find({ 
        teachingGroupId: { $in: teachingGroupIds } 
    }).lean();
    
    const classIds = classes.map(c => c._id);
    
    if (isVerbose) {
        console.log(`   Found ${classIds.length} Class(es) in target BranchYear`);
    }
    
    return classIds;
}

/**
 * Sync from classes to students
 * If a student is in a class's students array, ensure the class is in student's classIds
 */
async function syncClassesToStudents() {
    console.log('\n📋 Syncing from Classes to Students...');
    
    // Get filtered class IDs if branch year is specified
    const filteredClassIds = await getFilteredClassIds();
    const query = filteredClassIds ? { _id: { $in: filteredClassIds } } : {};
    
    const classes = await Class.find(query).populate('students');
    stats.totalClasses = classes.length;
    
    if (isVerbose) {
        console.log(`   Found ${classes.length} classes to check`);
    }
    
    for (const classDoc of classes) {
        if (!classDoc.students || classDoc.students.length === 0) {
            continue;
        }
        
        for (const student of classDoc.students) {
            if (!student) {
                if (isVerbose) {
                    console.log(`   ⚠️  Class "${classDoc.name}" has invalid student reference`);
                }
                continue;
            }
            
            // Check if class is in student's classIds
            const hasClassId = student.classIds.some(
                id => id.toString() === classDoc._id.toString()
            );
            
            if (!hasClassId) {
                if (isVerbose || isDryRun) {
                    console.log(`   🔄 Student "${student.name}" (${student.nis}) missing class "${classDoc.name}"`);
                }
                
                if (!isDryRun) {
                    try {
                        await Student.updateOne(
                            { _id: student._id },
                            { $addToSet: { classIds: classDoc._id } }
                        );
                        stats.studentClassIdsAdded++;
                        
                        if (isVerbose) {
                            console.log(`   ✅ Added class to student's classIds`);
                        }
                    } catch (error) {
                        console.error(`   ❌ Error updating student ${student.nis}:`, error.message);
                        stats.errors++;
                    }
                } else {
                    stats.studentClassIdsAdded++;
                }
            }
        }
    }
    
    if (stats.studentClassIdsAdded > 0) {
        console.log(`\n✅ Would add ${stats.studentClassIdsAdded} class references to students`);
        if (!isDryRun) {
            console.log(`   Successfully updated ${stats.studentClassIdsAdded} student records`);
        }
    } else {
        console.log('\n✅ All students already have correct class references');
    }
}

/**
 * Sync from students to classes
 * If a class is in a student's classIds, ensure the student is in class's students array
 */
async function syncStudentsToClasses() {
    console.log('\n📋 Syncing from Students to Classes...');
    
    // Get filtered class IDs if branch year is specified
    const filteredClassIds = await getFilteredClassIds();
    
    const students = await Student.find().populate('classIds');
    stats.totalStudents = students.length;
    
    if (isVerbose) {
        console.log(`   Found ${students.length} students to check`);
    }
    
    for (const student of students) {
        if (!student.classIds || student.classIds.length === 0) {
            continue;
        }
        
        for (const classDoc of student.classIds) {
            if (!classDoc) {
                if (isVerbose) {
                    console.log(`   ⚠️  Student "${student.name}" (${student.nis}) has invalid class reference`);
                }
                continue;
            }
            
            // Skip if filtering by branch year and class is not in the filtered list
            if (filteredClassIds && !filteredClassIds.some(id => id.toString() === classDoc._id.toString())) {
                continue;
            }
            
            // Check if student is in class's students array
            const hasStudent = classDoc.students.some(
                id => id.toString() === student._id.toString()
            );
            
            if (!hasStudent) {
                if (isVerbose || isDryRun) {
                    console.log(`   🔄 Class "${classDoc.name}" missing student "${student.name}" (${student.nis})`);
                }
                
                if (!isDryRun) {
                    try {
                        await Class.updateOne(
                            { _id: classDoc._id },
                            { $addToSet: { students: student._id } }
                        );
                        stats.classStudentsAdded++;
                        
                        if (isVerbose) {
                            console.log(`   ✅ Added student to class's students array`);
                        }
                    } catch (error) {
                        console.error(`   ❌ Error updating class ${classDoc.name}:`, error.message);
                        stats.errors++;
                    }
                } else {
                    stats.classStudentsAdded++;
                }
            }
        }
    }
    
    if (stats.classStudentsAdded > 0) {
        console.log(`\n✅ Would add ${stats.classStudentsAdded} student references to classes`);
        if (!isDryRun) {
            console.log(`   Successfully updated ${stats.classStudentsAdded} class records`);
        }
    } else {
        console.log('\n✅ All classes already have correct student references');
    }
}

/**
 * Check for orphaned references (references that point to non-existent documents)
 */
async function checkOrphanedReferences() {
    console.log('\n🔍 Checking for orphaned references...');
    
    let orphanedFound = false;
    
    // Check for classes with invalid student references
    const classes = await Class.find();
    for (const classDoc of classes) {
        if (classDoc.students && classDoc.students.length > 0) {
            for (const studentId of classDoc.students) {
                const studentExists = await Student.findById(studentId);
                if (!studentExists) {
                    console.log(`   ⚠️  Class "${classDoc.name}" references non-existent student: ${studentId}`);
                    orphanedFound = true;
                }
            }
        }
    }
    
    // Check for students with invalid class references
    const students = await Student.find();
    for (const student of students) {
        if (student.classIds && student.classIds.length > 0) {
            for (const classId of student.classIds) {
                const classExists = await Class.findById(classId);
                if (!classExists) {
                    console.log(`   ⚠️  Student "${student.name}" (${student.nis}) references non-existent class: ${classId}`);
                    orphanedFound = true;
                }
            }
        }
    }
    
    if (!orphanedFound) {
        console.log('   ✅ No orphaned references found');
    }
}

/**
 * Main execution function
 */
async function main() {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Class-Student Relationship Synchronization Script');
    console.log('═══════════════════════════════════════════════════════════\n');
    
    console.log(`Mode: ${mode}`);
    console.log(`Branch Year: ${targetBranchYearName || 'All'}`);
    console.log(`Dry Run: ${isDryRun ? 'Yes' : 'No'}`);
    console.log(`Verbose: ${isVerbose ? 'Yes' : 'No'}`);
    
    if (isDryRun) {
        console.log('\n⚠️  DRY RUN MODE - No changes will be made\n');
    }
    
    try {
        // Connect to MongoDB
        const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;
        
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Execute based on mode
        if (mode === 'class-to-student' || mode === 'both') {
            await syncClassesToStudents();
        }
        
        if (mode === 'student-to-class' || mode === 'both') {
            await syncStudentsToClasses();
        }
        
        // Check for orphaned references
        await checkOrphanedReferences();
        
        // Print summary
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('  Summary');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`Target Branch Year: ${stats.targetBranchYear}`);
        
        if (mode === 'both' || mode === 'class-to-student') {
            console.log(`Total Classes Checked: ${stats.totalClasses}`);
            console.log(`Class References Added to Students: ${stats.studentClassIdsAdded}`);
        }
        
        if (mode === 'both' || mode === 'student-to-class') {
            console.log(`Total Students Checked: ${stats.totalStudents}`);
            console.log(`Student References Added to Classes: ${stats.classStudentsAdded}`);
        }
        
        if (stats.errors > 0) {
            console.log(`\n⚠️  Errors Encountered: ${stats.errors}`);
        }
        
        if (isDryRun) {
            console.log('\n💡 Run without --dry-run to apply changes');
        } else {
            console.log('\n✅ Synchronization complete!');
        }
        
    } catch (error) {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Database connection closed');
    }
}

// Run the script
main();
