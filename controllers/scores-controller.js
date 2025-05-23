const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const Munaqasyah = require('../models/munaqasyah');
const TeachingGroupYear = require('../models/teachingGroupYear');
const Score = require('../models/score');

const getScore = async (req, res, next) => {
    const { userId, studentId, studentNis, teachingGroupYearId, classId } = req.query;

    let filter = {};
    if (userId) filter.userId = userId;
    if (studentId) filter.studentId = studentId;
    if (studentNis) filter.studentNis = studentNis;
    if (teachingGroupYearId) filter.teachingGroupYearId = teachingGroupYearId;
    if (classId) filter.classId = classId;

    let scores;
    try {
        scores = await Score.find(filter)
            .populate({ path: 'studentId', select: ['name', 'nis', 'thumbnail'] })
            .populate({ path: 'classId', select: 'name' })
            .populate({
                path: 'teachingGroupYearId',
                select: 'academicYearId',
                populate: {
                    path: 'academicYearId',
                    select: 'name'
                }
            })
            .populate('reciting.examinerUserId', 'name')
            .populate('writing.examinerUserId', 'name')
            .populate('quranTafsir.examinerUserId', 'name')
            .populate('hadithTafsir.examinerUserId', 'name')
            .populate('practice.examinerUserId', 'name')
            .populate('moralManner.examinerUserId', 'name')
            .populate('memorizingSurah.examinerUserId', 'name')
            .populate('memorizingHadith.examinerUserId', 'name')
            .populate('memorizingDua.examinerUserId', 'name')
            .populate('memorizingBeautifulName.examinerUserId', 'name')
            .populate('knowledge.examinerUserId', 'name')
            .populate('independence.examinerUserId', 'name');

        if (!scores || scores.length === 0) {
            return res.status(200).json({ scores: [] });
        }

    } catch (error) {
        console.error(error);
        return next(new HttpError('Internal server error occurred!', 500));
    }

    console.log('Get Scores requested');
    res.status(200).json({
        scores: scores.map(score => score.toObject({ getters: true }))
    });
};

const getScoreById = async (req, res, next) => {
    const scoreId = req.params.scoreId;

    let identifiedScore
    try {
        identifiedScore = await Score.findById(scoreId)

        if (!identifiedScore) {
            return next(new HttpError(`Academic Year with ID ${scoreId} not found!`, 404));
        }

    } catch (error) {
        console.error(error);
        return next(new HttpError('Internal server error occurred!', 500));
    }

    console.log('Get ScoreById requested')
    res.status(200).json({ score: identifiedScore.toObject({ getters: true }) });
};

const getClassesByTeachingGroupYearId = async (req, res, next) => {
    const teachingGroupYearId = req.params.teachingGroupYearId;
    const classId = req.query.classId;
    
    console.log(teachingGroupYearId, classId);

    let classes;
    try {
        classes = await Score.find({ teachingGroupYearId })
            .populate({ path: 'classId', select: 'name' })
            .populate({ path: 'studentId', select: 'name' })
            .populate({
                path: 'teachingGroupYearId',
                select: 'academicYearId',
                populate: {
                    path: 'academicYearId',
                    select: 'name'
                }
            })
            .populate('reciting.examinerUserId', 'name')
            .populate('writing.examinerUserId', 'name')
            .populate('quranTafsir.examinerUserId', 'name')
            .populate('hadithTafsir.examinerUserId', 'name')
            .populate('practice.examinerUserId', 'name')
            .populate('moralManner.examinerUserId', 'name')
            .populate('memorizingSurah.examinerUserId', 'name')
            .populate('memorizingHadith.examinerUserId', 'name')
            .populate('memorizingDua.examinerUserId', 'name')
            .populate('memorizingBeautifulName.examinerUserId', 'name')
            .populate('knowledge.examinerUserId', 'name')
            .populate('independence.examinerUserId', 'name');
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    if (!classes) {
        return next(new HttpError("Teaching group year not found!", 404));
    }

    // Group classes by classId
    const groupedClasses = classes.reduce((acc, curr) => {
        const classId = curr.classId.toString();
        if (!acc[classId]) {
            acc[classId] = {
                classId: curr.classId,
                scores: []
            };
        }
        acc[classId].scores.push(curr);
        return acc;
    }, {});

    const groupedClassesArray = Object.values(groupedClasses);

    console.log(`Get classes for munaqasyah for teachinggroupyearId of ${teachingGroupYearId}`);
    res.json({
        classes: groupedClassesArray.map(group => ({
            classId: group.classId,
            scores: group.scores.map(x => x.toObject({ getters: true }))
        }))
    });
};

const patchScoreById = async (req, res, next) => {
    const scoreId = req.params.scoreId;
    const scoreData = req.body;

    let updatedScore;
    try {
        updatedScore = await Score.findByIdAndUpdate(
            scoreId,
            scoreData,
            { new: true }
        );

        if (!updatedScore) {
            return next(new HttpError(`Score with ID ${scoreId} not found!`, 404));
        }
    } catch (error) {
        console.error(error);
        return next(new HttpError('Internal server error occurred while updating score!', 500));
    }

    console.log(`Patchd score with ID ${scoreId}`);
    res.status(200).json({ score: updatedScore.toObject({ getters: true }) });
};

exports.getScore = getScore;
exports.getScoreById = getScoreById;
exports.getClassesByTeachingGroupYearId = getClassesByTeachingGroupYearId;
exports.patchScoreById = patchScoreById;