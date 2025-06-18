const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const User = require('../models/user');
const Branch = require('../models/branch');
const SubBranch = require('../models/subBranch');
const BranchYear = require('../models/branchYear');
const AcademicYear = require('../models/academicYear')
const Class = require('../models/class')
const Score = require('../models/score');   

const getBranchYears = async (req, res, next) => {
    const { populate } = req.query;

    let branchYears;

    try {
        if (populate === 'semesters') {
            branchYears = await BranchYear.find().populate('semesters');
        } else if (populate === 'branchId') {
            branchYears = await BranchYear.find()
                .populate({ path: 'branchId', select: 'name' })
                .populate({ path: 'academicYearId', select: 'name' })

            // Sort after population
            branchYears = branchYears.sort((a, b) => {
                const nameA = a.academicYearId?.name || "";
                const nameB = b.academicYearId?.name || "";
                return nameB.localeCompare(nameA); // Descending order
            });
        } else {
            branchYears = await BranchYear.find();
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get branchYears requested');
    res.json({ branchYears: branchYears.map(x => x.toObject({ getters: true })) });
};

const getBranchYearById = async (req, res, next) => {
    const branchYearId = req.params.branchYearId

    let identifiedBranchYears;
    try {
        identifiedBranchYears = await BranchYear.findById(branchYearId)
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log(`Get branchYearById of ID '${branchYearId}' requested`);
    res.json({ branchYear: identifiedBranchYears.toObject({ getters: true }) });
};

const getBranchYearByAcademicYearIdAndBranchId = async (req, res, next) => {
    const { academicYearId, branchId } = req.params;

    let branchYear;

    try {
        branchYear = await BranchYear.findOne({ academicYearId, branchId })
            .populate({ path: 'branchId', select: 'name' })
            .populate({ path: 'academicYearId', select: ['name', 'isActive'] })
            .populate({ path: 'classes' });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    if (!branchYear) {
        return next(new HttpError('Tahun ajaran tidak ditemukan!', 404));
    }

    console.log('Get getBranchYearByAcademicYearIdAndBranchId requested');
    res.json({ branchYear: branchYear.toObject({ getters: true }) });
};

const getBranchYearsByBranchId = async (req, res, next) => {
    const branchId = req.params.branchId;

    let branchYears;

    try {
        branchYears = await BranchYear.find({ branchId })
            .populate({ path: 'branchId', select: 'name' })
            .populate({ path: 'academicYearId', select: ['name', 'isActive', 'munaqasyahStatus'] })
            .populate({ path: 'teachingGroups' })

        branchYears = branchYears.sort((a, b) => {
            const nameA = a.academicYearId?.name || "";
            const nameB = b.academicYearId?.name || "";
            return nameB.localeCompare(nameA);
        });

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get branchYears requested');
    res.json({ branchYears: branchYears.map(x => x.toObject({ getters: true })) });
};


const registerYearToBranch = async (req, res, next) => {
    const { name, academicYearId, branchId } = req.body;

    // Finding relevant subbranch and academic year
    let existingAcademicYear;
    let existingBranch;
    try {
        existingAcademicYear = await AcademicYear.findById(academicYearId)
        existingBranch = await Branch.findById(branchId)
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!existingAcademicYear) {
        return next(new HttpError('Tahun ajaran tidak ditemukan!', 500));
    }
    if (!existingBranch) {
        return next(new HttpError('Kelompok ajaran tidak ditemukan!', 500));
    }

    // checking exsisting branchYear document
    let existingBranchYear;
    try {
        existingBranchYear = await BranchYear.findOne({ academicYearId, branchId })
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (existingBranchYear) {
        return next(new HttpError('Tahun ajaran sudah terdaftar untuk Kelompok ini!', 500));
    }


    const createdBranchYear = new BranchYear({
        name,
        academicYearId,
        branchId,
        isActive: false,
        munaqasyahStatus: "notStarted",
        teachingGroups: []
    })

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction()
        await createdBranchYear.save({ session: sess });
        existingBranch.branchYears.push(createdBranchYear);
        existingAcademicYear.branchYears.push(createdBranchYear);
        await existingBranch.save({ session: sess });
        await existingAcademicYear.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menambahkan tahun ajaran!', 500);
        return next(error);
    }

    res.status(202).json({ message: `Berhasil menambahkan tahun ajaran!`, branchYear: createdBranchYear });

}

const deleteBranchYear = async (req, res, next) => {
    const { branchYearId } = req.body;

    // Find the branchYear to delete
    let existingBranchYear;
    try {
        existingBranchYear = await BranchYear.findById(branchYearId).populate('branchId').populate('academicYearId');
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error while finding active year!', 500));
    }

    if (!existingBranchYear) {
        return next(new HttpError('Branch year not found!', 404));
    }

    // Extract associated branch and academicYear
    const { branchId, academicYearId } = existingBranchYear;

    if (!branchId || !academicYearId) {
        return next(new HttpError('Associated branch or academicYear not found!', 500));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();

        // Remove references from branch and academicYear
        branchId.branchYears.pull(existingBranchYear);
        academicYearId.branchYears.pull(existingBranchYear);
        await branchId.save({ session: sess });
        await academicYearId.save({ session: sess });

        // Delete the branchYear
        await existingBranchYear.deleteOne({ session: sess });

        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        return next(new HttpError('Gagal menghapus tahun ajaran!', 500));
    }

    res.status(200).json({ message: 'Berhasil menghapus tahun ajaran!' });
};

// const updateBranchYear = async (req, res, next) => {
//     const { branchYearId, semesterTarget } = req.body;

//     let identifiedBranchYear;
//     try {
//         identifiedBranchYear = await BranchYear.findByIdAndUpdate(
//             branchYearId,
//             { semesterTarget },
//             { new: true, runValidators: true }
//         );

//     } catch (err) {
//         console.error(err);
//         const error = new HttpError('Something went wrong while updating the BranchYear.', 500);
//         return next(error);
//     }

//     if (!identifiedBranchYear) {
//         return next(new HttpError(`Could not find a BranchYear with ID '${branchYearId}'`, 404));
//     }

//     console.log(`BranchYear:  '${identifiedBranchYear.name}' updated!`)
//     res.status(200).json({ message: 'Berhasil mengaktifkan tahun ajaran!', branchYear: identifiedBranchYear.toObject({ getters: true }) });
// }

const activateBranchYear = async (req, res, next) => {
    const { branchYearId } = req.body;

    let identifiedBranchYear;
    try {
        // Fetch the BranchYear and populate the classes to check their isLocked status
        identifiedBranchYear = await BranchYear.findById(branchYearId).populate({
            path: 'teachingGroups',
            select: 'isLocked'
        });

        if (!identifiedBranchYear) {
            return next(new HttpError(`Could not find an BranchYear with ID '${branchYearId}'`, 404));
        }

        if (identifiedBranchYear.teachingGroups.length === 0) {
            return next(new HttpError('Tidak ada kelas yang terdaftar untuk tahun ajaran ini!', 400));
        }

        // Check if any class is not locked
        const hasUnlockedTeachingGroups = identifiedBranchYear.teachingGroups.some(tg => !tg.isLocked);

        if (hasUnlockedTeachingGroups) {
            return next(new HttpError('Semua KBM harus dikunci terlebih dahulu!', 400));
        }

        // Proceed with updating the BranchYear if all classes are locked
        identifiedBranchYear = await BranchYear.findByIdAndUpdate(
            branchYearId,
            { isActive: true },
            { new: true, runValidators: true }
        );
    } catch (err) {
        console.error(err);
        return next(new HttpError('Something went wrong while updating the BranchYear.', 500));
    }

    console.log(`BranchYear: '${identifiedBranchYear.name}' updated!`);
    res.status(200).json({
        message: 'Berhasil mengaktifkan tahun ajaran!',
        branchYear: identifiedBranchYear.toObject({ getters: true })
    });
};

const deactivateBranchYear = async (req, res, next) => {
    const { branchYearId } = req.body;

    let identifiedBranchYear;
    try {
        // Fetch the BranchYear and populate the classes to check their isLocked status
        identifiedBranchYear = await BranchYear.findByIdAndUpdate(
            branchYearId,
            { isActive: false },
            { new: true, runValidators: true }
        );

        if (!identifiedBranchYear) {
            return next(new HttpError(`Could not find an BranchYear with ID '${branchYearId}'`, 404));
        }

    } catch (err) {
        console.error(err);
        return next(new HttpError('Something went wrong while updating the BranchYear.', 500));
    }

    console.log(`BranchYear: '${identifiedBranchYear.name}' updated!`);
    res.status(200).json({
        message: 'Berhasil menonaktifkan tahun ajaran!',
        branchYear: identifiedBranchYear.toObject({ getters: true })
    });
};

const patchBranchYearMunaqasyahStatus = async (req, res, next) => {
    const { branchYearId, action } = req.body;

    let identifiedBranchYear;
    try {
        // Fetch the BranchYear with teachingGroups and their subBranches
        identifiedBranchYear = await BranchYear.findById(branchYearId).populate({
            path: 'teachingGroups',
            populate: { path: 'subBranches' }
        });

        if (!identifiedBranchYear) {
            return next(new HttpError(`Could not find an BranchYear with ID '${branchYearId}'`, 404));
        }

        if (identifiedBranchYear.isActive === false) {
            return next(new HttpError(`Tahun ajaran nonaktif!`, 404));
        }

        // Collect all subBranches from all teachingGroups
        const allSubBranches = identifiedBranchYear.teachingGroups
            .flatMap(tg => tg.subBranches || []);

        // Remove duplicates (by _id)
        const uniqueSubBranches = Array.from(
            new Map(allSubBranches.map(sb => [sb._id.toString(), sb])).values()
        );

        // Check if any subBranch has munaqasyahStatus === 'inProgress'
        const hasInProgress = uniqueSubBranches.some(sb => sb.munaqasyahStatus === 'inProgress');
        if (hasInProgress) {
            return next(new HttpError('Terdapat kelompok yang masih munaqosah!', 400));
        }

        // All clear, update munaqasyahStatus
        identifiedBranchYear = await BranchYear.findByIdAndUpdate(
            branchYearId,
            { munaqasyahStatus: action },
            { new: true, runValidators: true }
        );

    } catch (err) {
        console.error(err);
        return next(new HttpError('Something went wrong while updating the BranchYear.', 500));
    }

    console.log(`BranchYear: '${identifiedBranchYear.name}' updated!`);
    res.status(200).json({
        message: 'Berhasil mengupdate status munaqosah tahun ajaran!',
        branchYear: identifiedBranchYear.toObject({ getters: true })
    });
};


const patchSubBranchMunaqasyahStatus = async (req, res, next) => {
    const branchYearId = req.params.branchYearId;
    const { munaqasyahStatus, subBranchId } = req.body;

    let existingBranchYear;
    let subBranch;
    try {
        // Fetch the branchYear with teachingGroups, classes, and students
        existingBranchYear = await BranchYear.findById(branchYearId)
            .populate({
                path: 'teachingGroups',
                populate: [
                    { path: 'classes', populate: { path: 'students' } },
                    { path: 'subBranches' }
                ]
            });

        if (!existingBranchYear) {
            return next(new HttpError("Tahun Ajaran Desa tidak ditemukan!", 404));
        }

        // Check munaqasyahStatus of branchYear
        if (existingBranchYear.munaqasyahStatus !== 'inProgress') {
            return next(new HttpError("Munaqasyah Desa belum dimulai!", 400));
        }

        // Fetch the subBranch
        subBranch = await SubBranch.findById(subBranchId);
        if (!subBranch) {
            return next(new HttpError("SubBranch tidak ditemukan!", 404));
        }

        if (subBranch.munaqasyahStatus === 'notStarted') {
            // Find all teachingGroups in this branchYear that include this subBranch
            const relevantTeachingGroups = existingBranchYear.teachingGroups.filter(tg =>
                tg.subBranches && tg.subBranches.some(sb => sb && sb._id.toString() === subBranchId)
            );

            // For each relevant teachingGroup, get all students in its classes
            const scoreEntries = relevantTeachingGroups.flatMap(tg =>
                (tg.classes || []).flatMap(classObj =>
                    (classObj.students || []).map(student => ({
                        userId: student.userId,
                        studentId: student._id,
                        studentNis: student.nis,
                        branchYearId: branchYearId,
                        subBranchId: subBranchId,
                        teachingGroupId: tg._id,
                        classId: classObj._id,
                        isBeingScored: "false",
                        reciting: { score: 0, examinerUserId: null },
                        writing: { score: 0, examinerUserId: null },
                        quranTafsir: { score: 0, examinerUserId: null },
                        hadithTafsir: { score: 0, examinerUserId: null },
                        practice: { score: 0, examinerUserId: null },
                        moralManner: { score: 0, examinerUserId: null },
                        memorizingSurah: { score: 0, examinerUserId: null },
                        memorizingHadith: { score: 0, examinerUserId: null },
                        memorizingDua: { score: 0, examinerUserId: null },
                        memorizingBeautifulName: { score: 0, examinerUserId: null },
                        knowledge: { score: 0, examinerUserId: null },
                        independence: { score: 0, examinerUserId: null }
                    })))
            );
            if (scoreEntries.length > 0) {
                await Score.insertMany(scoreEntries);
            }
        }

        // Update the subBranch's munaqasyahStatus
        subBranch.munaqasyahStatus = munaqasyahStatus;
        await subBranch.save();

        console.log(`Started munaqosyah for subBranch with id ${subBranchId}`);
        res.json({
            message: "Munaqosah Kelompok dimulai!",
            branchYear: existingBranchYear.toObject({ getters: true })
        });

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }
};


exports.getBranchYearById = getBranchYearById
exports.getBranchYearByAcademicYearIdAndBranchId = getBranchYearByAcademicYearIdAndBranchId

exports.getBranchYears = getBranchYears
exports.getBranchYearsByBranchId = getBranchYearsByBranchId
exports.registerYearToBranch = registerYearToBranch
exports.deleteBranchYear = deleteBranchYear
// exports.updateBranchYear = updateBranchYear
exports.activateBranchYear = activateBranchYear
exports.deactivateBranchYear = deactivateBranchYear

exports.patchBranchYearMunaqasyahStatus = patchBranchYearMunaqasyahStatus
exports.patchSubBranchMunaqasyahStatus = patchSubBranchMunaqasyahStatus