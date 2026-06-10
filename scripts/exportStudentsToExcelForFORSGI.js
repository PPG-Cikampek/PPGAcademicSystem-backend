const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
require('dotenv').config();

const AcademicYear = require('../models/academicYear');
const Branch = require('../models/branch');
const SubBranch = require('../models/subBranch');
const BranchYear = require('../models/branchYear');
const TeachingGroup = require('../models/teachingGroup');
const Class = require('../models/class');
const Student = require('../models/student');
const User = require('../models/user');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const branchNamesArg = args.find(arg => arg.startsWith('--branch-names='));

const OUTPUT_DIR = path.join(__dirname, 'output');
const MONGO_URI = `mongodb://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0-shard-00-00.eupjv.mongodb.net:27017,cluster0-shard-00-01.eupjv.mongodb.net:27017,cluster0-shard-00-02.eupjv.mongodb.net:27017/${process.env.DB_NAME}?ssl=true&replicaSet=atlas-cph2wz-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0`;

const stats = {
  academicYearName: '',
  branchesSelected: 0,
  totalStudentsExported: 0,
  studentsWithClass: 0,
  studentsWithoutClass: 0,
  startTime: Date.now(),
  errors: [],
};

const log = {
  info: (msg) => console.log(`  ${msg}`),
  success: (msg) => console.log(`  ${msg}`),
  warning: (msg) => console.log(`  ${msg}`),
  error: (msg) => console.log(`  ${msg}`),
  verbose: (msg) => { if (isVerbose) console.log(`    ${msg}`); },
  section: (msg) => console.log(`\n${'='.repeat(55)}\n${msg}\n${'='.repeat(55)}`),
};

async function selectBranches() {
  const branches = await Branch.find().lean();
  if (branches.length === 0) {
    log.error('No branches found');
    process.exit(1);
  }
  log.info(`Found ${branches.length} branches`);

  if (branchNamesArg) {
    const names = branchNamesArg.split('=')[1].split(',').map(n => n.trim());
    const selected = branches.filter(b => names.includes(b.name));
    if (selected.length === 0) {
      log.error(`No branches matched: ${names.join(', ')}`);
      log.info(`Available: ${branches.map(b => b.name).join(', ')}`);
      process.exit(1);
    }
    return selected;
  }

  const { MultiSelect } = require('enquirer');
  const prompt = new MultiSelect({
    name: 'branches',
    message: 'Select branches:',
    choices: branches.map(b => ({ name: b.name, value: b._id })),
    indicator: ' ',
    validate(selected) { return selected.length > 0 ? true : 'Select at least one branch'; },
  });

  const selectedNames = await prompt.run();
  return branches.filter(b => selectedNames.includes(b.name));
}

function classSortKey(classDoc) {
  if (!classDoc) return 999;
  const name = (classDoc.name || '').toLowerCase().replace(/-/g, ' ');
  if (name.includes('pra paud')) return 0;
  if (name.includes('paud') && !name.includes('pra')) return 1;
  const match = name.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 12) return num + 1;
  }
  return 50;
}

const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function formatDate(d) {
  return `${String(d.getDate()).padStart(2, '0')} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
}

function calcAge(d) {
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}

function isInAllowedGrades(classDoc) {
  if (!classDoc) return false;
  const name = (classDoc.name || '').toLowerCase().replace(/-/g, ' ');
  if (name.includes('pra paud')) return true;
  if (name.includes('paud')) return true;
  const match = name.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 7) return true;
  }
  return false;
}

function isFlagged(entry) {
  if (!entry.hasClass) return true;

  const student = entry.student;
  const dob = student.dateOfBirth ? new Date(student.dateOfBirth) : null;
  const hasValidDOB = dob && !isNaN(dob.getTime());

  if (!hasValidDOB) {
    if (!isInAllowedGrades(entry.classDoc)) return true;
  }

  if (hasValidDOB) {
    const age = calcAge(dob);
    if (age < 7) return true;
    if (age > 12) return true;
  }

  return false;
}

async function collectBranchData(branch, activeAcademicYear, allEntries) {
  log.section(`Branch: ${branch.name}`);

  const subBranches = await SubBranch.find({ _id: { $in: branch.subBranches || [] } }).lean();
  log.info(`SubBranches: ${subBranches.length}`);

  if (subBranches.length === 0) {
    log.warning(`No subBranches for "${branch.name}" — skip`);
    return;
  }

  const activeBYs = await BranchYear.find({
    branchId: branch._id,
    academicYearId: activeAcademicYear._id,
    isActive: true,
  }).lean();
  log.info(`Active BranchYears: ${activeBYs.length}`);

  if (activeBYs.length === 0) {
    log.warning(`No active BranchYears for "${branch.name}" — skip`);
    return;
  }

  const teachingGroups = await TeachingGroup.find({
    branchYearId: { $in: activeBYs.map(by => by._id) },
  }).lean();
  log.verbose(`TeachingGroups: ${teachingGroups.length}`);

  if (teachingGroups.length === 0) {
    log.warning(`No teaching groups for "${branch.name}" — skip`);
    return;
  }

  const tgMap = {};
  for (const tg of teachingGroups) tgMap[tg._id.toString()] = tg;

  const activeClasses = await Class.find({
    teachingGroupId: { $in: teachingGroups.map(tg => tg._id) },
  }).lean();
  log.verbose(`Active classes: ${activeClasses.length}`);

  if (activeClasses.length === 0) {
    log.warning(`No active classes for "${branch.name}" — skip`);
    return;
  }

  const activeClassIdSet = new Set(activeClasses.map(c => c._id.toString()));
  const activeClassMap = {};
  for (const c of activeClasses) activeClassMap[c._id.toString()] = c;

  const subBranchIds = subBranches.map(sb => sb._id);
  const subBranchIdStrSet = new Set(subBranchIds.map(id => id.toString()));
  const subBranchNameMap = {};
  for (const sb of subBranches) subBranchNameMap[sb._id.toString()] = sb.name;

  const studentsWithClass = await Student.find({
    gender: 'male',
    classIds: { $in: activeClasses.map(c => c._id) },
  }).populate('userId').lean();

  log.info(`Students WITH active class: ${studentsWithClass.length}`);

  const processedUserIds = new Set();
  const branchName = branch.name;

  for (const student of studentsWithClass) {
    const user = student.userId;
    if (!user) {
      stats.errors.push(`Student "${student.name}" (NIS: ${student.nis}) has no linked User — skip`);
      continue;
    }

    const activeStudentClassIds = student.classIds.filter(
      cid => activeClassIdSet.has(cid.toString())
    );

    if (activeStudentClassIds.length > 1) {
      const classNames = activeStudentClassIds
        .map(cid => activeClassMap[cid.toString()]?.name || 'unknown')
        .join(', ');
      throw new Error(
        `Student "${student.name}" (NIS: ${student.nis}) enrolled in ${activeStudentClassIds.length} active classes: ${classNames}`
      );
    }

    if (activeStudentClassIds.length === 0) continue;

    const activeClassId = activeStudentClassIds[0];
    const classDoc = activeClassMap[activeClassId.toString()];
    const tg = tgMap[classDoc.teachingGroupId.toString()];

    const tgSubBranchStrIds = new Set((tg.subBranches || []).map(s => s.toString()));

    let sbId = null;

    if (user.subBranchId && subBranchIdStrSet.has(user.subBranchId.toString())) {
      sbId = user.subBranchId.toString();
    }

    if (!sbId) {
      const match = subBranches.find(sb => tgSubBranchStrIds.has(sb._id.toString()));
      if (match) sbId = match._id.toString();
    }

    if (!sbId) {
      log.verbose(`TG "${tg.name}" has no subBranch matching branch "${branch.name}" and user has no subBranch — skip student ${student.name}`);
      continue;
    }

    allEntries.push({
      student,
      classDoc,
      hasClass: true,
      branchName,
      subBranchName: subBranchNameMap[sbId] || 'Unknown',
    });
    processedUserIds.add(user._id.toString());
    stats.studentsWithClass++;
  }

  const userCandidates = await User.find({
    _id: { $nin: [...processedUserIds] },
    subBranchId: { $in: subBranchIds },
  }).lean();

  if (userCandidates.length > 0) {
    const studentsNoClass = await Student.find({
      gender: 'L',
      userId: { $in: userCandidates.map(u => u._id) },
    }).populate('userId').lean();

    log.info(`Students WITHOUT active class: ${studentsNoClass.length}`);

    for (const student of studentsNoClass) {
      const user = student.userId;
      if (!user) {
        stats.errors.push(`Student "${student.name}" (NIS: ${student.nis}) has no linked User — skip`);
        continue;
      }

      if (!user.subBranchId) {
        throw new Error(
          `Student "${student.name}" (NIS: ${student.nis}) has no active class and no subBranchId on User record`
        );
      }

      const sbId = user.subBranchId.toString();
      if (!subBranchIdStrSet.has(sbId)) {
        stats.errors.push(
          `Student "${student.name}" (NIS: ${student.nis}) subBranch does not belong to branch "${branch.name}" — skip`
        );
        continue;
      }

      allEntries.push({
        student,
        classDoc: null,
        hasClass: false,
        branchName,
        subBranchName: subBranchNameMap[sbId] || 'Unknown',
      });
      stats.studentsWithoutClass++;
    }
  }

  log.success(`   Done: ${branch.name}`);
}

async function main() {
  log.section(`EXPORT STUDENTS TO EXCEL — FORSGI${isDryRun ? ' [DRY RUN]' : ''}`);
  if (isDryRun) log.warning('DRY RUN — No files will be written');

  try {
    await mongoose.connect(MONGO_URI, {
      serverApi: { version: '1', strict: true, deprecationErrors: true },
    });
    log.success(`Connected → ${process.env.DB_NAME}`);

    log.info('Finding active academic year...');
    const activeAY = await AcademicYear.findOne({ isActive: true }).lean();
    if (!activeAY) {
      log.error('No active academic year found');
      process.exit(1);
    }
    stats.academicYearName = activeAY.name;
    log.success(`Active: ${activeAY.name}`);

    const selectedBranches = await selectBranches();
    stats.branchesSelected = selectedBranches.length;
    log.info(`Branches: ${selectedBranches.map(b => b.name).join(', ')}`);

    const allEntries = [];

    for (const branch of selectedBranches) {
      await collectBranchData(branch, activeAY, allEntries);
    }

    stats.totalStudentsExported = allEntries.length;

    log.section('BUILDING EXCEL');

    if (allEntries.length === 0) {
      log.warning('No students found — no file generated');
      await mongoose.disconnect();
      process.exit(0);
    }

    const normal = [];
    const flagged = [];

    for (const entry of allEntries) {
      if (isFlagged(entry)) flagged.push(entry);
      else normal.push(entry);
    }

    const sortFn = (a, b) => {
      const desaCmp = (a.branchName || '').localeCompare(b.branchName || '');
      if (desaCmp !== 0) return desaCmp;

      const kelompokCmp = (a.subBranchName || '').localeCompare(b.subBranchName || '');
      if (kelompokCmp !== 0) return kelompokCmp;

      const kelasCmp = classSortKey(a.classDoc) - classSortKey(b.classDoc);
      if (kelasCmp !== 0) return kelasCmp;

      return (a.student.name || '').localeCompare(b.student.name || '');
    };

    normal.sort(sortFn);
    flagged.sort(sortFn);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'PPGAcademicSystem';
    wb.created = new Date();

    const ws = wb.addWorksheet('Data Caberawit');

    const headers = ['No', 'Name', 'Kelas', 'Tanggal Lahir', 'Usia', 'Nama Orang Tua', 'No. Hp Orang Tua', 'Kelompok', 'Desa'];
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });

    ws.columns = [
      { width: 5 },   // No
      { width: 32 },  // Name
      { width: 28 },  // Kelas
      { width: 20 },  // Tanggal Lahir
      { width: 8 },   // Usia
      { width: 32 },  // Nama Orang Tua
      { width: 18 },  // No. Hp Orang Tua
      { width: 24 },  // Kelompok
      { width: 20 },  // Desa
    ];

    let no = 1;

    function writeEntry(entry) {
      const { student, classDoc } = entry;
      const dateValue = student.dateOfBirth ? new Date(student.dateOfBirth) : null;
      const kelas = entry.hasClass ? classDoc.name : 'Tidak terdaftar ke kelas';
      const dateStr = dateValue ? formatDate(dateValue) : '';
      const usia = dateValue ? calcAge(dateValue) : '';

      ws.addRow([
        no,
        student.name || '',
        kelas,
        dateStr,
        usia,
        student.parentName || '',
        student.parentPhone || '',
        entry.subBranchName,
        entry.branchName,
      ]);
      no++;
    }

    for (const entry of normal) writeEntry(entry);

    if (flagged.length > 0) {
      const sepRow = ws.addRow([]);
      ws.mergeCells(sepRow.number, 1, sepRow.number, 9);
      sepRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    }

    for (const entry of flagged) writeEntry(entry);

    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const dateStr = `${dd}-${mm}-${yyyy}`;

    if (!isDryRun) {
      if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      }
      const filePath = path.join(OUTPUT_DIR, `DataCaberawit_${dateStr}.xlsx`);
      await wb.xlsx.writeFile(filePath);
      log.success(`   Written: DataCaberawit_${dateStr}.xlsx`);
    } else {
      log.info(`   [DRY-RUN] Would write: DataCaberawit_${dateStr}.xlsx`);
    }

    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
    log.section('SUMMARY');
    console.log(`  Academic Year:    ${stats.academicYearName}`);
    console.log(`  Branches:         ${stats.branchesSelected}`);
    console.log(`  Students total:   ${stats.totalStudentsExported}`);
    console.log(`    With class:     ${stats.studentsWithClass}`);
    console.log(`    No class:       ${stats.studentsWithoutClass}`);
    console.log(`  Errors:           ${stats.errors.length}`);
    console.log(`  Duration:         ${duration}s`);

    if (stats.errors.length > 0) {
      log.section('ERRORS');
      stats.errors.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    }

    if (isDryRun) {
      log.warning('DRY RUN complete — no files written');
    } else {
      log.success('Export complete');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    log.error(`FATAL: ${error.message}`);
    if (isVerbose) console.error(error);
    try { await mongoose.disconnect(); } catch (_) {}
    process.exit(1);
  }
}

main();
