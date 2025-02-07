const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const User = require('../models/user');
const Branch = require('../models/branch');
const TeachingGroup = require('../models/teachingGroup');
const AcademicYear = require('../models/academicYear')
const Class = require('../models/class')
const TeachingGroupYear = require('../models/teachingGroupYear')
const Teacher = require('../models/teacher')

const getTeachers = async (req, res, next) => {
    let teachers;
    try {
        teachers = await Teacher.find()
            .populate({ path: 'userId', select: 'teachingGroupId', populate: { path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } } });

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get teachers requested');
    res.json({ teachers: teachers.map(x => x.toObject({ getters: true })) });
}

const getTeachersByTeachingGroupId = async (req, res, next) => {
    const teachingGroupId = req.params.teachingGroupId;
    let teachers;
    try {
        // 1. Find matching users
        const users = await User.find({ teachingGroupId: teachingGroupId });

        // 2. Extract User IDs
        const userIds = users.map(user => user._id);

        // 3. Find teachers based on user IDs
        teachers = await Teacher.find({ userId: { $in: userIds } })
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
            .populate({ path: 'classIds', select: 'name' })
            .sort({ nis: 1 });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get teachers requested');
    res.json({ teachers: teachers.map(x => x.toObject({ getters: true })) });
}

const getTeacherById = async (req, res, next) => {
    const teacherId = req.params.teacherId;

    let teacher;

    try {
        teacher = await Teacher.findById(teacherId)
            .populate({ path: 'userId', select: 'teachingGroupId', populate: { path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } } })
            .populate({
                path: 'classIds',
                populate: { path: 'teachingGroupYearId' }
            })
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get teacher requested');
    res.json({ teacher: teacher.toObject({ getters: true }) });
}

const getTeacherByUserId = async (req, res, next) => {
    const userId = req.params.userId;

    let teacher;

    try {
        teacher = await Teacher.findOne({ userId })
            .populate({ path: 'userId', select: 'teachingGroupId', populate: { path: 'teachingGroupId', select: 'name', populate: { path: 'branchId', select: 'name' } } })
            .populate({
                path: 'classIds',
                populate: [
                    { path: 'teachingGroupYearId', populate: { path: 'academicYearId', select: ['name', 'isActive'] } },
                    { path: 'attendances', select: 'forDate' }
                ]
            });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log(`Get teacher by userId ${userId} requested`);
    res.json({ teacher: teacher.toObject({ getters: true }) });
}

const updateTeacher = async (req, res, next) => {
    const { name, phone, position, dateOfBirth, gender, address, teacherId, userId } = req.body;

    let teacher;
    try {
        const updateData = { name, phone, position, dateOfBirth, gender, address, isProfileComplete: true };
        if (req.file) {
            updateData.image = req.file.path.replace(/\\/g, '/');
            updateData.originalImagePath = req.file.path;
        }

        if (teacherId) {
            teacher = await Teacher.findByIdAndUpdate(
                teacherId,
                updateData,
                { new: true, runValidators: true }
            );
        } else {
            teacher = await Teacher.findOneAndUpdate(
                { userId },
                updateData,
                { new: true, runValidators: true }
            );
        }

        if (teacher) {
            await User.findByIdAndUpdate(
                teacher.userId,
                { image: req?.file?.path, name: teacher.name },
                { new: true, runValidators: true }
            );
        }

    } catch (err) {
        console.error(err);
        const error = new HttpError('Something went wrong while updating the teacher.', 500);
        return next(error);
    }

    if (!teacher) {
        return next(new HttpError(`Could not find a teacher with ID '${teacherId}'`, 404));
    }

    console.log(`teacher with nis '${teacher.nig}' updated!`);
    res.status(200).json({ message: 'Berhasil melengkapi profile!', teacher: teacher.toObject({ getters: true }) });
}


exports.getTeachersByTeachingGroupId = getTeachersByTeachingGroupId
exports.getTeacherByUserId = getTeacherByUserId
exports.getTeacherById = getTeacherById
exports.getTeachers = getTeachers
exports.updateTeacher = updateTeacher