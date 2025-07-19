const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const TeachingGroup = require('../models/teachingGroup');
const TeachingGroupYear = require('../models/teachingGroupYear');
const SubBranch = require('../models/subBranch');
const BranchYear = require('../models/branchYear');
const Class = require('../models/class');

const getTeachingGroups = async (req, res, next) => {
    let teachingGroups;
    try {
        teachingGroups = await TeachingGroup.find().populate('branchYearId').populate('teacherId');
    } catch (err) {
        const error = new HttpError('Fetching teaching groups failed, please try again later.', 500);
        return next(error);
    }

    res.json({ teachingGroups: teachingGroups.map(group => group.toObject({ getters: true })) });
}

const getTeachingGroupById = async (req, res, next) => {
    const teachingGroupId = req.params.teachingGroupId;
    let identifiedTeachingGroup;
    try {
        identifiedTeachingGroup = await TeachingGroup.findById(teachingGroupId)
            .populate('classes')
            .populate('subBranches')
            .populate({ path: 'branchYearId', select: ['academicYearId', 'isActive'], populate: { path: 'academicYearId', select: 'isActive' } })
    } catch (err) {
        const error = new HttpError('Fetching teaching groups failed, please try again later.', 500);
        return next(error);
    }

    res.json({ identifiedTeachingGroup: identifiedTeachingGroup.toObject({ getters: true }) });
}

const createTeachingGroup = async (req, res, next) => {
    const { name, address, branchYearId } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const createdTeachingGroup = new TeachingGroup({
            name,
            address,
            branchYearId,
        });
        await createdTeachingGroup.save({ session });
        await mongoose.model('BranchYear').findByIdAndUpdate(
            branchYearId,
            { $push: { teachingGroups: createdTeachingGroup._id } },
            { new: true, session }
        );
        await session.commitTransaction();
        session.endSession();
        res.status(201).json({ message: 'Berhasil Menambahkan KBM!', teachingGroup: createdTeachingGroup.toObject({ getters: true }) });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error(err);
        const error = new HttpError('Creating teaching group failed, please try again.', 500);
        return next(error);
    }
}

const registerSubBranchtoTeachingGroup = async (req, res, next) => {
    const { name, teachingGroupId, subBranchId } = req.body;

    // Finding relevant subbranch and academic year
    let existingTeachingGroup;
    let existingSubBranch;
    try {
        existingTeachingGroup = await TeachingGroup.findById(teachingGroupId)
        existingSubBranch = await SubBranch.findById(subBranchId)
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!existingTeachingGroup) {
        return next(new HttpError('KBM tidak ditemukan!', 500));
    }
    if (!existingSubBranch) {
        return next(new HttpError('Kelompok tidak ditemukan!', 500));
    }

    const isSubBranchRegistered = existingTeachingGroup.subBranches.some(subBranch => subBranch.toString() === subBranchId);

    if (isSubBranchRegistered) {
        return next(new HttpError('Kelompok sudah terdaftar di KBM ini!', 500));
    }


    try {
        const sess = await mongoose.startSession();
        sess.startTransaction()
        // await createdTeachingGroupYear.save({ session: sess });
        existingSubBranch.teachingGroups.push(existingTeachingGroup);
        existingTeachingGroup.subBranches.push(existingSubBranch);
        await existingSubBranch.save({ session: sess });
        await existingTeachingGroup.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal mendaftarkan kelompok!', 500);
        return next(error);
    }

    console.log(`A subBranch has been registered to teachingGroup!`)
    res.status(202).json({ message: `Berhasil mendaftarkan kelompok!`, class: existingTeachingGroup });
}

const lockTeachingGroupById = async (req, res, next) => {
    const { teachingGroupId } = req.body;

    let identifiedTeachingGroup;
    try {
        identifiedTeachingGroup = await TeachingGroup.findById(teachingGroupId)
            .populate('subBranches')
            .populate('classes');

        if (!identifiedTeachingGroup) {
            return next(new HttpError(`Could not find an Teaching Group with ID '${teachingGroupId}'`, 404));
        }

        // Check branchYearId.isActive
        const branchYear = await BranchYear.findById(identifiedTeachingGroup.branchYearId);
        if (!branchYear) {
            return next(new HttpError('BranchYear tidak ditemukan!', 404));
        }
        if (branchYear.isActive) {
            return next(new HttpError('Tidak dapat mengunci KBM pada tahun ajaran yang aktif!', 400));
        }

        if (identifiedTeachingGroup.subBranches.length === 0) {
            return next(new HttpError('Kelas minimal harus ada 1 kelompok!', 400));
        }

        if (identifiedTeachingGroup.classes.length === 0) {
            return next(new HttpError('Kelas minimal harus ada 1 kelas!', 400));
        }

        // Check if all classes are locked
        const allClassesLocked = identifiedTeachingGroup.classes.every(cls => cls.isLocked === true);
        if (!allClassesLocked) {
            return next(new HttpError('Semua kelas di dalam KBM harus dikunci terlebih dahulu!', 400));
        }

        identifiedTeachingGroup = await TeachingGroup.findByIdAndUpdate(
            teachingGroupId,
            { isLocked: true },
            { new: true, runValidators: true }
        );

    } catch (err) {
        console.error(err);
        return next(new HttpError('Gagal mengunci kelas!', 500));
    }

    console.log(`Locked teaching group with id ${teachingGroupId}`);
    res.json({
        message: 'Berhasil mengunci KBM!', teachingGroup: identifiedTeachingGroup.toObject({ getters: true })
    });
}

const unlockTeachingGroupById = async (req, res, next) => {
    const { teachingGroupId } = req.body;

    let identifiedTeachingGroup;
    try {
        identifiedTeachingGroup = await TeachingGroup.findById(teachingGroupId);

        if (!identifiedTeachingGroup) {
            return next(new HttpError(`Could not find an Teaching Group with ID '${teachingGroupId}'`, 404));
        }

        // Check branchYearId.isActive
        const branchYear = await BranchYear.findById(identifiedTeachingGroup.branchYearId);
        if (!branchYear) {
            return next(new HttpError('BranchYear tidak ditemukan!', 404));
        }
        if (branchYear.isActive) {
            return next(new HttpError('Tidak dapat membuka KBM pada tahun ajaran yang aktif!', 400));
        }

        identifiedTeachingGroup = await TeachingGroup.findByIdAndUpdate(
            teachingGroupId,
            { isLocked: false },
            { new: true, runValidators: true }
        );

    } catch (err) {
        console.error(err);
        return next(new HttpError('Gagal membuka kelas!', 500));
    }

    console.log(`Unlocked teaching group with id ${teachingGroupId}`);
    res.json({ message: 'Berhasil membuka KBM!', teachingGroup: identifiedTeachingGroup.toObject({ getters: true }) });
}

const deleteTeachingGroup = async (req, res, next) => {
    const { teachingGroupId } = req.body;
    if (!teachingGroupId) {
        return next(new HttpError('teachingGroupId is required', 400));
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        // Find the teaching group
        const teachingGroup = await TeachingGroup.findById(teachingGroupId).session(session);
        if (!teachingGroup) {
            await session.abortTransaction();
            session.endSession();
            return next(new HttpError('Teaching group not found', 404));
        }

        // Check if subBranches is not empty
        if (teachingGroup.subBranches && teachingGroup.subBranches.length > 0) {
            await session.abortTransaction();
            session.endSession();
            return next(new HttpError('Terdapat Kelompok di KBM ini!', 400));
        }

        // Check if classes is not empty
        if (teachingGroup.classes && teachingGroup.classes.length > 0) {
            await session.abortTransaction();
            session.endSession();
            return next(new HttpError('Terdapat Kelas di KBM ini!', 400));
        }

        // Remove reference from BranchYear
        await BranchYear.findByIdAndUpdate(
            teachingGroup.branchYearId,
            { $pull: { teachingGroups: teachingGroup._id } },
            { session }
        );

        // Delete the teaching group
        await TeachingGroup.findByIdAndDelete(teachingGroupId, { session });

        await session.commitTransaction();
        session.endSession();
        res.status(200).json({ message: 'Berhasil menghapus KBM!' });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        console.error(err);
        return next(new HttpError('Gagal menghapus KBM!', 500));
    }
}

const removeSubBranchFromTeachingGroup = async (req, res, next) => {
    const { teachingGroupId, subBranchId } = req.body;

    // Find relevant teaching group and sub-branch
    let existingTeachingGroup;
    let existingSubBranch;
    try {
        existingTeachingGroup = await TeachingGroup.findById(teachingGroupId);
        existingSubBranch = await SubBranch.findById(subBranchId);
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!existingTeachingGroup) {
        return next(new HttpError('KBM tidak ditemukan!', 404));
    }
    if (!existingSubBranch) {
        return next(new HttpError('Kelompok tidak ditemukan!', 404));
    }

    const normalizedSubBranchId = subBranchId.toString();
    const normalizedTeachingGroupId = teachingGroupId.toString();

    // Check if the sub-branch is associated with the teaching group
    const subBranchIndex = existingTeachingGroup.subBranches.findIndex(
        sb => sb.toString() === normalizedSubBranchId
    );
    const teachingGroupIndex = existingSubBranch.teachingGroups.findIndex(
        tg => tg.toString() === normalizedTeachingGroupId
    );

    if (subBranchIndex === -1 || teachingGroupIndex === -1) {
        return next(new HttpError('Kelompok tidak terdaftar di KBM ini!', 400));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();

        // Remove sub-branch from teaching group
        existingTeachingGroup.subBranches.splice(subBranchIndex, 1);
        await existingTeachingGroup.save({ session: sess });

        // Remove teaching group from sub-branch
        existingSubBranch.teachingGroups.splice(teachingGroupIndex, 1);
        await existingSubBranch.save({ session: sess });

        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menghapus kelompok dari KBM!', 500);
        return next(error);
    }

    res.status(200).json({ message: `Berhasil menghapus kelompok dari KBM!`, teachingGroup: existingTeachingGroup });
};

const removeClassFromTeachingGroup = async (req, res, next) => {
    const { teachingGroupId, classId } = req.body;

    // Find relevant teaching group and class
    let existingTeachingGroup;
    let existingClass;
    try {
        existingTeachingGroup = await TeachingGroup.findById(teachingGroupId);
        existingClass = await Class.findById(classId);
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!existingTeachingGroup) {
        return next(new HttpError('KBM tidak ditemukan!', 404));
    }
    if (!existingClass) {
        return next(new HttpError('Kelas tidak ditemukan!', 404));
    }

    // Check if class has students or teachers
    if ((existingClass.students && existingClass.students.length > 0) || (existingClass.teachers && existingClass.teachers.length > 0)) {
        return next(new HttpError('Kelas masih memiliki siswa atau guru!', 400));
    }

    const normalizedClassId = classId.toString();
    const normalizedTeachingGroupId = teachingGroupId.toString();

    // Check if the class is associated with the teaching group
    const classIndex = existingTeachingGroup.classes.findIndex(
        c => c.toString() === normalizedClassId
    );
    if (classIndex === -1 || existingClass.teachingGroupId.toString() !== normalizedTeachingGroupId) {
        return next(new HttpError('Kelas tidak terdaftar di KBM ini!', 400));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();

        // Remove class from teaching group
        existingTeachingGroup.classes.splice(classIndex, 1);
        await existingTeachingGroup.save({ session: sess });

        // Delete the class document
        await Class.findByIdAndDelete(classId, { session: sess });

        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menghapus kelas dari KBM!', 500);
        return next(error);
    }

    res.status(200).json({ message: `Berhasil menghapus kelas dari KBM!`, teachingGroup: existingTeachingGroup });
};



exports.getTeachingGroups = getTeachingGroups;
exports.getTeachingGroupById = getTeachingGroupById;
exports.createTeachingGroup = createTeachingGroup;
exports.registerSubBranchtoTeachingGroup = registerSubBranchtoTeachingGroup;
exports.lockTeachingGroupById = lockTeachingGroupById;
exports.unlockTeachingGroupById = unlockTeachingGroupById;
exports.deleteTeachingGroup = deleteTeachingGroup;
exports.removeSubBranchFromTeachingGroup = removeSubBranchFromTeachingGroup;
exports.removeClassFromTeachingGroup = removeClassFromTeachingGroup;