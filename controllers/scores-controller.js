const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const Munaqasyah = require('../models/munaqasyah');
const TeachingGroupYear = require('../models/teachingGroupYear');
const Score = require('../models/score');

const getScore = async (req, res, next) => {
    const { userId, studentId, studentNis, branchYearId, subBranchId, classId } = req.query;

    let filter = {};
    if (userId) filter.userId = userId;
    if (studentId) filter.studentId = studentId;
    if (studentNis) filter.studentNis = studentNis;
    if (branchYearId) filter.branchYearId = branchYearId;
    if (subBranchId) filter.subBranchId = subBranchId;
    if (classId) filter.classId = classId;

    let scores;
    try {
        scores = await Score.find(filter)
            .populate({ path: 'studentId', select: ['name', 'nis', 'thumbnail'] })
            .populate({ path: 'classId', select: 'name' })
            .populate({
                path: 'branchYearId',
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
            return next(new HttpError('Tidak dapat diakses', 400));
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

const getClassScoresBySubBranchId = async (req, res, next) => {
    const subBranchId = req.params.subBranchId;
    const classId = req.query.classId;

    let classes;
    try {
        classes = await Score.find({ subBranchId })
            .populate({ path: 'classId', select: 'name' })
            .populate({ path: 'studentId', select: 'name' })
            .populate({
                path: 'branchYearId',
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

    console.log(
        {
            classes: groupedClassesArray.map(group => ({
                classId: group.classId,
                scores: group.scores.map(x => x.toObject({ getters: true }))
            }))
        }
    )

    console.log(`Get classes for munaqasyah for subBranchId of ${subBranchId}`);
    res.json({
        classes: groupedClassesArray.map(group => ({
            classId: group.classId,
            scores: group.scores.map(x => x.toObject({ getters: true }))
        }))
    });
};

const getClassScoresByBranchYearId = async (req, res, next) => {
    const branchYearId = req.params.branchYearId;
    const classId = req.query.classId;
    const subBranchId = req.query.subBranchId;
    console.log(branchYearId, classId, subBranchId);

    const getClassIdString = (classId) => {
        if (!classId) return '';
        if (typeof classId === 'object' && classId._id) return classId._id.toString();
        return classId.toString();
    };

    // 1. Fetch all scores for the branchYearId (for averages)
    let allClassScores;
    try {
        allClassScores = await Score.find({ branchYearId });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    // 2. Calculate averages for each classId (across all subBranchId)
    const classAverages = {};
    const materials = [
        'reciting', 'writing', 'quranTafsir', 'hadithTafsir', 'practice',
        'moralManner', 'memorizingSurah', 'memorizingHadith', 'memorizingDua',
        'memorizingBeautifulName', 'knowledge', 'independence'
    ];

    // Group scores by classId
    allClassScores.forEach(score => {
        const cid = getClassIdString(score.classId)
        if (!classAverages[cid]) classAverages[cid] = { scores: [] };
        classAverages[cid].scores.push(score);
    });

    // Calculate averages for each classId
    Object.keys(classAverages).forEach(cid => {
        const scores = classAverages[cid].scores;
        const averages = {};
        materials.forEach(material => {
            const values = scores
                .map(s => s[material]?.score)
                .filter(val => typeof val === 'number');
            averages[material] = values.length
                ? (values.reduce((a, b) => a + b, 0) / values.length)
                : null;
        });
        classAverages[cid].averageScores = averages;
    });

    // 3. Fetch filtered scores (by branchYearId and subBranchId)
    let classes;
    try {
        classes = await Score.find({ branchYearId, subBranchId })
            .populate({ path: 'classId', select: 'name' })
            .populate({ path: 'studentId', select: 'name' })
            .populate({
                path: 'branchYearId',
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

    // Group classes by classId (filtered by subBranchId)
    const groupedClasses = classes.reduce((acc, curr) => {
        const cid = getClassIdString(curr.classId)
        if (!acc[cid]) {
            acc[cid] = {
                classId: curr.classId,
                scores: []
            };
        }
        acc[cid].scores.push(curr);
        return acc;
    }, {});

    const groupedClassesArray = Object.values(groupedClasses);

    console.log(`Get classes for munaqasyah for branchYearId of ${branchYearId}`);
    res.json({
        classes: groupedClassesArray.map(group => ({
            classId: group.classId,
            scores: group.scores.map(x => x.toObject({ getters: true })),
            averageScores: classAverages[getClassIdString(group.classId)]?.averageScores || null
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
exports.getClassScoresBySubBranchId = getClassScoresBySubBranchId;
exports.getClassScoresByBranchYearId = getClassScoresByBranchYearId;
exports.patchScoreById = patchScoreById;