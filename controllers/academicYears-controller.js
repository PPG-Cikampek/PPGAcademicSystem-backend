const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const User = require('../models/user');
const Branch = require('../models/branch');
const TeachingGroup = require('../models/teachingGroup');
const AcademicYear = require('../models/academicYear')
const Class = require('../models/class')
const TeachingGroupYear = require('../models/teachingGroupYear')

const getAcademicYears = async (req, res, next) => {
    const { populate } = req.query; // Extract the 'populate' query parameter
    let academicYears;

    try {
        // Conditionally apply populate based on the query parameter
        if (populate) {
            academicYears = await AcademicYear.find()
                .populate({
                    path: 'teachingGroupYears',
                    populate: { path: 'teachingGroupId', select: 'name' },
                    // populate: { path: 'classes', select: 'name' }
                })
                .sort({ name: -1 });
        } else {
            academicYears = await AcademicYear.find().sort({ name: -1 });
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get academicYears requested');
    res.json({ academicYears: academicYears.map(x => x.toObject({ getters: true })) });
};

const getAcademicYearById = async (req, res, next) => {
    const academicYearId = req.params.academicYearId;

    let identifiedAcademicYear
    try {
        identifiedAcademicYear = await AcademicYear.findById(academicYearId)

        if (!identifiedAcademicYear) {
            return next(new HttpError(`Academic Year with ID ${academicYearId} not found!`, 404));
        }

    } catch (error) {
        console.error(error);
        return next(new HttpError('Internal server error occurred!', 500));
    }

    console.log('updateAcademicYearById requested')
    res.status(200).json({ academicYear: identifiedAcademicYear.toObject({ getters: true }) });
};

const getActiveAcademicYear = async (req, res, next) => {
    let activeAcademicYear;
    try {
        activeAcademicYear = await AcademicYear.findOne({ isActive: true })
        if (!activeAcademicYear) {
            return next(new HttpError('Tidak ada tahun ajaran aktif!', 404));
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError('Internal server error!', 500));
    }

    console.log('Get Active Academic Year requested')

    res.json({ academicYear: activeAcademicYear.toObject({ getters: true }) });
};



const createAcademicYear = async (req, res, next) => {
    const { name } = req.body;

    if (!name.match(/^\d{4}[12]$/)) {
        return next(new HttpError('Nama tahun ajaran harus berupa YYYY1 atau YYYY2!', 400));
    }

    let existingAcademicYear;
    try {
        existingAcademicYear = await AcademicYear.findOne({ name })
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (existingAcademicYear) {
        return next(new HttpError('Tahun ajaran sudah ada!', 500));
    }

    const createdAcademicYear = new AcademicYear({
        name,
        isActive: false,
        teachingGroupYears: []
    })

    try {
        await createdAcademicYear.save()
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal membuat tahun ajaran!', 500);
        return next(error);
    }

    res.status(202).json({ message: `Berhasil membuat tahun ajaran ${name}!`, academicYear: createdAcademicYear });
}

const activateAcademicYear = async (req, res, next) => {
    const id = req.params.academicYearId;

    console.log(id);
    // Check if the provided ID exists
    let targetAcademicYear;
    try {
        targetAcademicYear = await AcademicYear.findById(id).populate('teachingGroupYears');
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!targetAcademicYear) {
        return next(new HttpError('Tahun ajaran tidak ditemukan!', 404));
    }

    // Update all documents to set isActive to false
    try {
        // Set isActive = false for all academic years
        await AcademicYear.updateMany({}, { $set: { isActive: false } });

        // Set isActive = false for all teachingGroupYears in every academic year
        await TeachingGroupYear.updateMany({}, { $set: { isActive: false } });

    } catch (err) {
        console.log(err);
        return next(new HttpError('Gagal mengubah status tahun ajaran!', 500));
    }

    // Set the target academic year's isActive to true
    targetAcademicYear.isActive = true;

    try {
        await targetAcademicYear.save();
    } catch (err) {
        console.log(err);
        return next(new HttpError('Gagal menyimpan perubahan tahun ajaran!', 500));
    }

    console.log(`AcademicYear status with ID ${id} changed to active!`)
    res.status(200).json({
        message: `Berhasil mengubah status aktif tahun ajaran ${targetAcademicYear.name}!`,
        academicYear: targetAcademicYear.toObject({ getters: true })
    });
};

const updateAcademicYear = async (req, res, next) => {
    const { name } = req.body;
    const academicYearId = req.params.academicYearId;

    if (!name.match(/^\d{4}[12]$/)) {
        return next(new HttpError('Nama tahun ajaran harus berupa YYYY1 atau YYYY2!', 400));
    }

    let academicYear;
    try {
        academicYear = await AcademicYear.findByIdAndUpdate(
            academicYearId,
            { name },
            { new: true, runValidators: true }
        );
    } catch (err) {
        console.error(err);
        const error = new HttpError('Something went wrong while updating the academicYear.', 500);
        return next(error);
    }

    if (!academicYear) {
        return next(new HttpError(`Could not find a academicYear with ID '${academicYearId}'`, 404));
    }

    if (academicYear.teachingGroupYears.length > 0) {
        return next(new HttpError('Gagal menghapus, terdapat Kelompok terdaftar!', 400));
    }

    console.log(`academicYear with ID'${academicYear._id}' updated!`)
    res.status(200).json({ message: 'Berhasil mengubah kelompok ajar!', academicYear: academicYear.toObject({ getters: true }) });
}

const startAcademicYearMunaqasyah = async (req, res, next) => {
    const academicYearId = req.params.academicYearId;
    const { isMunaqasyahActive } = req.body;

    let existingAcademicYear;
    try {
        existingAcademicYear = await AcademicYear.findOneAndUpdate(
            { _id: academicYearId },
            { isMunaqasyahActive },
            { new: true }
        );

        if (!existingAcademicYear) {
            return next(new HttpError("Tahun Ajaran tidak ditemukan!", 404));
        }

        console.log(`Started munaqosyah for AcademicYearwith id ${academicYearId}`);
        res.json({
            message: "Munaqosah dimulai!",
            question: existingAcademicYear.toObject({ getters: true })
        });

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }
};

const deleteAcademicYear = async (req, res, next) => {
    const { academicYearId } = req.body;

    let academicYear;
    try {
        academicYear = await AcademicYear.findById(academicYearId);
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error while finding academicYear!', 500));
    }

    if (!academicYear) {
        return next(new HttpError('academicYear not found!', 404));
    }

    if (academicYear.teachingGroupYears.length > 0) {
        return next(new HttpError('Gagal menghapus, terdapat Kelompok terdaftar!', 400));
    }

    try {
        await academicYear.deleteOne();
    } catch (err) {
        console.log(err);
        return next(new HttpError('Deleting academicYear failed!', 500));
    }

    res.status(200).json({ message: 'Berhasil menghapus Tahun Ajaran!' });
};

exports.getAcademicYearById = getAcademicYearById;
exports.getAcademicYears = getAcademicYears;
exports.getActiveAcademicYear = getActiveAcademicYear

exports.createAcademicYear = createAcademicYear;
exports.activateAcademicYear = activateAcademicYear;

exports.updateAcademicYear = updateAcademicYear
exports.startAcademicYearMunaqasyah = startAcademicYearMunaqasyah
exports.deleteAcademicYear = deleteAcademicYear

