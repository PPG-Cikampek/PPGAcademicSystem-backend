const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const SubBranch = require('../models/subBranch');
const User = require('../models/user');
const Branch = require('../models/branch');
const TeachingGroup = require('../models/teachingGroup');

const getSubBranchById = async (req, res, next) => {
    const teachingGroupId = req.params.teachingGroupId;
    const { populate } = req.query;

    let identifiedTeachingGroup
    try {
        if (populate) {
            identifiedTeachingGroup = await TeachingGroup.findById(teachingGroupId)
                .populate({
                    path: 'teachingGroupYears',
                    select: 'classes',
                    populate: {
                        path: 'classes',
                        select: 'name'
                    }
                });
        } else {
            identifiedTeachingGroup = await TeachingGroup.findById(teachingGroupId)
                .populate({ path: 'branchId', select: 'name' });
        }

        if (!identifiedTeachingGroup) {
            return next(new HttpError(`TeachingGroup with ID ${teachingGroupId} not found!`, 404));
        }

    } catch (error) {
        console.error(error);
        return next(new HttpError('Internal server error occurred!', 500));
    }

    console.log('getSubBranchById requested')
    res.status(200).json({ teachingGroup: identifiedTeachingGroup.toObject({ getters: true }) });
};

const getBranchById = async (req, res, next) => {
    const branchId = req.params.branchId;
    const { populate } = req.query;


    let identifiedBranch
    try {
        if (populate) {
            identifiedBranch = await Branch.findById(branchId)
                .populate({
                    path: 'teachingGroups',
                    select: 'name',
                    populate: {
                        path: 'teachingGroupYears',
                        select: 'classes',
                        populate: {
                            path: 'classes',
                            select: 'name'
                        }
                    }
                });
        } else {
            identifiedBranch = await Branch.findById(branchId)
                .populate({ path: 'teachingGroups', select: 'name' });
        }

        if (!identifiedBranch) {
            return next(new HttpError(`TeachingGroup with ID ${branchId} not found!`, 404));
        }

    } catch (error) {
        console.error(error);
        return next(new HttpError('Internal server error occurred!', 500));
    }

    console.log('getSubBranchById requested')
    res.status(200).json({ branch: identifiedBranch.toObject({ getters: true }) });
};

const getSubBranchesByBranchById = async (req, res, next) => {
    const branchId = req.params.branchId;
    const { populate } = req.query;

    let subBranches;
    try {
        if (populate === 'true' || populate === 'branchId') {
            subBranches = await SubBranch.find({ branchId: branchId }).populate('branchId');
        } else {
            subBranches = await SubBranch.find({ branchId: branchId });
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError('Internal server error occurred!', 500));
    }

    if (!subBranches || subBranches.length === 0) {
        return next(new HttpError(`No sub-branches found for branch with ID ${branchId}`, 404));
    }

    res.status(200).json({ subBranches: subBranches.map(x => x.toObject({ getters: true })) });
}

const getBranches = async (req, res, next) => {
    const { populate } = req.query; // Extract the 'populate' query parameter
    let branches;

    try {
        // Conditionally apply populate based on the query parameter
        if (populate === 'true') {
            branches = await Branch.find().populate('subBranches');
        } else {
            branches = await Branch.find();
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get branches requested');
    res.json({ branches: branches.map(x => x.toObject({ getters: true })) });
};

const getSubBranches = async (req, res, next) => {
    const { populate } = req.query; // Extract the 'populate' query parameter
    let subBranches;

    try {
        // Conditionally apply populate based on the query parameter
        if (populate === 'branchId') {
            subBranches = await SubBranch.find().populate('branchId');
        } else if (populate === 'academicYears') {
            subBranches = await SubBranch.find().populate('academicYears');;
        } else {
            subBranches = await SubBranch.find();
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get subbranches requested');
    res.json({ subBranches: subBranches.map(x => x.toObject({ getters: true })) });
};


const createBranch = async (req, res, next) => {
    const { name, address } = req.body

    let existingBranch;
    try {
        existingBranch = await Branch.findOne({ name: name });
    } catch (err) {
        return next(new HttpError('Internal server error occurred!', 500));
    }

    if (existingBranch) {
        return next(new HttpError(`Desa ${name} sudah ada!`, 422));
    }

    const createdBranch = new Branch({
        name,
        address
    })

    try {
        await createdBranch.save()
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal mendaftarkan Desa!', 500);
        return next(error);
    }

    res.json({ message: `Berhasil mendaftarkan Desa ${name}!`, branch: createdBranch.toObject({ getters: true }) });
}


const createSubBranch = async (req, res, next) => {
    const { name, address, branchName } = req.body;

    let branch;
    try {
        branch = await Branch.findOne({ name: branchName });
    } catch (err) {
        console.log(err);
        console.log(branch);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!branch) {
        return next(new HttpError('Desa tidak ditemukan!', 500));
    }

    const createdSubBranch = new SubBranch({
        name,
        address,
        branchId: branch.id
    });

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction()
        await createdSubBranch.save({ session: sess });
        branch.subBranches.push(createdSubBranch);
        await branch.save({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal mendaftarkan Kelompok', 500);
        return next(error);
    }

    res.status(202).json({ message: `Berhasil mendaftarkan Kelompok ${branchName}!`, teachingGroup: createdSubBranch });
}

const deleteBranch = async (req, res, next) => {
    const { branchId } = req.body;

    let branch;
    try {
        branch = await Branch.findById(branchId);
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error while finding branch!', 500));
    }

    if (!branch) {
        return next(new HttpError('Branch not found!', 404));
    }

    if (branch.teachingGroups.length > 0) {
        return next(new HttpError('Gagal menghapus, terdapat Kelompok di Desa ini!', 400));
    }

    try {
        await branch.deleteOne();
    } catch (err) {
        console.log(err);
        return next(new HttpError('Deleting branch failed!', 500));
    }

    res.status(200).json({ message: 'Berhasil menghapus Desa!' });
};

const deleteTeachingGroup = async (req, res, next) => {
    const { teachingGroupId } = req.body

    let teachingGroup;
    try {
        teachingGroup = await TeachingGroup.findById(teachingGroupId).populate('branchId');
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error while finding teachingGroup!', 500));
    }

    if (!teachingGroup) {
        return next(new HttpError('TeachingGroup not found!', 404));
    }

    const { branchId } = teachingGroup;

    if (!branchId) {
        return next(new HttpError('Associated branch not found!', 500));
    }

    if (teachingGroup.teachingGroupYears.length > 0) {
        return next(new HttpError('Gagal menghapus, terdapat data semester dalam Kelompok ini!', 400));
    }

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();

        branchId.teachingGroups.pull(teachingGroup);
        await branchId.save({ session: sess });

        await teachingGroup.deleteOne({ session: sess });
        await sess.commitTransaction();
    } catch (err) {
        console.log(err);
        return next(new HttpError('Gagal menghapus Kelompok!', 500));
    }

    res.status(200).json({ message: 'Berhasil menghapus Kelompok!' });
};

const updateBranch = async (req, res, next) => {
    const { name, address } = req.body;
    const branchId = req.params.branchId;

    let branch;
    try {
        branch = await Branch.findByIdAndUpdate(
            branchId,
            { name, address },
            { new: true, runValidators: true }
        );
    } catch (err) {
        console.error(err);
        const error = new HttpError('Something went wrong while updating the branch.', 500);
        return next(error);
    }

    if (!branch) {
        return next(new HttpError(`Could not find a branch with ID '${branchId}'`, 404));
    }

    console.log(`branch with ID'${branch._id}' updated!`)
    res.status(200).json({ message: 'Berhasil mengubah Desa!', branch: branch.toObject({ getters: true }) });
}

const updateTeachingGroup = async (req, res, next) => {
    const { name, address } = req.body;
    const teachingGroupId = req.params.teachingGroupId;

    let teachingGroup;
    try {
        teachingGroup = await TeachingGroup.findByIdAndUpdate(
            teachingGroupId,
            { name, address },
            { new: true, runValidators: true }
        );
    } catch (err) {
        console.error(err);
        const error = new HttpError('Something went wrong while updating the teachingGroup.', 500);
        return next(error);
    }

    if (!teachingGroup) {
        return next(new HttpError(`Could not find a teachingGroup with ID '${teachingGroupId}'`, 404));
    }

    console.log(`teachingGroup with ID '${teachingGroup._id}' updated!`)
    res.status(200).json({ message: 'Berhasil mengubah kelompok ajar!', teachingGroup: teachingGroup.toObject({ getters: true }) });
}

exports.getSubBranchById = getSubBranchById;
exports.getBranchById = getBranchById;
exports.getBranches = getBranches;
exports.getSubBranchesByBranchById = getSubBranchesByBranchById;
exports.createBranch = createBranch;
exports.getSubBranches = getSubBranches
exports.createSubBranch = createSubBranch
exports.deleteBranch = deleteBranch;
exports.deleteTeachingGroup = deleteTeachingGroup;
exports.updateTeachingGroup = updateTeachingGroup
exports.updateBranch = updateBranch