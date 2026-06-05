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
  branchFilesCreated: 0,
  totalSubBranchSheets: 0,
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

function extractGradeFromClass(classDoc) {
  if (!classDoc || !classDoc.name) return 0;
  const match = classDoc.name.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
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

function getUniformCriteria(student, classDoc) {
  if (!classDoc) return 'Kelas Tidak Memenuhi Kriteria';

  const grade = extractGradeFromClass(classDoc);
  if (grade >= 6) return 'Kelas Tidak Memenuhi Kriteria';

  if (student.dateOfBirth) {
    const dob = new Date(student.dateOfBirth);
    const cutoff = new Date(2021, 6, 31);
    if (dob > cutoff) return 'Tanggal Lahir Tidak Memenuhi Kriteria';
  }

  return '';
}

async function processBranch(branch, activeAcademicYear) {
  log.section(`Branch: ${branch.name}`);

  const subBranches = await SubBranch.find({ _id: { $in: branch.subBranches || [] } }).lean();
  log.info(`SubBranches: ${subBranches.length}`);

  if (subBranches.length === 0) {
    log.warning(`No subBranches for "${branch.name}" — skip`);
    return null;
  }

  const activeBYs = await BranchYear.find({
    branchId: branch._id,
    academicYearId: activeAcademicYear._id,
    isActive: true,
  }).lean();
  log.info(`Active BranchYears: ${activeBYs.length}`);

  if (activeBYs.length === 0) {
    log.warning(`No active BranchYears for "${branch.name}" — skip`);
    return null;
  }

  const teachingGroups = await TeachingGroup.find({
    branchYearId: { $in: activeBYs.map(by => by._id) },
  }).lean();
  log.verbose(`TeachingGroups: ${teachingGroups.length}`);

  if (teachingGroups.length === 0) {
    log.warning(`No teaching groups for "${branch.name}" — skip`);
    return null;
  }

  const tgMap = {};
  for (const tg of teachingGroups) tgMap[tg._id.toString()] = tg;

  const activeClasses = await Class.find({
    teachingGroupId: { $in: teachingGroups.map(tg => tg._id) },
  }).lean();
  log.verbose(`Active classes: ${activeClasses.length}`);

  if (activeClasses.length === 0) {
    log.warning(`No active classes for "${branch.name}" — skip`);
    return null;
  }

  const activeClassIdSet = new Set(activeClasses.map(c => c._id.toString()));
  const activeClassMap = {};
  for (const c of activeClasses) activeClassMap[c._id.toString()] = c;

  const subBranchMap = {};
  for (const sb of subBranches) subBranchMap[sb._id.toString()] = sb;
  const subBranchIds = subBranches.map(sb => sb._id);
  const subBranchIdStrSet = new Set(subBranchIds.map(id => id.toString()));

  const studentsWithClass = await Student.find({
    classIds: { $in: activeClasses.map(c => c._id) },
  }).populate('userId').lean();

  log.info(`Students WITH active class: ${studentsWithClass.length}`);

  const sbStudents = {};
  const processedUserIds = new Set();

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
    if (!sbStudents[sbId]) sbStudents[sbId] = [];
    sbStudents[sbId].push({ student, classDoc, hasClass: true });
    processedUserIds.add(user._id.toString());
    stats.studentsWithClass++;
  }

  const userCandidates = await User.find({
    _id: { $nin: [...processedUserIds] },
    subBranchId: { $in: subBranchIds },
  }).lean();

  if (userCandidates.length > 0) {
    const studentsNoClass = await Student.find({
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

      if (!sbStudents[sbId]) sbStudents[sbId] = [];
      sbStudents[sbId].push({ student, classDoc: null, hasClass: false });
      stats.studentsWithoutClass++;
    }
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PPGAcademicSystem';
  wb.created = new Date();

  const sortedSubBranches = [...subBranches].sort((a, b) => a.name.localeCompare(b.name));

  for (const sb of sortedSubBranches) {
    const sbId = sb._id.toString();
    const entries = sbStudents[sbId];
    if (!entries || entries.length === 0) continue;

    const ws = wb.addWorksheet(sb.name);

    const headers = ['No', 'Nama', 'NIS', 'Kelas', 'Tanggal Lahir', 'Usia', 'Ukuran Baju'];
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
      { width: 5 },
      { width: 32 },
      { width: 16 },
      { width: 28 },
      { width: 20 },
      { width: 8 },
      { width: 34 },
    ];

    entries.sort((a, b) => {
      const aKey = classSortKey(a.classDoc);
      const bKey = classSortKey(b.classDoc);
      if (aKey !== bKey) return aKey - bKey;
      return (a.student.name || '').localeCompare(b.student.name || '');
    });

    const normal = [];
    const flagged = [];

    for (const entry of entries) {
      const ukuran = getUniformCriteria(entry.student, entry.classDoc);
      entry.ukuran = ukuran;
      if (ukuran) flagged.push(entry);
      else normal.push(entry);
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

    let no = 1;

    for (const entry of normal) {
      const { student, classDoc } = entry;
      const dateValue = student.dateOfBirth ? new Date(student.dateOfBirth) : null;
      const kelas = entry.hasClass ? classDoc.name : 'Tidak terdaftar ke kelas';
      const dateStr = dateValue ? formatDate(dateValue) : '';
      const usia = dateValue ? calcAge(dateValue) : null;

      ws.addRow([no, student.name || '', student.nis || '', kelas, dateStr, usia, '']);
      no++;
    }

    if (flagged.length > 0) {
      const sepRow = ws.addRow([]);
      ws.mergeCells(sepRow.number, 1, sepRow.number, 7);
      sepRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

      for (const entry of flagged) {
        const { student, classDoc } = entry;
        const dateValue = student.dateOfBirth ? new Date(student.dateOfBirth) : null;
        const kelas = entry.hasClass ? classDoc.name : 'Tidak terdaftar ke kelas';
        const dateStr = dateValue ? formatDate(dateValue) : '';
        const usia = dateValue ? calcAge(dateValue) : null;

        const row = ws.addRow([no, student.name || '', student.nis || '', kelas, dateStr, usia, entry.ukuran]);
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        no++;
      }
    }

    stats.totalSubBranchSheets++;
    stats.totalStudentsExported += entries.length;
    log.success(`   Sheet "${sb.name}": ${entries.length} student(s)`);
  }

  if (wb.worksheets.length === 0) {
    log.warning(`No data to export for "${branch.name}"`);
    return null;
  }

  log.info(`   Total sheets: ${wb.worksheets.length}`);

  if (!isDryRun) {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    const filePath = path.join(OUTPUT_DIR, `${branch.name}.xlsx`);
    await wb.xlsx.writeFile(filePath);
    log.success(`   Written: ${branch.name}.xlsx`);
  } else {
    log.info(`   [DRY-RUN] Would write: ${branch.name}.xlsx`);
  }

  stats.branchFilesCreated++;
  return true;
}

async function main() {
  log.section(`EXPORT STUDENTS TO EXCEL${isDryRun ? ' [DRY RUN]' : ''}`);
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

    for (const branch of selectedBranches) {
      await processBranch(branch, activeAY);
    }

    const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);
    log.section('SUMMARY');
    console.log(`  Academic Year:    ${stats.academicYearName}`);
    console.log(`  Branches:         ${stats.branchesSelected}`);
    console.log(`  Files created:    ${stats.branchFilesCreated}`);
    console.log(`  SubBranch sheets: ${stats.totalSubBranchSheets}`);
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
