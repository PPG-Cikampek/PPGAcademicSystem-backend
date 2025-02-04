const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const Journal = require('../models/journal');
const User = require('../models/user');

const getJournalsByUserId = async (req, res, next) => {
    const { week } = req.query;
    const { userId } = req.params
    let journals;

    try {
        const startDate = new Date(week);
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        startDate.setDate(startDate.getDate() - 1);

        journals = await Journal.find({
            userId,
            createdAt: { $gte: startDate, $lte: endDate }
        }).sort({ createdAt: -1 });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get journals requested');
    res.json({ journals: journals.map(x => x.toObject({ getters: true })) });
};

const createJournal = async (req, res, next) => {
    const { userId, title, content } = req.body

    const createdJournal = new Journal({
        userId,
        title,
        content,
        createdAt: new Date()
    })

    try {
        await createdJournal.save()
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menyimpan jurnal!', 500);
        return next(error);
    }

    res.json({ message: `Berhasil menyimpan jurnal!`, journal: createdJournal.toObject({ getters: true }) });
}

exports.getJournalsByUserId = getJournalsByUserId;
exports.createJournal = createJournal