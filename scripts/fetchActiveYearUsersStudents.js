const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const AcademicYear = require('../models/academicYear');
const Branch = require('../models/branch');
const BranchYear = require('../models/branchYear');
const Class = require('../models/class');
const Student = require('../models/student');
const User = require('../models/user');

const args = process.argv.slice(2);
const isVerbose = args.includes('--verbose');
const branchNamesArg = args.find(arg => arg.startsWith('--branch-names='));

const OUTPUT_DIR = path.join(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'active-year-users-students.json');

const stats = {
  branchesFetched: 0,
  selectedBranches: 0,
  branchYears: 0,
  teachingGroups: 0,
  classes: 0,
  students: 0,
  outputRecords: 0,
  skippedNoUser: 0,
  activeAcademicYear: null,
};

function excludeSensitive(user) {
  const obj = user.toObject ? user.toObject() : { ...user };
  delete obj.password;
  delete obj.resetToken;
  delete obj.resetTokenExpiration;
  return obj;
}

function prefixFields(obj, prefix) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[`${prefix}_${key}`] = value instanceof Date ? value.toISOString() : value;
  }
  return result;
}

async function getBranchesInteractive() {
  const branches = await Branch.find().lean();
  stats.branchesFetched = branches.length;

  if (branches.length === 0) {
    console.error('❌ No branches found in database');
    process.exit(1);
  }

  console.log(`📋 Found ${branches.length} branches`);

  if (branchNamesArg) {
    const names = branchNamesArg.split('=')[1].split(',').map(n => n.trim());
    const selected = branches.filter(b => names.includes(b.name));
    if (selected.length === 0) {
      console.error(`❌ No branches matched names: ${names.join(', ')}`);
      console.error(`   Available: ${branches.map(b => b.name).join(', ')}`);
      process.exit(1);
    }
    stats.selectedBranches = selected.length;
    console.log(`✅ Selected branches: ${selected.map(b => b.name).join(', ')}`);
    return selected.map(b => ({ _id: b._id, name: b.name }));
  }

  const { MultiSelect } = require('enquirer');
  const prompt = new MultiSelect({
    name: 'branches',
    message: 'Select branches to include:',
    choices: branches.map(b => ({ name: b.name, value: b._id })),
    indicator: ' ',
    validate(selected) {
      return selected.length > 0 ? true : 'Select at least one branch';
    },
  });

  const selectedNames = await prompt.run();
  const selected = branches.filter(b => selectedNames.includes(b.name));
  stats.selectedBranches = selected.length;
  console.log(`✅ Selected: ${selected.map(b => b.name).join(', ')}`);
  return selected.map(b => ({ _id: b._id, name: b.name }));
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Fetch Active Year Users & Students');
  console.log('═══════════════════════════════════════════════════════════\n');

  const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    // 1. Interactive branch selection
    console.log('📋 Fetching branches...');
    const selectedBranches = await getBranchesInteractive();
    console.log('');

    // 2. Find active academic year
    console.log('📋 Finding active academic year...');
    const activeAcademicYear = await AcademicYear.findOne({ isActive: true }).lean();
    if (!activeAcademicYear) {
      console.error('❌ No active academic year found (isActive: true)');
      process.exit(1);
    }
    stats.activeAcademicYear = activeAcademicYear._id;
    if (isVerbose) {
      console.log(`   ID: ${activeAcademicYear._id}`);
    }
    console.log(`✅ Found: ${activeAcademicYear.name}\n`);

    // 3. Find branch years for selected branches + active academic year
    const selectedBranchIds = selectedBranches.map(b => b._id);
    console.log('📋 Finding branch years...');
    const branchYears = await BranchYear.find({
      branchId: { $in: selectedBranchIds },
      academicYearId: activeAcademicYear._id,
    }).lean();
    stats.branchYears = branchYears.length;

    if (branchYears.length === 0) {
      console.error('❌ No branch years found for selected branches in active academic year');
      process.exit(1);
    }
    console.log(`✅ Found ${branchYears.length} branch year(s)\n`);

    // 4. Collect teaching group IDs
    const teachingGroupIds = [
      ...new Set(branchYears.flatMap(by => by.teachingGroups.map(id => id.toString()))),
    ];
    stats.teachingGroups = teachingGroupIds.length;
    if (isVerbose) {
      console.log(`📋 Teaching group IDs: ${teachingGroupIds.length}`);
      for (const tgId of teachingGroupIds) {
        console.log(`   - ${tgId}`);
      }
    }

    if (teachingGroupIds.length === 0) {
      console.error('❌ No teaching groups found in selected branch years');
      process.exit(1);
    }

    // 5. Find classes
    console.log('📋 Finding classes...');
    const classes = await Class.find({
      teachingGroupId: { $in: teachingGroupIds },
    }).lean();
    stats.classes = classes.length;
    console.log(`✅ Found ${classes.length} class(es)\n`);

    if (classes.length === 0) {
      console.error('❌ No classes found in selected teaching groups');
      process.exit(1);
    }

    // 6. Build class lookup map
    const classMap = {};
    for (const cls of classes) {
      classMap[cls._id.toString()] = cls;
    }
    const classIds = classes.map(c => c._id);

    // 7. Find students
    console.log('📋 Finding students...');
    const students = await Student.find({
      classIds: { $in: classIds },
    }).populate('userId');
    stats.students = students.length;
    console.log(`✅ Found ${students.length} student(s)\n`);

    // 8. Build output records
    console.log('📋 Building output records...');
    const records = [];

    for (const student of students) {
      const user = student.userId;
      if (!user) {
        stats.skippedNoUser++;
        if (isVerbose) {
          console.log(`   ⚠️  Student "${student.name}" (${student.nis}) has no linked user, skipping`);
        }
        continue;
      }

      const userObj = excludeSensitive(user);
      const userPrefixed = prefixFields(userObj, 'user');

      const studentObj = student.toObject ? student.toObject() : { ...student };
      delete studentObj.userId;
      const studentPrefixed = prefixFields(studentObj, 'student');

      for (const classIdRef of student.classIds) {
        const classIdStr = classIdRef.toString();
        const cls = classMap[classIdStr];
        if (!cls) continue;

        const classPrefixed = prefixFields(cls, 'class');

        records.push({
          ...userPrefixed,
          ...studentPrefixed,
          ...classPrefixed,
        });
      }
    }
    stats.outputRecords = records.length;
    console.log(`✅ Built ${records.length} record(s)`);
    if (stats.skippedNoUser > 0) {
      console.log(`   ⚠️  Skipped ${stats.skippedNoUser} student(s) with no linked user`);
    }
    console.log('');

    // 9. Write output file
    console.log('📋 Writing output file...');
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const output = {
      meta: {
        script: 'fetchActiveYearUsersStudents',
        generatedAt: new Date().toISOString(),
        academicYear: {
          _id: activeAcademicYear._id,
          name: activeAcademicYear.name,
        },
        selectedBranches: selectedBranches.map(b => ({
          _id: b._id,
          name: b.name,
        })),
        totalRecords: records.length,
      },
      data: records,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`✅ Written to ${OUTPUT_FILE}\n`);

    // 10. Summary
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  Summary');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`Academic Year:      ${activeAcademicYear.name}`);
    console.log(`Selected Branches:  ${stats.selectedBranches}`);
    console.log(`Branch Years:       ${stats.branchYears}`);
    console.log(`Teaching Groups:    ${stats.teachingGroups}`);
    console.log(`Classes:            ${stats.classes}`);
    console.log(`Students:           ${stats.students}`);
    console.log(`Output Records:     ${stats.outputRecords}`);
    if (stats.skippedNoUser > 0) {
      console.log(`Skipped (no user):  ${stats.skippedNoUser}`);
    }
    console.log(`Output File:        ${OUTPUT_FILE}`);
    console.log('═══════════════════════════════════════════════════════════');
    console.log('✅ Script completed successfully!');
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database connection closed');
  }
}

main();
