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

    // centralized empty response
    const emptyResponse = { studentsData: [], overallStats: [], violationStats: [] };

    try {
        // Normalize inputs
        const teacherClassIdsArr = (teacherClassIds && Array.isArray(teacherClassIds) && teacherClassIds.length > 0)
            ? teacherClassIds.map(id => id.toString())
            : null;
        const classIdStr = classId ? classId.toString() : null;

        // Build attendance filter in one place
        const attendanceFilter = {};
        if (branchId) attendanceFilter.branchId = branchId;
        if (subBranchId) attendanceFilter.subBranchId = subBranchId;
        if (teachingGroupId) attendanceFilter.teachingGroupId = teachingGroupId;

        if (teacherClassIdsArr) attendanceFilter.classId = { $in: teacherClassIdsArr };
        else if (classIdStr) attendanceFilter.classId = classIdStr;

        // Validate and apply date range if provided
        if (startDate && endDate) {
            const s = new Date(startDate);
            const e = new Date(endDate);
            if (isNaN(s.getTime()) || isNaN(e.getTime())) {
                return next(new HttpError('Invalid date format for startDate or endDate!', 400));
            }
            attendanceFilter.forDate = { $gte: s, $lte: e };
        }

        // If academicYearId is provided, find matching classes and validate/attach class filter
        let classIds = null;
        if (academicYearId) {
            const academicYear = await AcademicYear.findById(academicYearId)
                .populate({
                    path: 'branchYears',
                    populate: {
                        path: 'teachingGroups',
                        select: 'classes',
                        populate: { path: 'classes', select: '_id' }
                    }
                })
                .select('branchYears')
                .lean();

            if (!academicYear) return res.status(200).json(emptyResponse);

            // flatten class ids (as strings)
            classIds = (academicYear.branchYears || []).reduce((acc, by) => {
                (by.teachingGroups || []).forEach(tg => {
                    (tg.classes || []).forEach(c => acc.push(c._id ? c._id.toString() : c.toString()));
                });
                return acc;
            }, []);

            if (!classIds || classIds.length === 0) return res.status(200).json(emptyResponse);

            // If request already constrained by class(s), ensure requested ids are within academic year classes
            if (attendanceFilter.classId) {
                let requestedIds = [];
                if (attendanceFilter.classId.$in) requestedIds = attendanceFilter.classId.$in.map(id => id.toString());
                else if (Array.isArray(attendanceFilter.classId)) requestedIds = attendanceFilter.classId.map(id => id.toString());
                else requestedIds = [attendanceFilter.classId.toString()];

                const allContained = requestedIds.every(id => classIds.includes(id));
                if (!allContained) return res.status(200).json(emptyResponse);
            } else {
                attendanceFilter.classId = { $in: classIds };
            }
        }

        // Query attendances efficiently (lean)
        const attendances = await Attendance.find(attendanceFilter)
            .populate({ path: 'studentId', select: ['name', 'nis', 'image', 'thumbnail'] })
            .populate({ path: 'classId', select: 'name teachers', populate: { path: 'teachers', select: ['name', 'nig'] } })
            .populate({
                path: 'teachingGroupId',
                select: 'name branchYearId subBranches',
                populate: [
                    { path: 'branchYearId', select: 'branchId', populate: { path: 'branchId', select: 'name' } },
                    { path: 'subBranches', select: 'name' }
                ]
            })
            .populate({ path: 'branchId', select: 'name' })
            .populate({ path: 'subBranchId', select: 'name' })
            .sort({ forDate: 1, 'studentId.name': 1 })
            .lean();

        const attendancesList = attendances || [];

        // helper closures kept local: overall and violation stats (overallStats kept using raw status values per defaults)
        const getOverallStats = (atts) => {
            const statusCounts = atts.reduce((acc, a) => {
                const s = a.status || 'Tanpa Keterangan';
                acc[s] = (acc[s] || 0) + 1;
                return acc;
            }, {});
            const total = atts.length || 0;
            if (total === 0) return [];
            return Object.keys(statusCounts).map(status => ({ status, count: statusCounts[status], percentage: Math.round((statusCounts[status] / total) * 10000) / 100 })).sort((a, b) => a.status.localeCompare(b.status));
        };

        const getViolationStats = (atts) => {
            const violationCounts = {};
            atts.forEach(a => {
                if (!a.violations || typeof a.violations !== 'object') return;
                Object.entries(a.violations).forEach(([violation, occurred]) => {
                    if (occurred) violationCounts[violation] = (violationCounts[violation] || 0) + 1;
                });
            });
            return Object.entries(violationCounts).map(([violation, count]) => ({ violation, count }));
        };

        // Determine rosterClassIds preference: teacherClassIds > classId > academicYear derived classIds
        let rosterClassIds = null;
        if (teacherClassIdsArr) rosterClassIds = teacherClassIdsArr;
        else if (classIdStr) rosterClassIds = [classIdStr];
        else if (classIds && classIds.length > 0) rosterClassIds = classIds;

        // Collect roster student IDs
        let rosterStudentIds = [];
        if (rosterClassIds && rosterClassIds.length > 0) {
            const classes = await Class.find({ _id: { $in: rosterClassIds } }).select('students').lean();
            const set = classes.reduce((acc, c) => {
                (c.students || []).forEach(s => acc.add(s.toString()));
                return acc;
            }, new Set());
            rosterStudentIds = Array.from(set);
        } else {
            // fallback: include students seen in attendances
            rosterStudentIds = Array.from(new Set(attendancesList.map(a => {
                if (!a.studentId) return null;
                if (typeof a.studentId === 'string') return a.studentId.toString();
                if (a.studentId._id) return a.studentId._id.toString();
                if (a.studentId.toString) return a.studentId.toString();
                return null;
            }).filter(Boolean)));
        }

        // If subBranchId is provided, intersect rosterStudentIds with students whose User.subBranchId matches
        if (subBranchId) {
            // Find users that belong to the requested subBranch
            const usersInSub = await User.find({ subBranchId }).select('_id').lean();
            const userIds = (usersInSub || []).map(u => u._id.toString());

            if (userIds.length === 0) {
                // No users in that sub-branch -> empty response
                return res.status(200).json(emptyResponse);
            }

            // Find students linked to those users and also present in the current roster
            const filteredStudents = await Student.find({ userId: { $in: userIds }, _id: { $in: rosterStudentIds } }).select('_id').lean();
            rosterStudentIds = (filteredStudents || []).map(s => s._id.toString());

            if (!rosterStudentIds || rosterStudentIds.length === 0) {
                // No matching students after applying subBranch filter
                return res.status(200).json(emptyResponse);
            }
        }

        // Perform a DB-level attendance query limited to the allowed rosterStudentIds for better performance
        let filteredAttendances = [];
        console.log(req.userData)
        if (rosterStudentIds && rosterStudentIds.length > 0) {
            const attendanceQuery = Object.assign({}, attendanceFilter, { studentId: { $in: rosterStudentIds } });
            filteredAttendances = await Attendance.find(attendanceQuery)
                .populate({ path: 'studentId', select: ['name', 'nis', 'image', 'thumbnail'] })
                .populate({ path: 'classId', select: 'name teachers', populate: { path: 'teachers', select: ['name', 'nig'] } })
                .populate({
                    path: 'teachingGroupId',
                    select: 'name branchYearId subBranches',
                    populate: [
                        { path: 'branchYearId', select: 'branchId', populate: { path: 'branchId', select: 'name' } },
                        { path: 'subBranches', select: 'name' }
                    ]
                })
                .populate({ path: 'branchId', select: 'name' })
                .populate({ path: 'subBranchId', select: 'name' })
                .sort({ forDate: 1, 'studentId.name': 1 })
                .lean();
        }

        // Fetch student docs for roster (name, nis, thumbnail)
        const students = rosterStudentIds.length > 0 ? await Student.find({ _id: { $in: rosterStudentIds } }).select('name nis thumbnail').lean() : [];
        const studentMap = {};
        students.forEach(s => { studentMap[s._id.toString()] = s; });

        // Normalization mappings (used for student-level labels)
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
                id,
                name: sd.name || '',
                nis: sd.nis || '',
                thumbnail: sd.thumbnail || '',
                attendances: commonStatuses.reduce((o, s) => { o[s] = 0; return o; }, {}),
                violationData: { 'Perlengkapan Belajar': 0, 'Sikap': 0, 'Kerapihan': 0 }
            };
        });

        // Aggregate attendances into studentAgg (use filtered attendances)
        filteredAttendances.forEach(att => {
            if (!att.studentId) return;
            let sid = null;
            if (typeof att.studentId === 'string') sid = att.studentId.toString();
            else if (att.studentId._id) sid = att.studentId._id.toString();
            else sid = att.studentId.toString();

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
            if (!studentAgg[sid].attendances.hasOwnProperty(mapped)) studentAgg[sid].attendances[mapped] = 0;
            studentAgg[sid].attendances[mapped]++;

            // violations (guarded)
            if (att.violations && typeof att.violations === 'object') {
                if (att.violations.attribute) studentAgg[sid].violationData['Perlengkapan Belajar']++;
                if (att.violations.attitude) studentAgg[sid].violationData['Sikap']++;
                if (att.violations.tidiness) studentAgg[sid].violationData['Kerapihan']++;
            }
        });

        // Convert per-student attendance counts into percentages that sum to 100 (kept logic)
        Object.values(studentAgg).forEach(student => {
            const counts = student.attendances || {};
            const keys = Object.keys(counts);
            const totalCount = keys.reduce((s, k) => s + (counts[k] || 0), 0);

            if (totalCount === 0) {
                keys.forEach(k => { student.attendances[k] = 0; });
                return;
            }

            const items = keys.map(k => {
                const raw = (counts[k] / totalCount) * 100;
                const floor = Math.floor(raw);
                return { key: k, raw, floor, frac: raw - floor };
            });

            let sumFloor = items.reduce((s, it) => s + it.floor, 0);
            let remainder = 100 - sumFloor;
            items.sort((a, b) => b.frac - a.frac);
            for (let i = 0; i < items.length && remainder > 0; i++) {
                items[i].floor += 1;
                remainder -= 1;
            }
            items.forEach(it => { student.attendances[it.key] = it.floor; });
        });

        const studentsData = Object.values(studentAgg).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Build studentsDataByClass grouped from studentsData and class membership
        let studentsDataByClass = [];
        if (req.userData.userRole === 'subBranchAdmin') {
            try {
                // decide which class ids to use for grouping: prefer rosterClassIds, else derive from attendances
                const classIdsToGroup = (rosterClassIds && rosterClassIds.length > 0)
                    ? rosterClassIds
                    : Array.from(new Set(filteredAttendances.map(a => {
                        if (!a.classId) return null;
                        if (typeof a.classId === 'string') return a.classId.toString();
                        if (a.classId._id) return a.classId._id.toString();
                        return a.classId.toString();
                    }).filter(Boolean)));

                if (classIdsToGroup && classIdsToGroup.length > 0) {
                    // load classes (students membership) for grouping
                    const classesForGroup = await Class.find({ _id: { $in: classIdsToGroup } }).select('_id name students').lean();

                    // build map of classId -> Set(studentId)
                    const classStudentMap = {};
                    (classesForGroup || []).forEach(c => {
                        classStudentMap[c._id.toString()] = new Set((c.students || []).map(s => s.toString()));
                    });

                    // create group entries for known classes
                    studentsDataByClass = (classesForGroup || []).map(c => {
                        const cId = c._id.toString();
                        const studentsInClass = studentsData.filter(sd => classStudentMap[cId] && classStudentMap[cId].has(sd.id));
                        return {
                            classId: cId,
                            className: c.name || '',
                            students: studentsInClass
                        };
                    });

                    // fallback: if some class ids came from attendances but have no Class doc, include them too
                    const knownIds = new Set((classesForGroup || []).map(c => c._id.toString()));
                    const missingClassIds = classIdsToGroup.filter(id => !knownIds.has(id));
                    missingClassIds.forEach(id => {
                        const studentsInClass = studentsData.filter(sd => {
                            return filteredAttendances.some(a => {
                                if (!a.classId) return false;
                                const cid = (typeof a.classId === 'string') ? a.classId.toString() : (a.classId._id ? a.classId._id.toString() : a.classId.toString());
                                const sid = (typeof a.studentId === 'string') ? a.studentId.toString() : (a.studentId._id ? a.studentId._id.toString() : a.studentId.toString());
                                return cid === id && sd.id === sid;
                            });
                        });
                        studentsDataByClass.push({ classId: id, className: '', students: studentsInClass });
                    });
                }
            } catch (e) {
                // don't fail the whole request if grouping fails; return empty groups
                console.warn('Failed to build studentsDataByClass', e);
                studentsDataByClass = [];
            }
        }
        // Remove any class groups that have no students to avoid sending empty classes to frontend
        try {
            if (Array.isArray(studentsDataByClass)) {
                studentsDataByClass = studentsDataByClass.filter(g => Array.isArray(g.students) && g.students.length > 0);
            }
        } catch (e) {
            // if filtering fails for any reason, keep original groups but do not crash
            console.warn('Failed to filter empty studentsDataByClass groups', e);
        }

        // Final single debug log
        console.log(`Retrieved ${filteredAttendances.length} attendance records (after subBranch/student filtering)`);

        return res.status(200).json({
            studentsData,
            studentsDataByClass,
            overallStats: getOverallStats(filteredAttendances),
            violationStats: getViolationStats(filteredAttendances)
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
            .populate({
                path: 'teachingGroupId', select: 'name branchYearId subBranches', populate: [
                    { path: 'branchYearId', select: 'branchId', populate: { path: 'branchId', select: 'name' } },
                    { path: 'subBranches', select: 'name' }
                ]
            })
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