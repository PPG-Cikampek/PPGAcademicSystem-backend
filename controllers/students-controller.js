const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const Student = require('../models/student');
const User = require('../models/user');

const getStudents = async (req, res, next) => {
    let students;
    try {
        students = await Student.find()
            .populate({ path: 'userId', select: 'teachingGroupId', populate: { path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } } })

    } catch (err) {
        console.log(err)
        return next(new HttpError("Internal server error occured!", 500))
    }
    console.log('Get all students requested')
    res.json({ students });
};

const getStudentById = async (req, res, next) => {
    const studentId = req.params.studentId;
    const { populate } = req.query;

    let student;

    try {
        if (populate === 'attendance') {
            student = await Student.findById(studentId)
                .populate({ path: 'userId', select: 'teachingGroupId', populate: { path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } } })
                .populate({
                    path: 'attendanceIds',
                    populate: { path: 'classId', select: 'name' }
                })
        } else {
            student = await Student.findById(studentId)
                .populate({ path: 'userId', select: 'teachingGroupId', populate: { path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } } })
                .populate({
                    path: 'classIds',
                    populate: { path: 'teachingGroupYearId' }
                })
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get student requested');
    if (!student) {
        return next(new HttpError("Student not found!", 404));
    }

    res.json({ student: student.toObject({ getters: true }) });
}

const getStudentByNis = async (req, res, next) => {
    const nis = req.params.nis;

    let student;
    try {
        student = await Student.find({ nis: nis });
        // .populate({ path: 'userId', select: 'name', populate: { path: 'branchId', select: 'name' } });

        if (student.length === 0) {
            return next(new HttpError("Student not found!", 404));
        }

        student = {
            nis: student[0].nis,
            name: student[0].name,
            email: student[0].email,
        } // Access the first element

    } catch (err) {
        console.log(err)
        return next(new HttpError("Internal server error occured!", 500))
    }

    console.log(`Get student with ${nis}`)
    res.json({ student });
}

const getStudentByUserId = async (req, res, next) => {
    const userId = req.params.userId;

    let student;

    try {
        student = await Student.findOne({ userId })
            .populate({ path: 'userId', select: 'teachingGroupId', populate: { path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } } })
        // .populate({
        //     path: 'classIds',
        //     populate: [
        //         { path: 'teachingGroupYearId', populate: { path: 'academicYearId', select: ['name', 'isActive'] } },
        //         { path: 'attendances', select: 'forDate' }
        //     ]
        // });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log(`Get student by userId ${userId} requested`);
    res.json({ student: student.toObject({ getters: true }) });
}

const getStudentReportByIdAndClassId = async (req, res, next) => {
    const { studentId, classId } = req.body;

    let student;
    try {
        student = await Student.find({ _id: studentId, classIds: classId })
            .populate({ path: 'userId', select: 'teachingGroupId', populate: { path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } } })
            .populate({
                path: 'attendanceIds',
                populate: { path: 'classId', select: 'name' }
            })

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get student requested');
    res.json({ student: student.toObject({ getters: true }) });
}

const getStudentsByTeachingGroupId = async (req, res, next) => {
    const teachingGroupId = req.params.teachingGroupId;

    let students;
    try {
        // 1. Find matching users
        const users = await User.find({ teachingGroupId: teachingGroupId });

        // 2. Extract user IDs
        const userIds = users.map(user => user._id);

        // 3. Find students based on user IDs
        students = await Student.find({ userId: { $in: userIds } })
            .populate({
                path: 'userId',
                select: 'teachingGroupId',
                populate: {
                    path: 'teachingGroupId',
                    select: 'name',
                    populate: {
                        path: 'branchId',
                        select: 'name'
                    }
                }
            })
            .populate({
                path: 'classIds',
                select: ['name', 'teachingGroupYearId'],
                populate: {
                    path: 'teachingGroupYearId',
                    select: 'academicYearId',
                    populate: { path: 'academicYearId', select: ['name', 'isActive'] }
                }
            })
            .sort({ nis: 1 });

        students = students.map(student => {
            const isActive = student.classIds.some(classId => classId.teachingGroupYearId.academicYearId.isActive);
            return { ...student.toObject({ getters: true }), isActive };
        });

    } catch (err) {
        console.log(err)
        return next(new HttpError("Internal server error occured!", 500))
    }
    console.log('Get users requested')
    res.json({ students })
};

const createStudent = async (req, res, next) => {
    const { name, email, nis } = req.body;

    let identifiedUser;
    try {
        identifiedUser = await User.findOne({ email });
    } catch (err) {
        console.log(err);
        console.log(identifiedUser);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!identifiedUser) {
        return next(new HttpError('User tidak ditemukan!', 500));
    }

    const createdStudent = new Student({
        userId: identifiedUser.id,
        name,
        nis,
        dateOfBirth: "",
        gender: "",
        parentName: "",
        parentPhone: "",
        address: "",
        image: "",
        thumbnail: "",
        attendanceIds: [],
        classIds: []
    });

    try {
        await createdStudent.save();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menambahkan peserta didik!', 500);
        return next(error);
    }

    res.status(202).json({ message: `Berhasil mendaftarkan peserta didik! ${name}!`, student: createdStudent });
}

const updateStudent = async (req, res, next) => {
    const { nis, name, dateOfBirth, gender, parentName, parentPhone, address, thumbnail } = req.body;
    const studentId = req.params.studentId;

    let student;
    try {
        const updateData = { ...(nis && { nis }), name, dateOfBirth, gender, address, parentName, parentPhone, isProfileComplete: true };
        if (req.file) {
            updateData.image = req.file.path.replace(/\\/g, '/');
            updateData.originalImagePath = req.file.path;
        }
        if (thumbnail) {
            updateData.thumbnail = thumbnail;
        }

        student = await Student.findByIdAndUpdate(
            studentId,
            updateData,
            { new: true, runValidators: true }
        );

        if (student) {
            const userUpdate = { name: student.name };
            if (req?.file?.path) userUpdate.image = req.file.path;
            if (thumbnail) userUpdate.thumbnail = thumbnail;
            await User.findByIdAndUpdate(
                student.userId,
                userUpdate,
                { new: true, runValidators: true }
            );
        }

    } catch (err) {
        console.error(err);
        const error = new HttpError('Something went wrong while updating the student.', 500);
        return next(error);
    }

    if (!student) {
        return next(new HttpError(`Could not find a student with ID '${studentId}'`, 404));
    }

    console.log(`Student with nis '${student.nis}' updated!`)
    res.status(200).json({ message: 'Berhasil melengkapi profile siswa!', student: student.toObject({ getters: true }) })

}

exports.getStudentById = getStudentById
exports.getStudentByNis = getStudentByNis
exports.getStudentByUserId = getStudentByUserId
exports.getStudentReportByIdAndClassId = getStudentReportByIdAndClassId
exports.getStudents = getStudents
exports.getStudentsByTeachingGroupId = getStudentsByTeachingGroupId
exports.createStudent = createStudent
exports.updateStudent = updateStudent