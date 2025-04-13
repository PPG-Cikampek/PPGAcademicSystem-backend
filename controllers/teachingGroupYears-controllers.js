const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const User = require('../models/user');
const Branch = require('../models/branch');
const TeachingGroup = require('../models/teachingGroup');
const AcademicYear = require('../models/academicYear')
const Class = require('../models/class')
const TeachingGroupYear = require('../models/teachingGroupYear')

const getTeachingGroupYears = async (req, res, next) => {
    const { populate } = req.query;

    let teachingGroupYears;

    try {
        if (populate === 'semesters') {
            teachingGroupYears = await TeachingGroupYear.find().populate('semesters');
        } else if (populate === 'teachingGroupId') {
            teachingGroupYears = await TeachingGroupYear.find()
                .populate({ path: 'teachingGroupId', select: 'name' })
                .populate({ path: 'academicYearId', select: 'name' });

            // Sort after population
            teachingGroupYears = teachingGroupYears.sort((a, b) => {
                const nameA = a.academicYearId?.name || "";
                const nameB = b.academicYearId?.name || "";
                return nameB.localeCompare(nameA); // Descending order
            });
        } else {
            teachingGroupYears = await TeachingGroupYear.find();
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get teachingGroupYears requested');
    res.json({ teachingGroupYears: teachingGroupYears.map(x => x.toObject({ getters: true })) });
};

const getTeachingGroupYearById = async (req, res, next) => {
    const teachingGroupYearId = req.params.teachingGroupYearId

    let identifiedTeachingGroupYears;
    try {
        identifiedTeachingGroupYears = await TeachingGroupYear.findById(teachingGroupYearId)
        .populate({ path: 'classes', select: ['name', 'isLocked'] });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log(`Get teachingGroupYearById of ID '${teachingGroupYearId}' requested`);
    res.json({ teachingGroupYear: identifiedTeachingGroupYears.toObject({ getters: true }) });
};

const getTeachingGroupYearByAcademicYearIdAndTeachingGroupId = async (req, res, next) => {
    const { academicYearId, teachingGroupId } = req.params;

    let teachingGroupYear;

    try {
        teachingGroupYear = await TeachingGroupYear.findOne({ academicYearId, teachingGroupId })
            .populate({ path: 'teachingGroupId', select: 'name' })
            .populate({ path: 'academicYearId', select: ['name', 'isActive'] })
            .populate({ path: 'classes' });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    if (!teachingGroupYear) {
        return next(new HttpError('Tahun ajaran tidak ditemukan!', 404));
    }

    console.log('Get getTeachingGroupYearByAcademicYearIdAndTeachingGroupId requested');
    res.json({ teachingGroupYear: teachingGroupYear.toObject({ getters: true }) });
};

const getTeachingGroupYearsByTeachingGroupId = async (req, res, next) => {
    const teachingGroupId = req.params.teachingGroupId;

    let teachingGroupYears;

    try {
        teachingGroupYears = await TeachingGroupYear.find({ teachingGroupId })
            .populate({ path: 'teachingGroupId', select: 'name' })
            .populate({ path: 'academicYearId', select: ['name', 'isActive', 'isMunaqasyahActive'] })
            .populate({ path: 'classes' })

        teachingGroupYears = teachingGroupYears.sort((a, b) => {
            const nameA = a.academicYearId?.name || "";
            const nameB = b.academicYearId?.name || "";
            return nameB.localeCompare(nameA);
        });

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get teachingGroupYears requested');
    res.json({ teachingGroupYears: teachingGroupYears.map(x => x.toObject({ getters: true })) });
};


const registerYearToTeachingGroup = async (req, res, next) => {
    const { name, academicYearId, teachingGroupId } = req.body;

    // Finding relevant subbranch and academic year
    let existingAcademicYear;
    let existingTeachingGroup;
    try {
        existingAcademicYear = await AcademicYear.findById(academicYearId)
        existingTeachingGroup = await TeachingGroup.findById(teachingGroupId)
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!existingAcademicYear) {
        return next(new HttpError('Tahun ajaran tidak ditemukan!', 500));
    }
    if (!existingTeachingGroup) {
        return next(new HttpError('Kelompok ajaran tidak ditemukan!', 500));
    }

    // checking exsisting teachingGroupYear document
    let existingTeachingGroupYear;
    try {
        existingTeachingGroupYear = await TeachingGroupYear.findOne({ academicYearId, teachingGroupId })
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (existingTeachingGroupYear) {
        return next(new HttpError('Tahun ajaran sudah terdaftar untuk Kelompok ini!', 500));
    }


    const createdTeachingGroupYear = new TeachingGroupYear({
        name,
        academicYearId,
        teachingGroupId,
        isActive: false,
        isMunaqasyahActive: false,
        classes: []
    })

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction()
        await createdTeachingGroupYear.save({ session: sess });
        existingTeachingGroup.teachingGroupYears.push(createdTeachingGroupYear);
        existingAcademicYear.teachingGroupYears.push(createdTeachingGroupYear);
        await existingTeachingGroup.save({ session: sess });
        await existingAcademicYear.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menambahkan tahun ajaran!', 500);
        return next(error);
    }

    res.status(202).json({ message: `Berhasil menambahkan tahun ajaran!`, teachingGroupYear: createdTeachingGroupYear });

}

const deleteTeachingGroupYear = async (req, res, next) => {
    const { teachingGroupYearId } = req.body;

    // Find the teachingGroupYear to delete
    let existingTeachingGroupYear;
    try {
        existingTeachingGroupYear = await TeachingGroupYear.findById(teachingGroupYearId).populate('teachingGroupId').populate('academicYearId');
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error while finding active year!', 500));
    }

    if (!existingTeachingGroupYear) {
        return next(new HttpError('Teaching Group year not found!', 404));
    }

    // Extract associated teachingGroup and academicYear
    const { teachingGroupId, academicYearId } = existingTeachingGroupYear;

    if (!teachingGroupId || !academicYearId) {
        return next(new HttpError('Associated teachingGroup or academicYear not found!', 500));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();

        // Remove references from teachingGroup and academicYear
        teachingGroupId.teachingGroupYears.pull(existingTeachingGroupYear);
        academicYearId.teachingGroupYears.pull(existingTeachingGroupYear);
        await teachingGroupId.save({ session: sess });
        await academicYearId.save({ session: sess });

        // Delete the teachingGroupYear
        await existingTeachingGroupYear.deleteOne({ session: sess });

        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        return next(new HttpError('Gagal menghapus tahun ajaran!', 500));
    }

    res.status(200).json({ message: 'Berhasil menghapus tahun ajaran!' });
};

// const updateTeachingGroupYear = async (req, res, next) => {
//     const { teachingGroupYearId, semesterTarget } = req.body;

//     let identifiedTeachingGroupYear;
//     try {
//         identifiedTeachingGroupYear = await TeachingGroupYear.findByIdAndUpdate(
//             teachingGroupYearId,
//             { semesterTarget },
//             { new: true, runValidators: true }
//         );

//     } catch (err) {
//         console.error(err);
//         const error = new HttpError('Something went wrong while updating the TeachingGroupYear.', 500);
//         return next(error);
//     }

//     if (!identifiedTeachingGroupYear) {
//         return next(new HttpError(`Could not find a TeachingGroupYear with ID '${teachingGroupYearId}'`, 404));
//     }

//     console.log(`TeachingGroupYear:  '${identifiedTeachingGroupYear.name}' updated!`)
//     res.status(200).json({ message: 'Berhasil mengaktifkan tahun ajaran!', teachingGroupYear: identifiedTeachingGroupYear.toObject({ getters: true }) });
// }

const activateTeachingGroupYear = async (req, res, next) => {
    const { teachingGroupYearId, semesterTarget } = req.body;

    let identifiedTeachingGroupYear;
    try {
        // Fetch the TeachingGroupYear and populate the classes to check their isLocked status
        identifiedTeachingGroupYear = await TeachingGroupYear.findById(teachingGroupYearId).populate({
            path: 'classes',
            select: 'isLocked'
        });

        if (!identifiedTeachingGroupYear) {
            return next(new HttpError(`Could not find an TeachingGroupYear with ID '${teachingGroupYearId}'`, 404));
        }

        if (identifiedTeachingGroupYear.classes.length === 0) {
            return next(new HttpError('Tidak ada kelas yang terdaftar untuk tahun ajaran ini!', 400));
        }

        // Check if any class is not locked
        const hasUnlockedClasses = identifiedTeachingGroupYear.classes.some(cls => !cls.isLocked);

        if (hasUnlockedClasses) {
            return next(new HttpError('Semua kelas harus dikunci terlebih dahulu.', 400));
        }

        // Proceed with updating the TeachingGroupYear if all classes are locked
        identifiedTeachingGroupYear = await TeachingGroupYear.findByIdAndUpdate(
            teachingGroupYearId,
            { semesterTarget, isActive: true },
            { new: true, runValidators: true }
        );
    } catch (err) {
        console.error(err);
        return next(new HttpError('Something went wrong while updating the TeachingGroupYear.', 500));
    }

    console.log(`TeachingGroupYear: '${identifiedTeachingGroupYear.name}' updated!`);
    res.status(200).json({ 
        message: 'Berhasil mengaktifkan tahun ajaran!', 
        teachingGroupYear: identifiedTeachingGroupYear.toObject({ getters: true }) 
    });
};

const deactivateTeachingGroupYear = async (req, res, next) => {
    const { teachingGroupYearId } = req.body;

    let identifiedTeachingGroupYear;
    try {
        // Fetch the TeachingGroupYear and populate the classes to check their isLocked status
        identifiedTeachingGroupYear = await TeachingGroupYear.findByIdAndUpdate(
            teachingGroupYearId,
            { isActive: false },
            { new: true, runValidators: true }
        );

        if (!identifiedTeachingGroupYear) {
            return next(new HttpError(`Could not find an TeachingGroupYear with ID '${teachingGroupYearId}'`, 404));
        }

    } catch (err) {
        console.error(err);
        return next(new HttpError('Something went wrong while updating the TeachingGroupYear.', 500));
    }

    console.log(`TeachingGroupYear: '${identifiedTeachingGroupYear.name}' updated!`);
    res.status(200).json({ 
        message: 'Berhasil menonaktifkan tahun ajaran!', 
        teachingGroupYear: identifiedTeachingGroupYear.toObject({ getters: true }) 
    });
};


exports.getTeachingGroupYearById = getTeachingGroupYearById 
exports.getTeachingGroupYearByAcademicYearIdAndTeachingGroupId = getTeachingGroupYearByAcademicYearIdAndTeachingGroupId

exports.getTeachingGroupYears = getTeachingGroupYears
exports.getTeachingGroupYearsByTeachingGroupId = getTeachingGroupYearsByTeachingGroupId
exports.registerYearToTeachingGroup = registerYearToTeachingGroup
exports.deleteTeachingGroupYear = deleteTeachingGroupYear
// exports.updateTeachingGroupYear = updateTeachingGroupYear
exports.activateTeachingGroupYear = activateTeachingGroupYear
exports.deactivateTeachingGroupYear = deactivateTeachingGroupYear