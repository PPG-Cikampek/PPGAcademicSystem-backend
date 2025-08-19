const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const User = require('../models/user');
const Branch = require('../models/branch');
const BranchYear = require('../models/branchYear');
const TeachingGroup = require('../models/teachingGroup');
const AcademicYear = require('../models/academicYear')
const Class = require('../models/class')
const Student = require('../models/student')
const Teacher = require('../models/teacher')
const Attendance = require('../models/attendance');

const getAttendanceById = async (req, res, next) => {
    const attendanceId = req.params.attendanceId;

    let identifiedAttendance
    try {
        identifiedAttendance = await Attendance.findById(attendanceId).populate({ path: 'studentId', select: 'name' });

        if (!identifiedAttendance) {
            return next(new HttpError(`Attendance with ID ${attendanceId} not found!`, 404));
        }

    } catch (error) {
        console.error(error);
        return next(new HttpError('Internal server error occurred!', 500));
    }

    console.log('getAttendanceById requested')
    res.status(200).json({ attendance: identifiedAttendance.toObject({ getters: true }) });
};

const getAttendancesByAcademicYearId = async (req, res, next) => {
    const academicYearId = req.params.academicYearId;

    let identifiedAcademicYear
    try {
        identifiedAcademicYear = await AcademicYear.findById(academicYearId)
            .populate({
                path: 'teachingGroupYears',
                populate: {
                    path: 'classes',
                    populate: {
                        path: 'attendances',
                        populate: {
                            path: 'studentId',
                            select: 'name'
                        }
                    }
                }
            });

        if (!identifiedAcademicYear) {
            return next(new HttpError(`Attendance with ID ${attendanceId} not found!`, 404));
        }

    } catch (error) {
        console.error(error);
        return next(new HttpError('Internal server error occurred!', 500));
    }

    console.log('getAttendanceById requested')
    res.status(200).json({ academicYears: identifiedAcademicYear.toObject({ getters: true }) });
};

const createNewAttendanceForClass = async (req, res, next) => {
    console.log('createNewAttendanceForClass requested')
    const { classId, branchId, branchYearId, subBranchId } = req.body;

    let identifiedClass;
    try {
        identifiedClass = await Class.findById(classId);
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!identifiedClass) {
        return next(new HttpError('Class not found!', 500));
    }

    const session = await mongoose.startSession();
    session.startTransaction(); // Start the transaction

    try {
        const students = identifiedClass.students;
        const timestamp = new Date().toISOString();
        const forDate = new Date().toLocaleDateString('en-CA');

        const attendances = [];

        // Step 1: Create attendance documents
        for (const studentId of students) {
            const attendance = new Attendance({
                forDate,
                timestamp,
                status: "Tanpa Keterangan",
                violations: { attribute: false, attitude: false, tidiness: false },
                teachersNotes: "",
                studentId,
                branchId,
                branchYearId,
                subBranchId,
                teachingGroupId: identifiedClass.teachingGroupId,
                classId,
            });

            const createdAttendance = await attendance.save({ session });
            attendances.push(createdAttendance);

            // Step 2: Update the respective student document with the created attendance ID
            // await Student.findByIdAndUpdate(
            //     studentId,
            //     { $push: { attendanceIds: createdAttendance._id } },
            //     { session }
            // );
        }

        // Step 3: Update class schema with all attendance references
        // const attendanceIds = attendances.map(attendance => attendance._id);
        // await Class.findByIdAndUpdate(
        //     classId,
        //     { $push: { attendances: { $each: attendanceIds } } },
        //     { session }
        // );

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        console.log("Attendances created and references updated successfully.");
        res.status(202).json({ message: 'New Attendances Created!' });
    } catch (error) {
        // Rollback the transaction in case of an error
        await session.abortTransaction();
        session.endSession();
        console.log(error);
        return next(new HttpError('Internal server error occurred!', 500));
    }
};


const getAttendancesByClass = async (req, res, next) => {
    const classId = req.params.classId

    // Validate input
    if (!classId) {
        return next(new HttpError('ClassId required!', 400));
    }

    try {
        // Query MongoDB for documents matching the provided date and classId
        const attendances = await Attendance.find({ classId })
            .populate({ path: 'studentId', select: 'name' })
            .sort({ forDate: 1 });

        if (attendances.length === 0) {
            return res.status(404).json({ message: 'Belum ada riwayat absensi!' });
        }

        console.log(`Retrieved attendances for classId ${classId}`);
        res.status(200).json(attendances);
    } catch (error) {
        console.error('Error retrieving attendances:', error);
        return next(new HttpError('Internal server error occured!', 500));
    }
};

const getAttendancesByDateAndClass = async (req, res, next) => {
    const classId = req.params.classId
    const { date } = req.body;

    // console.log(classId)
    console.log(date)

    // Validate input
    if (!date || !classId) {
        return next(new HttpError('Date and ClassId required!', 400));

    }

    try {
        // Parse the date to ensure it's in a valid Date format
        const formattedDate = new Date(date);

        if (isNaN(formattedDate.getTime())) {
            return next(new HttpError('Invalid date format!', 400));

        }

        console.log(formattedDate)


        // Query MongoDB for documents matching the provided date and classId
        const attendances = await Attendance.find({
            forDate: formattedDate,
            classId
        })
            .populate({ path: 'studentId', select: ['name', 'nis', 'image', 'thumbnail'] });
        ;

        if (!attendances) {
            return res.status(404).json({ message: 'No attendance records found for the given date and classId' });
        }

        console.log(`Retrieved attendances by classId and Date ${classId}`);
        res.status(200).json(attendances);
    } catch (error) {
        console.error('Error retrieving attendances:', error);
        res.status(500).json({ error: 'An error occurred while retrieving attendances' });
    }
};

const deleteAttendanceById = async (req, res, next) => {
    const { studentName } = req.body

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const attendanceId = req.params.attendanceId;

        // Step 1: Find the Attendance document
        const attendance = await Attendance.findById(attendanceId).session(session);
        if (!attendance) {
            return next(new HttpError('Attendance ID not found!', 404));

        }

        const { studentId, classId } = attendance;

        // Step 2: Delete the Attendance document
        await Attendance.findByIdAndDelete(attendanceId, { session });

        // Step 3: Remove the reference from the Class schema
        await Class.findByIdAndUpdate(
            classId,
            { $pull: { attendances: attendanceId } },
            { session }
        );

        // Step 4: Remove the reference from the Student schema
        await Student.findByIdAndUpdate(
            studentId,
            { $pull: { attendanceIds: attendanceId } },
            { session }
        );

        // Step 5: Commit the transaction
        await session.commitTransaction();
        session.endSession();
    } catch (error) {
        await session.abortTransaction();
        console.error('Error during transaction, rolled back:', error);
        return next(new HttpError('Internal server error occurred!', 500));
    }

    res.status(200).json({ message: `Berhasil menghapus absen siswa: ${studentName}` });
};


const updateAttendancesByIds = async (req, res, next) => {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
        return next(new HttpError('Invalid input format. "updates" must be an array.', 400));
    }

    try {
        const updatePromises = updates.map(({ attendanceId, status, attributes, violations, timestamp, updateReason, teachersNotes }) =>
            Attendance.findByIdAndUpdate(
                attendanceId,
                { status, attributes, violations, timestamp, updateReason, teachersNotes },
                { new: true, runValidators: true }
            )
        );

        const results = await Promise.all(updatePromises);

        // Check for missing attendances
        const notFoundIds = updates
            .filter((_, index) => !results[index])
            .map(update => update.attendanceId);

        if (notFoundIds.length > 0) {
            return next(new HttpError(`Attendance IDs not found: ${notFoundIds.join(', ')}`, 404));
        }
        console.log('Updated attendances')
        res.status(200).json({ message: 'Berhasil update kehadiran!', results });
    } catch (error) {
        console.error(error);
        return next(new HttpError('Internal server error occurred!', 500));
    }
};



// const getAttendanceOverview = async (req, res, next) => {
//     const { academicYearId, branchId, teachingGroupId, classId, month } = req.body;


//     const filter = {};

//     if (academicYearId) {
//         filter.academicYearId = academicYearId;
//     }

//     let teachingGroupYears
//     try {
//         teachingGroupYears = await TeachingGroupYear.find(filter)
//             .populate({
//                 path: 'classes',
//                 populate: [
//                     { path: 'attendances', populate: { path: 'studentId', select: ['name', 'nis', 'image'] } },
//                     { path: 'teachers', select: ['name', 'nig'] }
//                 ]
//             })
//             .populate({
//                 path: 'teachingGroupId',
//                 select: 'name',
//                 populate: {
//                     path: 'branchId',
//                     select: 'name'
//                 }
//             });

//         if (month) {
//             let convertedMonth = month
//             if (typeof month === 'string') {
//                 convertedMonth = parseInt(month);
//             }
//             teachingGroupYears = teachingGroupYears.map(teachingGroupYear => {
//                 const filteredClasses = teachingGroupYear.classes.map(cls => {
//                     const filteredAttendances = cls.attendances.filter(attendance => {
//                         const attendanceDate = new Date(attendance.forDate);
//                         return attendanceDate.getMonth() + 1 === convertedMonth;
//                     });
//                     // Use toObject to create a copy, modify attendance, then return
//                     const updatedClass = cls.toObject();
//                     updatedClass.attendances = filteredAttendances;
//                     return updatedClass;
//                 });

//                 const updatedTeachingGroupYear = teachingGroupYear.toObject();
//                 updatedTeachingGroupYear.classes = filteredClasses;
//                 return updatedTeachingGroupYear;
//             });
//         }

//         if (branchId) {
//             teachingGroupYears = teachingGroupYears.filter(teachingGroupYear => teachingGroupYear.teachingGroupId.branchId._id.toString() === branchId)
//         }

//         if (teachingGroupId) {
//             teachingGroupYears = teachingGroupYears.filter(teachingGroupYear => teachingGroupYear.teachingGroupId._id.toString() === teachingGroupId);
//         }

//         console.log(teachingGroupYears)

//         if (classId) {  //ClassId Filter
//             teachingGroupYears = teachingGroupYears.map(teachingGroupYear => {
//                 const teachingGroupYearCopy = teachingGroupYear; // Create a copy FIRST
//                 teachingGroupYearCopy.classes = teachingGroupYearCopy.classes.filter(cls => cls._id.toString() === classId);
//                 if (teachingGroupYearCopy.classes.length > 0) {
//                     return teachingGroupYearCopy; // Return the copy
//                 } else {
//                     return null;  // Handle cases where classId isn't found
//                 }
//             }).filter(Boolean); // Remove any nulls
//         }

//         console.log(teachingGroupYears)

//         if (!teachingGroupYears || teachingGroupYears.length === 0) {
//             console.log('No matching attendances found for the given filters.');
//             return res.status(200).json([]); // Or handle not found error if that's preferred
//         }

//         console.log(`Retrieved attendance reports based on filters`);
//         return res.status(200).json({ teachingGroupYears });

//     } catch (error) {
//         console.error('Error retrieving attendance reports:', error);
//         return next(new HttpError('Internal server error occurred!', 500));
//     }
// };
const getAttendanceOverview = async (req, res, next) => {
    const { academicYearId, branchId, subBranchId, teachingGroupId, classId, teacherClassIds, startDate, endDate } = req.body;


    try {
        // Build attendance filter directly
        const attendanceFilter = {};

        // Apply direct filters available in Attendance schema
        if (branchId) {
            attendanceFilter.branchId = branchId;
        }

        if (subBranchId) {
            attendanceFilter.subBranchId = subBranchId;
        }

        if (teachingGroupId) {
            attendanceFilter.teachingGroupId = teachingGroupId;
        }

        // Accept either a single classId or an array of teacherClassIds
        if (teacherClassIds && Array.isArray(teacherClassIds) && teacherClassIds.length > 0) {
            attendanceFilter.classId = { $in: teacherClassIds };
        } else if (classId) {
            attendanceFilter.classId = classId;
        }

        // Apply date range filter
        if (startDate && endDate) {
            attendanceFilter.forDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        // If academicYearId is provided, we need to find matching classes first
        let classIds = null;
        if (academicYearId) {
            // Find the AcademicYear and populate its branchYears
            const academicYear = await AcademicYear.findById(academicYearId)
                .populate({
                    path: 'branchYears',
                    populate: {
                        path: 'teachingGroups',
                        select: 'classes',
                        populate: {
                            path: 'classes',
                            select: '_id'
                        }
                    }
                })
                .select('branchYears');

            if (!academicYear) {
                return res.status(200).json({ attendances: [], overallStats: [], violationStats: [] });
            }

            console.log('academicYear result', academicYear);

            // Extract all class IDs from the nested structure
            classIds = academicYear.branchYears.reduce((acc, branchYear) => {
                if (branchYear.teachingGroups && branchYear.teachingGroups.length > 0) {
                    branchYear.teachingGroups.forEach(teachingGroup => {
                        if (teachingGroup.classes && teachingGroup.classes.length > 0) {
                            acc = acc.concat(teachingGroup.classes.map(cls => cls._id));
                        }
                    });
                }
                return acc;
            }, []);

            console.log('classId result', classIds);

            if (classIds.length > 0) {
                // Normalize class IDs from the academic year to strings for comparison
                const classIdsStr = classIds.map(id => id.toString());

                if (attendanceFilter.classId) {
                    // Determine requested class ids from attendanceFilter (could be a value or {$in: [...]})
                    let requestedIds = [];
                    if (attendanceFilter.classId.$in) {
                        requestedIds = attendanceFilter.classId.$in.map(id => id.toString());
                    } else if (Array.isArray(attendanceFilter.classId)) {
                        requestedIds = attendanceFilter.classId.map(id => id.toString());
                    } else {
                        requestedIds = [attendanceFilter.classId.toString()];
                    }

                    // If any requested id is not part of the academic year's classes, return empty result
                    const allContained = requestedIds.every(id => classIdsStr.includes(id));
                    if (!allContained) {
                        return res.status(200).json({ attendances: [], overallStats: [], violationStats: [] });
                    }
                } else {
                    attendanceFilter.classId = { $in: classIds };
                }
            } else {
                return res.status(200).json({ attendances: [], overallStats: [], violationStats: [] });
            }
        }

        console.log('result', classIds);

        // Query attendances directly with all populated relationships
        const attendances = await Attendance.find(attendanceFilter)
            .populate({
                path: 'studentId',
                select: ['name', 'nis', 'image', 'thumbnail']
            })
            .populate({
                path: 'classId',
                select: 'name teachers',
                populate: {
                    path: 'teachers',
                    select: ['name', 'nig']
                }
            })
            .populate({
                path: 'teachingGroupId',
                select: 'name branchYearId subBranches',
                populate: [
                    {
                        path: 'branchYearId',
                        select: 'branchId',
                        populate: {
                            path: 'branchId',
                            select: 'name'
                        }
                    },
                    {
                        path: 'subBranches',
                        select: 'name'
                    }
                ]
            })
            .populate({
                path: 'branchId',
                select: 'name'
            })
            .populate({
                path: 'subBranchId',
                select: 'name'
            })
            .sort({ forDate: 1, 'studentId.name': 1 });


    // ensure attendances is an array (may be empty). We will still build studentData
    const attendancesList = attendances || [];

    console.log('result', attendancesList);

    const getOverallStats = (attendances) => {
            const statusCounts = attendances.reduce((acc, attendance) => {
                acc[attendance.status] = (acc[attendance.status] || 0) + 1;
                return acc;
            }, {});

            const total = attendances.length;
            return Object.keys(statusCounts).map((status) => ({
                status,
                count: statusCounts[status],
                percentage: Math.round((statusCounts[status] / total) * 10000) / 100,
            })).sort((a, b) => a.status.localeCompare(b.status));
        };

        const getViolationStats = (attendances) => {
            const violationCounts = {};

            attendances.forEach((attendance) => {
                Object.entries(attendance.violations).forEach(([violation, occurred]) => {
                    if (occurred) {
                        violationCounts[violation] = (violationCounts[violation] || 0) + 1;
                    }
                });
            });

            return Object.entries(violationCounts).map(([violation, count]) => ({ violation, count }));
        };

        console.log(`Retrieved ${attendancesList.length} attendance records based on filters`);

        // --- Build studentData per requirements ---
        // Determine roster class ids using preference: teacherClassIds > classId > derived classIds (from academicYearId)
        let rosterClassIds = null;
        if (teacherClassIds && Array.isArray(teacherClassIds) && teacherClassIds.length > 0) {
            rosterClassIds = teacherClassIds.map(id => id.toString());
        } else if (classId) {
            rosterClassIds = [classId.toString()];
        } else if (classIds && Array.isArray(classIds) && classIds.length > 0) {
            rosterClassIds = classIds.map(id => id.toString());
        }

        // Collect roster student IDs
        let rosterStudentIds = [];
        if (rosterClassIds && rosterClassIds.length > 0) {
            const classes = await Class.find({ _id: { $in: rosterClassIds } }).select('students').lean();
            rosterStudentIds = classes.reduce((acc, c) => {
                if (Array.isArray(c.students) && c.students.length > 0) {
                    c.students.forEach(s => acc.add(s.toString()));
                }
                return acc;
            }, new Set());
            rosterStudentIds = Array.from(rosterStudentIds);
        } else {
            // fallback: include students seen in attendances
            rosterStudentIds = Array.from(new Set(attendancesList.map(a => {
                if (!a.studentId) return null;
                if (typeof a.studentId === 'string') return a.studentId;
                if (a.studentId._id) return a.studentId._id.toString();
                return null;
            }).filter(Boolean)));
        }

        // Fetch student docs for roster (name, nis, thumbnail)
        const students = rosterStudentIds.length > 0 ? await Student.find({ _id: { $in: rosterStudentIds } }).select('name nis thumbnail').lean() : [];
        const studentMap = {};
        students.forEach(s => { studentMap[s._id.toString()] = s; });

        // Normalization mappings
        const statusMap = {
            'present': 'Hadir', 'hadir': 'Hadir',
            'late': 'Terlambat', 'terlambat': 'Terlambat',
            'permission': 'Izin', 'izin': 'Izin',
            'sick': 'Sakit', 'sakit': 'Sakit',
            'tanpa keterangan': 'Tanpa Keterangan', '': 'Tanpa Keterangan'
        };

        const commonStatuses = ['Hadir', 'Terlambat', 'Izin', 'Sakit', 'Tanpa Keterangan'];

        // initialize aggregation buckets per student
        const studentAgg = {};
        rosterStudentIds.forEach(id => {
            const sd = studentMap[id] || {};
            studentAgg[id] = {
                id: id,
                name: sd.name || '',
                nis: sd.nis || '',
                thumbnail: sd.thumbnail || '',
                attendances: commonStatuses.reduce((o, s) => { o[s] = 0; return o; }, {}),
                violationData: { 'Perlengkapan Belajar': 0, 'Sikap': 0, 'Kerapihan': 0 }
            };
        });

        // Aggregate attendance records into studentAgg
        attendancesList.forEach(att => {
            let sid = null;
            if (!att.studentId) return;
            if (typeof att.studentId === 'string') sid = att.studentId.toString();
            else if (att.studentId._id) sid = att.studentId._id.toString();
            else sid = att.studentId.toString();

            // Ensure student present in aggregation map; create placeholder if not
            if (!studentAgg[sid]) {
                const sd = studentMap[sid] || { name: '', nis: '', thumbnail: '' };
                studentAgg[sid] = {
                    id: sid,
                    name: sd.name || '',
                    nis: sd.nis || '',
                    image: sd.image || null,
                    thumbnail: sd.thumbnail || '',
                    attendances: commonStatuses.reduce((o, s) => { o[s] = 0; return o; }, {}),
                    violationData: { 'Perlengkapan Belajar': 0, 'Sikap': 0, 'Kerapihan': 0 }
                };
            }

            const rawStatus = (att.status || 'Tanpa Keterangan').toString().trim();
            const mapped = statusMap[rawStatus.toLowerCase()] || (rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1));
            if (!studentAgg[sid].attendances.hasOwnProperty(mapped)) {
                studentAgg[sid].attendances[mapped] = 0;
            }
            studentAgg[sid].attendances[mapped]++;

            // violations
            if (att.violations) {
                if (att.violations.attribute) studentAgg[sid].violationData['Perlengkapan Belajar']++;
                if (att.violations.attitude) studentAgg[sid].violationData['Sikap']++;
                if (att.violations.tidiness) studentAgg[sid].violationData['Kerapihan']++;
            }
        });

        // Convert per-student attendance counts into percentages that sum to 100
        Object.values(studentAgg).forEach(student => {
            const counts = student.attendances || {};
            const keys = Object.keys(counts);
            const totalCount = keys.reduce((s, k) => s + (counts[k] || 0), 0);

            if (totalCount === 0) {
                // No attendances -> all percentages 0
                keys.forEach(k => { student.attendances[k] = 0; });
                return;
            }

            // Compute floor percentages and fractional remainders
            const items = keys.map(k => {
                const raw = (counts[k] / totalCount) * 100;
                const floor = Math.floor(raw);
                return { key: k, raw, floor, frac: raw - floor };
            });

            let sumFloor = items.reduce((s, it) => s + it.floor, 0);
            let remainder = 100 - sumFloor;

            // Distribute the remaining 1% units to the largest fractional parts
            items.sort((a, b) => b.frac - a.frac);
            for (let i = 0; i < items.length && remainder > 0; i++) {
                items[i].floor += 1;
                remainder -= 1;
            }

            // Assign final integer percentages back to student.attendances
            items.forEach(it => {
                student.attendances[it.key] = it.floor;
            });
        });

        // Convert to array and sort by student name asc
        const studentsData = Object.values(studentAgg).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        return res.status(200).json({
            studentsData,
            overallStats: getOverallStats(attendancesList),
            violationStats: getViolationStats(attendancesList)
        });

    } catch (error) {
        console.error('Error retrieving attendance reports:', error);
        return next(new HttpError('Internal server error occurred!', 500));
    }
};

const getAttendanceReports = async (req, res, next) => {
    const { academicYearId, studentId, startDate, endDate } = req.body;

    // Validate required filters
    if (!academicYearId || !studentId || !startDate || !endDate) {
        return next(new HttpError('academicYearId, studentId, startDate and endDate are required!', 400));
    }

    // Parse dates and normalize to include full end day
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return next(new HttpError('Invalid date format for startDate or endDate!', 400));
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    try {
        // Load academic year and its classes (with teachers) to find student's class
        const academicYear = await AcademicYear.findById(academicYearId)
            .populate({
                path: 'branchYears',
                populate: {
                    path: 'teachingGroups',
                    populate: {
                        path: 'classes',
                        select: '_id name students teachers',
                        populate: { path: 'teachers', select: '_id name nig' }
                    }
                }
            })
            .select('name branchYears');

        if (!academicYear) {
            return next(new HttpError('AcademicYear not found!', 404));
        }

        // Find the class in this academic year that contains the student
        let foundClass = null;
        for (const branchYear of (academicYear.branchYears || [])) {
            if (!branchYear.teachingGroups) continue;
            for (const tg of branchYear.teachingGroups) {
                if (!tg.classes) continue;
                for (const cls of tg.classes) {
                    if (cls.students && cls.students.map(s => s.toString()).includes(studentId.toString())) {
                        foundClass = cls;
                        break;
                    }
                }
                if (foundClass) break;
            }
            if (foundClass) break;
        }

        if (!foundClass) {
            return next(new HttpError('Student not found in the provided academic year!', 404));
        }

        // Build attendance query for the student in that class and date range
        const attendanceFilter = {
            studentId,
            classId: foundClass._id,
            forDate: { $gte: start, $lte: end }
        };

        const attendances = await Attendance.find(attendanceFilter)
            .populate({ path: 'studentId', select: ['name', 'nis'] })
            .populate({ path: 'classId', select: 'name teachers', populate: { path: 'teachers', select: ['_id', 'name', 'nig'] } })
            .populate({ path: 'teachingGroupId', select: 'name branchYearId subBranches', populate: [
                { path: 'branchYearId', select: 'branchId', populate: { path: 'branchId', select: 'name' } },
                { path: 'subBranches', select: 'name' }
            ] })
            .populate({ path: 'branchId', select: 'name' })
            .populate({ path: 'subBranchId', select: 'name' })
            .sort({ forDate: 1 });

        // Compute aggregates
        const total = attendances.length;

        const attendanceCounts = {};
        const violationCounts = { attribute: 0, attitude: 0, tidiness: 0 };
        const teachersNotes = [];

        attendances.forEach(att => {
            // status counts
            const s = att.status || 'Tanpa Keterangan';
            attendanceCounts[s] = (attendanceCounts[s] || 0) + 1;

            // violation counts
            if (att.violations) {
                if (att.violations.attribute) violationCounts.attribute++;
                if (att.violations.attitude) violationCounts.attitude++;
                if (att.violations.tidiness) violationCounts.tidiness++;
            }

            // teachers notes (non-empty)
            if (att.teachersNotes && String(att.teachersNotes).trim().length > 0) {
                const noteDate = att.forDate ? new Date(att.forDate) : (att.timestamp ? new Date(att.timestamp) : null);
                const formattedDate = noteDate ? new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(noteDate) : '';
                teachersNotes.push({ noteContent: att.teachersNotes, noteDate: formattedDate });
            }
        });

        // attendanceData array
        const attendanceData = [];
        if (total > 0) {
            Object.keys(attendanceCounts).forEach(status => {
                const count = attendanceCounts[status];
                const pct = Math.round((count / total) * 100);
                attendanceData.push({ status, count, percentage: String(pct) });
            });
        }

        // violationData array
        const violationData = Object.keys(violationCounts).map(key => ({ violation: key, count: violationCounts[key] }));

        // teachersNotes already oldest-first because attendances sorted ascending

        // studentData - use populated student info (if any attendance exists). If no attendance, fetch student doc
        let studentDoc = null;
        if (attendances[0] && attendances[0].studentId) {
            studentDoc = attendances[0].studentId;
        } else {
            studentDoc = await Student.findById(studentId).select('name nis');
        }

        // Determine branchName and subBranchName: prefer first attendance values, else attempt to read from class's teachingGroup
        let branchName = '';
        let subBranchName = '';
        if (attendances[0]) {
            branchName = attendances[0].branchId ? (attendances[0].branchId.name || '') : '';
            subBranchName = attendances[0].subBranchId ? (attendances[0].subBranchId.name || '') : '';
        }

        if (!branchName || !subBranchName) {
            // try to populate class's teaching group -> branch
            const classFull = await Class.findById(foundClass._id).populate({ path: 'teachingGroupId', populate: [{ path: 'branchYearId', populate: { path: 'branchId', select: 'name' } }, { path: 'subBranches', select: 'name' }] }).populate({ path: 'teachers', select: ['_id', 'name', 'nig'] });
            if (!branchName && classFull && classFull.teachingGroupId && classFull.teachingGroupId.branchYearId && classFull.teachingGroupId.branchYearId.branchId) {
                branchName = classFull.teachingGroupId.branchYearId.branchId.name || '';
            }
            if (!subBranchName && classFull && classFull.teachingGroupId && Array.isArray(classFull.teachingGroupId.subBranches) && classFull.teachingGroupId.subBranches.length > 0) {
                subBranchName = classFull.teachingGroupId.subBranches[0].name || '';
            }
            // ensure foundClass teachers are available
            if (!foundClass.teachers && classFull && classFull.teachers) {
                foundClass.teachers = classFull.teachers;
            }
        }

        const studentData = {
            nis: studentDoc ? (studentDoc.nis || '') : '',
            name: studentDoc ? (studentDoc.name || '') : '',
            branchName,
            subBranchName,
            period: `${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(start)} - ${new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(end)}`
        };

        const classData = {
            name: foundClass.name || '',
            academicYearName: academicYear.name || '',
            teachers: (foundClass.teachers || []).map(t => ({ _id: t._id, name: t.name, nig: t.nig }))
        };

        console.log(`Retrieved student attendance report based on filters (${studentId})`);
        return res.status(200).json({
            attendanceData,
            violationData,
            teachersNotes,
            studentData,
            classData
        });

    } catch (error) {
        console.error('Error retrieving student attendance report:', error);
        return next(new HttpError('Internal server error occurred!', 500));
    }
};

exports.getAttendanceOverview = getAttendanceOverview
exports.getAttendanceReports = getAttendanceReports

exports.getAttendanceById = getAttendanceById
exports.getAttendancesByClass = getAttendancesByClass
exports.getAttendancesByDateAndClass = getAttendancesByDateAndClass
exports.getAttendancesByAcademicYearId = getAttendancesByAcademicYearId

exports.createNewAttendanceForClass = createNewAttendanceForClass

exports.deleteAttendanceById = deleteAttendanceById

exports.updateAttendancesByIds = updateAttendancesByIds