const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const User = require('../models/user');
const Branch = require('../models/branch');
const TeachingGroup = require('../models/teachingGroup');
const AcademicYear = require('../models/academicYear')
const Class = require('../models/class')
const TeachingGroupYear = require('../models/teachingGroupYear')
const Student = require('../models/student')
const Teacher = require('../models/teacher')
const Attendance = require('../models/attendance');
const attendance = require('../models/attendance');
const teachingGroupYear = require('../models/teachingGroupYear');

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
    const { classId } = req.body;

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
                attributes: false,
                violations: { attribute: false, attitude: false, tidiness: false },
                teachersNotes,
                studentId,
                classId,
            });

            const createdAttendance = await attendance.save({ session });
            attendances.push(createdAttendance);

            // Step 2: Update the respective student document with the created attendance ID
            await Student.findByIdAndUpdate(
                studentId,
                { $push: { attendanceIds: createdAttendance._id } },
                { session }
            );
        }

        // Step 3: Update class schema with all attendance references
        const attendanceIds = attendances.map(attendance => attendance._id);
        await Class.findByIdAndUpdate(
            classId,
            { $push: { attendances: { $each: attendanceIds } } },
            { session }
        );

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
            .populate({ path: 'studentId', select: ['name', 'nis', 'image'] });
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



// const getAttendanceReports = async (req, res, next) => {
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
//                     { path: 'teachers', select: ['name', 'nid'] }
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
const getAttendanceReports = async (req, res, next) => {
    const { academicYearId, branchId, teachingGroupId, classId, startDate, endDate } = req.body;

    const filter = {};

    if (academicYearId) {
        filter.academicYearId = academicYearId;
    }

    let teachingGroupYears;
    try {
        teachingGroupYears = await TeachingGroupYear.find(filter)
            .populate({
                path: 'classes',
                populate: [
                    { path: 'attendances', populate: { path: 'studentId', select: ['name', 'nis', 'image'] } },
                    { path: 'teachers', select: ['name', 'nid'] }
                ]
            })
            .populate({
                path: 'teachingGroupId',
                select: 'name',
                populate: {
                    path: 'branchId',
                    select: 'name'
                }
            });

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            teachingGroupYears = teachingGroupYears.map(teachingGroupYear => {
                const filteredClasses = teachingGroupYear.classes.map(cls => {
                    const filteredAttendances = cls.attendances.filter(attendance => {
                        const attendanceDate = new Date(attendance.forDate);
                        return attendanceDate >= start && attendanceDate <= end;
                    });
                    // Use toObject to create a copy, modify attendance, then return
                    const updatedClass = cls.toObject();
                    updatedClass.attendances = filteredAttendances;
                    return updatedClass;
                });

                const updatedTeachingGroupYear = teachingGroupYear.toObject();
                updatedTeachingGroupYear.classes = filteredClasses;
                return updatedTeachingGroupYear;
            });
        }

        if (branchId) {
            teachingGroupYears = teachingGroupYears.filter(teachingGroupYear => teachingGroupYear.teachingGroupId.branchId._id.toString() === branchId);
        }

        if (teachingGroupId) {
            teachingGroupYears = teachingGroupYears.filter(teachingGroupYear => teachingGroupYear.teachingGroupId._id.toString() === teachingGroupId);
        }

        console.log(teachingGroupYears);

        if (classId) {  //ClassId Filter
            teachingGroupYears = teachingGroupYears.map(teachingGroupYear => {
                const teachingGroupYearCopy = teachingGroupYear; // Create a copy FIRST
                teachingGroupYearCopy.classes = teachingGroupYearCopy.classes.filter(cls => cls._id.toString() === classId);
                if (teachingGroupYearCopy.classes.length > 0) {
                    return teachingGroupYearCopy; // Return the copy
                } else {
                    return null;  // Handle cases where classId isn't found
                }
            }).filter(Boolean); // Remove any nulls
        }

        console.log(teachingGroupYears);

        if (!teachingGroupYears || teachingGroupYears.length === 0) {
            console.log('No matching attendances found for the given filters.');
            return res.status(200).json([]); // Or handle not found error if that's preferred
        }

        console.log(`Retrieved attendance reports based on filters`);
        return res.status(200).json({ teachingGroupYears });

    } catch (error) {
        console.error('Error retrieving attendance reports:', error);
        return next(new HttpError('Internal server error occurred!', 500));
    }
};

exports.getAttendanceReports = getAttendanceReports


exports.getAttendanceById = getAttendanceById
exports.getAttendancesByClass = getAttendancesByClass
exports.getAttendancesByDateAndClass = getAttendancesByDateAndClass
exports.getAttendancesByAcademicYearId = getAttendancesByAcademicYearId

exports.createNewAttendanceForClass = createNewAttendanceForClass

exports.deleteAttendanceById = deleteAttendanceById

exports.updateAttendancesByIds = updateAttendancesByIds