# Scripts Documentation

This directory contains utility scripts for the PPG Academic System backend.

---

## Image Compression Script

**File**: `compressImages.js`

Compresses all images in the uploads directory to reduce storage and improve performance.

### Features

- ✅ **In-Place Compression**: Replaces original files while preserving filenames
- ✅ **Multi-Format Support**: PNG, JPEG, WebP, BMP (GIF skipped)
- ✅ **Smart Compression**: Only replaces if compressed size is smaller
- ✅ **Dry Run Mode**: Preview results without modifying files
- ✅ **Validation**: Checks image integrity before and after compression
- ✅ **Error Handling**: Skips corrupted files and continues processing
- ✅ **Detailed Statistics**: Shows size savings and compression ratios

### Usage

**Dry run (preview only):**
```bash
node scripts/compressImages.js --dry-run --verbose
```

**Compress images:**
```bash
node scripts/compressImages.js
```

**Custom target directory:**
```bash
node scripts/compressImages.js --target=path/to/images
```

### Compression Settings

- **PNG**: Compression level 9, quality 90, effort 10
- **JPEG**: Quality 85, mozjpeg enabled
- **WebP**: Quality 85, effort 6
- **BMP**: Converted to PNG format

### Important Notes

- ⚠️ Requires existing daily backup (script replaces files in-place)
- ⚠️ Corrupted images will be skipped and reported
- ✅ Already optimized images won't be re-compressed
- ✅ Filenames remain unchanged (database references preserved)

---

## Bulk Attendance Creation Script

**File**: `createTodayAttendances.js`

This script creates attendance records for all students in all active branch years for the current date.

## Purpose

Automatically initialize daily attendance records with default "Tanpa Keterangan" (No Information) status for all students. Teachers can then update these records throughout the day to mark actual attendance.

## Features

- ✅ **Dry Run Mode**: Preview what will be created without modifying data
- ✅ **Transaction Safety**: All-or-nothing execution with automatic rollback on errors
- ✅ **Duplicate Prevention**: Skips students who already have attendance for today
- ✅ **Student-Specific SubBranch**: Matches student's subBranch via User relationship
- ✅ **Detailed Logging**: Progress tracking and comprehensive error reporting
- ✅ **Summary Report**: Complete statistics after execution

## Prerequisites

1. Ensure `.env` file is configured with database credentials
2. At least one Academic Year must have `isActive: true`
3. At least one Branch Year must have `isActive: true`
4. Node.js and all dependencies installed (`npm install`)

## Usage

### 1. Dry Run (Recommended First)

Preview what will be created without making any changes:

```bash
node scripts/createTodayAttendances.js --dry-run
```

### 2. Dry Run with Verbose Logging

Get detailed information about each student:

```bash
node scripts/createTodayAttendances.js --dry-run --verbose
```

### 3. Actual Execution

Create attendance records:

```bash
node scripts/createTodayAttendances.js
```

### 4. Actual Execution with Verbose Logging

Create records with detailed progress:

```bash
node scripts/createTodayAttendances.js --verbose
```

## How It Works

1. **Find Active Academic Year**: Locates the single academic year with `isActive: true`
2. **Filter Active Branch Years**: Gets all branch years with `isActive: true` within the academic year
3. **Process Each Branch Year**:
   - Retrieve all teaching groups
   - For each teaching group, get all classes
   - For each class, process all students
4. **Create Attendance Records**:
   - Check if attendance already exists for today
   - Determine student's subBranch (via User.subBranchId or fallback to teaching group's first subBranch)
   - Create attendance with default "Tanpa Keterangan" status
5. **Transaction Management**: Uses MongoDB transactions to ensure data consistency

## Attendance Record Structure

Each created attendance has:

```javascript
{
  forDate: "2025-10-14",           // Today's date (YYYY-MM-DD)
  timestamp: "2025-10-14T06:00:00.000Z",
  status: "Tanpa Keterangan",       // Default unmarked status
  violations: {
    attribute: false,
    attitude: false,
    tidiness: false
  },
  teachersNotes: "",
  studentId: ObjectId("..."),
  branchId: ObjectId("..."),
  branchYearId: ObjectId("..."),
  subBranchId: ObjectId("..."),     // Student's subBranch or teaching group's first
  teachingGroupId: ObjectId("..."),
  classId: ObjectId("...")
}
```

## Example Output

### Dry Run Mode:
```
==================================================
🚀 BULK ATTENDANCE CREATION - DRY RUN MODE
==================================================
ℹ️  📅 Date: 2025-10-14
ℹ️  🕐 Started at: 10/14/2025, 6:00:00 AM
⚠️  DRY RUN MODE - No data will be modified

ℹ️  🔍 Finding active academic year...
✅ Found: 2024/2025 (ID: 507f1f77bcf86cd799439011)

ℹ️  🔍 Finding active branch years...
✅ Found 2 active branch year(s)

ℹ️  📚 Processing BranchYear 1/2: Putra Cikampek
ℹ️     └── Found 5 teaching group(s)

ℹ️     📖 Teaching Group: Ula
ℹ️        └── Processing 3 class(es)
ℹ️           ├── Class "Ula 1": 25 student(s)
✅          └── Would create: 25, Skipped: 0
ℹ️           ├── Class "Ula 2": 23 student(s)
✅          └── Would create: 23, Skipped: 0
...

==================================================
📊 SUMMARY REPORT
==================================================
Mode:                    DRY RUN
Date:                    2025-10-14
Academic Year:           2024/2025
Active Branch Years:     2
Total Teaching Groups:   5
Total Classes:           12
Total Students:          320
Records to Create:       315
Records Skipped:         5 (already exist)
Empty Classes:           0
Errors:                  0
Duration:                1.8s

==================================================
⚠️  DRY RUN COMPLETE - No data was modified
ℹ️  💡 Run without --dry-run flag to create attendance records
```

## Error Handling

The script handles various error scenarios:

- **Missing SubBranch**: Logs error and skips the teaching group
- **Empty Classes**: Reports in summary but continues processing
- **Duplicate Records**: Automatically skips students who already have attendance
- **Student Processing Errors**: Logs error and continues with next student
- **Database Errors**: Rolls back transaction and exits with error

## Best Practices

1. **Always run with `--dry-run` first** to verify what will be created
2. **Review the summary** before running actual execution
3. **Run once per day**, typically in the morning before classes start
4. **Check the errors section** in the summary if any issues occur
5. **Use `--verbose` flag** for troubleshooting

## Integration Options

### Manual Execution
Run the script manually each day:
```bash
node scripts/createTodayAttendances.js
```

### Scheduled Execution (Future)
To automate, integrate with the existing scheduler:
1. Import the logic into a new scheduler file
2. Use `node-cron` to run daily (e.g., "0 6 * * 1-5" for 6 AM on weekdays)
3. Add checks for holidays/school breaks

## Troubleshooting

### "No active academic year found"
- Ensure at least one `AcademicYear` document has `isActive: true`
- Check database connection

### "No active branch years found"
- Verify that branch years within the active academic year have `isActive: true`

### "TeachingGroup has no subBranches"
- Ensure all teaching groups have at least one subBranch assigned
- Fix data in the database and re-run

### MongoDB Connection Error
- Check `.env` file has correct DB credentials
- Verify network connectivity to MongoDB Atlas

## Support

For issues or questions about this script, contact the development team.
