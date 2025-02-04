const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const User = require('../models/user');
const Class = require('../models/class');
const MaterialProgress = require('../models/materialProgress')

const getProgressesByUserId = async (req, res, next) => {
    const { week } = req.query;
    const { userId } = req.params

    console.log(week)
    console.log(userId)

    let progresses;

    try {
        const startDate = new Date(week);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        startDate.setDate(startDate.getDate() - 1);

        progresses = await MaterialProgress.find({
            userId,
            // forDate: { $gte: startDate, $lte: endDate }
        }).sort({ forDate: -1 });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }
    console.log(progresses)
    console.log('Get progresses requested');
    res.json({ progresses: progresses.map(x => x.toObject({ getters: true })) });
};

const createProgress = async (req, res, next) => {
    const { category, material, classId, userId } = req.body

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

    let identifiedUser;
    try {
        identifiedUser = await User.findById(userId);
    } catch (err) {
        console.log(err);
        return next(new HttpError('Internal server error!', 500));
    }

    if (!identifiedUser) {
        return next(new HttpError('user not found!', 500));
    }


    const forDate = new Date().toISOString();
    const timestamp = new Date().toISOString();

    const createdProgress = new MaterialProgress({
        forDate,
        timestamp,
        category,
        material,
        userId,
        classId
    })

    try {
        await createdProgress.save()
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menyimpan pencapaian materi!', 500);
        return next(error);
    }

    res.json({ message: `Berhasil menyimpan pencapaian materi!`, journal: createdProgress.toObject({ getters: true }) });
}

exports.getProgressesByUserId = getProgressesByUserId;
exports.createProgress = createProgress