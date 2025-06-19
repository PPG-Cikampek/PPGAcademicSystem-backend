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

const getClasses = async (req, res, next) => {
    let classes;
    try {
        classes = await Class.find()
            .populate([
                {
                    path: 'teachingGroupYearId',
                    select: [
                        'academicYearId',
                        'teachingGroupId',
                    ],
                    populate: [
                        {
                            path: 'teachingGroupId',
                            select: 'name'
                        },
                        {
                            path: 'academicYearId',
                            select: 'name'
                        }
                    ]
                },
                { path: 'attendances', select: 'forDate' },
                { path: 'teachers', select: '_id' },
                { path: 'students', select: '_id' }
            ])
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    // Reorganize data as requested
    const grouped = {};
    for (const cls of classes) {
        const teachingGroupYear = cls.teachingGroupYearId;
        if (!teachingGroupYear || !teachingGroupYear.academicYearId) continue;
        const academicYearId = teachingGroupYear.academicYearId._id ? teachingGroupYear.academicYearId._id.toString() : teachingGroupYear.academicYearId.toString();
        const academicYearName = teachingGroupYear.academicYearId.name || '';
        if (!grouped[academicYearId]) {
            grouped[academicYearId] = {
                academicYearId,
                academicYearName,
                classes: []
            };
        }
        grouped[academicYearId].classes.push({
            _id: cls._id,
            name: cls.name,
            startTime: cls.startTime,
            isLocked: cls.isLocked,
            teachingGroupId: teachingGroupYear.teachingGroupId && teachingGroupYear.teachingGroupId.name ? teachingGroupYear.teachingGroupId.name : '',
            teachers: Array.isArray(cls.teachers) ? cls.teachers.length : 0,
            students: Array.isArray(cls.students) ? cls.students.length : 0,
            attendances: Array.isArray(cls.attendances) ? cls.attendances.length : 0
        });
    }
    const result = Object.values(grouped);
    console.log('Get classes requested');
    res.json({ academicYears: result });
}

const getClassById = async (req, res, next) => {
    const classId = req.params.classId;
    const { populate } = req.query;

    let identifiedClass;
    try {
        if (populate === 'all') {
            identifiedClass = await Class.findById(classId)
                .populate([
                    {
                        path: 'teachingGroupId', select: ['name', 'branchYearId'],
                        populate: { path: 'branchYearId', select: ['isActive', 'academicYearId'], populate: { path: 'academicYearId', select: 'isActive' } }
                    },
                    // { path: 'attendances', select: 'forDate' }
                ])
                .populate({ path: 'teachers' })
                .populate({ path: 'students', populate: { path: 'userId', select: 'subBranchId', populate: { path: 'subBranchId', select: 'name' } } })
        } else if (populate === 'branchYear') {
            identifiedClass = await Class.findById(classId)
                .populate([
                    {
                        path: 'teachingGroupId', select: ['name', 'branchYearId'],
                        populate: { path: 'branchYearId', select: ['isActive', 'academicYearId'], populate: { path: 'academicYearId', select: 'isActive' } }
                    },
                ])
        } else {
            identifiedClass = await Class.findById(classId)
            // .populate({ path: 'attendances', select: 'forDate' })
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    if (!identifiedClass) {
        return next(new HttpError(`Cannot find class with id '${classId}'`, 404))
    }

    console.log('Get getClassById requested');
    res.json({ class: identifiedClass.toObject({ getters: true }) });
}

const getClassAttendanceByIdAndStudentId = async (req, res, next) => {
    const { classId, studentId } = req.params;

    let identifiedClass;
    try {

        identifiedClass = await Class.find({ _id: classId, attendances: { $elemMatch: { studentId: studentId } } })
            .populate({ path: 'teachingGroupYearId', populate: { path: 'teachingGroupId', select: 'name' } })
            .populate({ path: 'teachers' })
            .populate({ path: 'students' })

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    if (!identifiedClass) {
        return next(new HttpError(`Cannot find class with id '${classId}'`, 404))
    }

    console.log('Get getClassById requested');
    res.json({ class: identifiedClass });
}

const getClassesByIds = async (req, res, next) => {
    const classIds = req.body.classIds; // Assuming classIds are sent in the request body as an array
    console.log(classIds)

    if (!Array.isArray(classIds) || classIds.length === 0) {
        return next(new HttpError("Invalid input. Please provide a list of class IDs.", 400));
    }

    let identifiedClasses;
    try {
        identifiedClasses = await Class.find({ _id: { $in: classIds } })
            .populate({ path: 'teachingGroupId', populate: { path: 'branchYearId', populate: { path: 'academicYearId', select: ['name', 'isActive'] } } })
        // .populate({ path: 'attendances', select: 'forDate' })
        // .populate({ path: 'teachers' })
        // .populate({ path: 'students' });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    if (!identifiedClasses || identifiedClasses.length === 0) {
        return next(new HttpError("No classes found for the provided IDs.", 404));
    }

    console.log('Get getClassesByIds requested');
    res.json({
        classes: identifiedClasses.map(cls => cls.toObject({ getters: true })),
    });
};

const getClassesByTeachingGroupId = async (req, res, next) => {
    const teachingGroupId = req.params.teachingGroupId;

    let classes;

    try {
        classes = await Class.find().populate([
            { path: 'teachingGroupId' },
            // { path: 'attendances', select: 'forDate' }
        ]);

        // console.log('before filter', classes)
        console.log(classes)
        classes = classes.filter(cls => cls.teachingGroupId._id === teachingGroupId);
        // console.log('after filter', classes)
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    res.json({ classes: classes.map(x => x.toObject({ getters: true })) });
}

const getClassesByTeachingGroupYearId = async (req, res, next) => {
    const teachingGroupYearId = req.params.teachingGroupYearId;

    let classes;

    try {
        classes = await Class.find({ teachingGroupYearId })
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }
    console.log(classes)
    console.log('Get classes requested by TeachingGroupYearId requested');
    res.json({ classes: classes.map(x => x.toObject({ getters: true })) });
}

const createClass = async (req, res, next) => {
    const { name, startTime, endTime, teachingGroupId } = req.body

    let identifiedTeachingGroup;
    try {
        identifiedTeachingGroup = await TeachingGroup.findById(teachingGroupId)
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!identifiedTeachingGroup) {
        return next(new HttpError('Tahun ajaran belum terdaftar di Kelompok ini!', 500));
    }

    const createdClass = new Class({
        name,
        startTime,
        endTime,
        isLocked: false,
        teachers: [],
        students: [],
        teachingGroupId: identifiedTeachingGroup._id
    })

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction()
        await createdClass.save({ session: sess });
        identifiedTeachingGroup.classes.push(createdClass);
        await identifiedTeachingGroup.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menambahkan kelas!', 500);
        return next(error);
    }

    res.status(202).json({ message: `Berhasil menambahkan kelas!`, createdClass });
}

const deleteClass = async (req, res, next) => {
    const { classId } = req.body;

    // Find the class to delete
    let existingClass;
    try {
        existingClass = await Class.findById(classId).populate('teachingGroupYearId');
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error while finding class!', 500));
    }

    if (!existingClass) {
        return next(new HttpError('Class not found!', 404));
    }

    if (existingClass.students.length > 0 || existingClass.teachers.length > 0) {
        return next(new HttpError('Kosongkan kelas dari guru dan siswa untuk menghapus kelas!', 400));
    }

    // Extract associated teachingGroupYear
    const { teachingGroupYearId } = existingClass;

    if (!teachingGroupYearId) {
        return next(new HttpError('Associated active year not found!', 500));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();

        // Remove reference from the teachingGroupYear
        teachingGroupYearId.classes.pull(existingClass);
        await teachingGroupYearId.save({ session: sess });

        // Delete the class
        await existingClass.deleteOne({ session: sess });

        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        return next(new HttpError('Gagal menghapus kelas!', 500));
    }

    res.status(200).json({ message: 'Berhasil menghapus kelas!' });
};


const registerStudentToClass = async (req, res, next) => {
    const { classId, studentId } = req.body;

    let existingClass;
    let existingStudent;
    try {
        existingClass = await Class.findById(classId)
        existingStudent = await Student.findById(studentId)
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!existingClass) {
        return next(new HttpError('Kelas tidak ditemukan!', 500));
    }
    if (!existingStudent) {
        return next(new HttpError('Peserta tidak ditemukan!', 500));
    }

    // Check if student is already enrolled in any class in the same teaching group
    const studentClassIds = existingStudent.classIds || [];
    if (studentClassIds.length > 0) {
        const studentClasses = await Class.find({ _id: { $in: studentClassIds } });
        const isInSameTeachingGroup = studentClasses.some(cls =>
            cls.teachingGroupId.toString() === existingClass.teachingGroupId.toString()
        );
        if (isInSameTeachingGroup) {
            return next(new HttpError('Peserta didik sudah terdaftar di kelas lain dalam KBM ini!', 500));
        }
    }

    const isStudentEnrolled = existingClass.students.some(student => student.toString() === studentId);
    if (isStudentEnrolled) {
        return next(new HttpError('Peserta didik sudah terdaftar di kelas ini!', 500));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction()
        existingStudent.classIds.push(existingClass);
        existingClass.students.push(existingStudent);
        await existingStudent.save({ session: sess });
        await existingClass.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menambahkan peserta didik!', 500);
        return next(error);
    }

    console.log(`A student has been registered to Class!`)
    res.status(202).json({ message: `Berhasil menambahkan peserta didik!`, class: existingClass });
}

const registerTeacherToClass = async (req, res, next) => {
    const { classId, teacherId } = req.body;

    // Finding relevant subbranch and academic year
    let existingClass;
    let existingTeacher;
    try {
        existingClass = await Class.findById(classId)
        existingTeacher = await Teacher.findById(teacherId)
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!existingClass) {
        return next(new HttpError('Kelas tidak ditemukan!', 500));
    }
    if (!existingTeacher) {
        return next(new HttpError('Guru tidak ditemukan!', 500));
    }

    const isTeacherProfileComplete = existingTeacher.isProfileComplete

    if (!isTeacherProfileComplete) {
        return next(new HttpError('Profil guru belum lengkap!', 500));
    }

    const isTeacherEnrolled = existingClass.teachers.some(teacher => teacher.toString() === teacherId);

    if (isTeacherEnrolled) {
        return next(new HttpError('Tenaga pendidik sudah terdaftar di kelas ini!', 500));
    }


    try {
        const sess = await mongoose.startSession();
        sess.startTransaction()
        // await createdTeachingGroupYear.save({ session: sess });
        existingTeacher.classIds.push(existingClass);
        existingClass.teachers.push(existingTeacher);
        await existingTeacher.save({ session: sess });
        await existingClass.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menambahkan tenaga pendidik!', 500);
        return next(error);
    }

    console.log(`A teacher has been registered to Class!`)
    res.status(202).json({ message: `Berhasil menambahkan tenaga pendidik!`, class: existingClass });
}

const removeStudentFromClass = async (req, res, next) => {
    const { classId, studentId } = req.body;

    // Find relevant class and student
    let existingClass;
    let existingStudent;
    try {
        existingClass = await Class.findById(classId);
        existingStudent = await Student.findById(studentId);
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!existingClass) {
        return next(new HttpError('Kelas tidak ditemukan!', 404));
    }
    if (!existingStudent) {
        return next(new HttpError('Peserta didik tidak ditemukan!', 404));
    }

    const normalizedStudentId = studentId.toString();
    const normalizedClassId = classId.toString();

    // Check if the student is associated with the class
    const studentIndex = existingClass.students.findIndex(
        student => student.toString() === normalizedStudentId
    );
    const classIndex = existingStudent.classIds.findIndex(
        c => c.toString() === normalizedClassId
    );

    if (studentIndex === -1 || classIndex === -1) {
        return next(new HttpError('Peserta didik tidak terdaftar di kelas ini!', 400));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();

        // Remove student from class
        existingClass.students.splice(studentIndex, 1);
        await existingClass.save({ session: sess });

        // Remove class from student
        existingStudent.classIds.splice(classIndex, 1);
        await existingStudent.save({ session: sess });

        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menghapus peserta didik dari kelas!', 500);
        return next(error);
    }

    res.status(200).json({ message: `Berhasil menghapus peserta didik dari kelas!`, class: existingClass });
};


const removeTeacherFromClass = async (req, res, next) => {
    const { classId, teacherId } = req.body;

    let existingClass;
    let existingTeacher;
    try {
        existingClass = await Class.findById(classId);
        existingTeacher = await Teacher.findById(teacherId);
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!existingClass) {
        return next(new HttpError('Kelas tidak ditemukan!', 404));
    }
    if (!existingTeacher) {
        return next(new HttpError('Guru tidak ditemukan!', 404));
    }

    // Normalize IDs for comparison
    const normalizedTeacherId = teacherId.toString();
    const normalizedClassId = classId.toString();

    // Check if the teacher is associated with the class
    const teacherIndex = existingClass.teachers.findIndex(
        teacher => teacher.toString() === normalizedTeacherId
    );
    const classIndex = existingTeacher.classIds.findIndex(
        c => c.toString() === normalizedClassId
    );

    if (teacherIndex === -1 || classIndex === -1) {
        return next(new HttpError('Tenaga pendidik tidak terdaftar di kelas ini!', 400));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();

        // Remove teacher from class
        existingClass.teachers.splice(teacherIndex, 1);
        await existingClass.save({ session: sess });

        // Remove class from teacher
        existingTeacher.classIds.splice(classIndex, 1);
        await existingTeacher.save({ session: sess });

        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menghapus tenaga pendidik dari kelas!', 500);
        return next(error);
    }

    res.status(200).json({ message: `Berhasil menghapus tenaga pendidik dari kelas!`, class: existingClass });
};

const lockClassById = async (req, res, next) => {
    const { classId } = req.body;

    let identifiedClass;
    try {
        // Fetch the TeachingGroupYear and populate the classes to check their isLocked status
        identifiedClass = await Class.findById(classId)
            .populate({ path: 'teachers' })
            .populate({ path: 'students' })

        if (!identifiedClass) {
            return next(new HttpError(`Could not find an Class with ID '${classId}'`, 404));
        }

        // Check if any class is not locked
        if (identifiedClass.students.length === 0) {
            return next(new HttpError('Kelas minimal harus ada 1 peserta didik!', 400));
        }

        if (identifiedClass.teachers.length === 0) {
            return next(new HttpError('Kelas minimal harus ada 1 tenaga pendidik!', 400));
        }

        // Proceed with updating the Class if all classes are locked
        identifiedClass = await Class.findByIdAndUpdate(
            classId,
            { isLocked: true },
            { new: true, runValidators: true }
        );

    } catch (err) {
        console.error(err);
        return next(new HttpError('Gagal mengunci kelas!', 500));
    }

    console.log(`Locked class with id ${classId}`);
    res.json({ message: 'Berhasil mengunci kelas!', class: identifiedClass.toObject({ getters: true }) });
}

const unlockClassById = async (req, res, next) => {
    const { classId } = req.body;

    let identifiedClass;
    try {
        // Fetch the TeachingGroupYear and populate the classes to check their isLocked status
        identifiedClass = await Class.findById(classId)

        // Proceed with updating the Class if all classes are locked
        identifiedClass = await Class.findByIdAndUpdate(
            classId,
            { isLocked: false },
            { new: true, runValidators: true }
        );

    } catch (err) {
        console.error(err);
        return next(new HttpError('Gagal membuka kelas!', 500));
    }

    console.log(`Unlocked class with id ${classId}`);
    res.json({ message: 'Berhasil membuka kelas!', class: identifiedClass.toObject({ getters: true }) });
}

exports.getClasses = getClasses
exports.getClassById = getClassById
exports.getClassesByIds = getClassesByIds
exports.getClassesByTeachingGroupId = getClassesByTeachingGroupId
exports.getClassesByTeachingGroupYearId = getClassesByTeachingGroupYearId
exports.createClass = createClass
exports.deleteClass = deleteClass
exports.registerStudentToClass = registerStudentToClass
exports.registerTeacherToClass = registerTeacherToClass
exports.removeStudentFromClass = removeStudentFromClass
exports.removeTeacherFromClass = removeTeacherFromClass

exports.getClassAttendanceByIdAndStudentId = getClassAttendanceByIdAndStudentId

exports.lockClassById = lockClassById
exports.unlockClassById = unlockClassById