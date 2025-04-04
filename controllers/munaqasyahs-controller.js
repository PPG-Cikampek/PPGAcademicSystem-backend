const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const Munaqasyah = require('../models/munaqasyah');

const getClassesInfo = async (req, res, next) => {
    try {
        const aggregateResult = await Munaqasyah.aggregate([
            {
                $group: {
                    _id: '$classGrade',
                    questionCount: { $sum: 1 }
                }
            }
        ]);

        const grades = [
            { grade: 'pra-paud', label: 'Kelas Pra-Paud' },
            { grade: 'paud', label: 'Kelas Paud' },
            { grade: '1', label: 'Kelas 1' },
            { grade: '2', label: 'Kelas 2' },
            { grade: '3', label: 'Kelas 3' },
            { grade: '4', label: 'Kelas 4' },
            { grade: '5', label: 'Kelas 5' },
            { grade: '6', label: 'Kelas 6' }
        ];

        const formattedResult = grades.map(gradeInfo => ({
            ...gradeInfo,
            questionCount: aggregateResult.find(item => item._id === gradeInfo.grade)?.questionCount || 0
        }));

        res.json(formattedResult);
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }
};

const getMunaqasyahQuestions = async (req, res, next) => {
    let munaqasyahQuestions;

    try {
        munaqasyahQuestions = await Munaqasyah.find()
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log('Get dashboard munaqasyahQuestions requested');
    res.json({ questions: munaqasyahQuestions.map(x => x.toObject({ getters: true })) });
};

const getQuestionById = async (req, res, next) => {
    const questionId = req.params.questionId

    let question;
    try {
        question = await Munaqasyah.findById(questionId)
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log(`Get question by id ${questionId} requested`);
    res.json({ question: question.toObject({ getters: true }) });
}

const getMunaqasyahQuestionsByClassGrades = async (req, res, next) => {
    const classGrade = req.params.classGrade

    let munaqasyahQuestions;
    try {
        munaqasyahQuestions = await Munaqasyah.find({ classGrade })
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log(`Get munaqasyahQuestions for grade ${classGrade} requested`);
    res.json({ questions: munaqasyahQuestions.map(x => x.toObject({ getters: true })) });
};

const createMunaqasyahQuestion = async (req, res, next) => {
    const { classGrade, type, category, semester, maxScore, scoreOptions, instruction, question, answers } = req.body

    const createdQuestion = new Munaqasyah({
        classGrade,
        type,
        category,
        semester,
        maxScore,
        scoreOptions,
        instruction,
        question,
        answers,
    })

    try {
        await createdQuestion.save()
        // console.log(createdQuestion);
    } catch (err) {
        console.log(err);
        const error = new HttpError('Gagal menambahkan soal!', 500);
        return next(error);
    }

    res.json({ message: `Berhasil menambahkan soal!`, question: createdQuestion.toObject({ getters: true }) });
}

const patchQuestionById = async (req, res, next) => {
    const questionId = req.params.questionId;
    const { classGrade, type, category, semester, maxScore, scoreOptions, instruction, question, answers } = req.body;

    let existingQuestion;
    try {
        existingQuestion = await Munaqasyah.findById(questionId);
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    if (!existingQuestion) {
        return next(new HttpError("Question not found!", 404));
    }

    existingQuestion.classGrade = classGrade || existingQuestion.classGrade;
    existingQuestion.type = type || existingQuestion.type;
    existingQuestion.category = category || existingQuestion.category;
    existingQuestion.semester = semester || existingQuestion.semester;
    existingQuestion.maxScore = maxScore || existingQuestion.maxScore;
    existingQuestion.scoreOptions = scoreOptions || existingQuestion.scoreOptions;
    existingQuestion.instruction = instruction || existingQuestion.instruction;
    existingQuestion.question = question || existingQuestion.question;
    existingQuestion.answers = answers || existingQuestion.answers;

    try {
        await existingQuestion.save();
    } catch (err) {
        console.error(err);
        return next(new HttpError("Gagal meng-update soal!", 500));
    }

    console.log(`Updated munaqasyah question with id ${questionId}`)
    res.json({ message: "Berhasil meng-update soal!", question: existingQuestion.toObject({ getters: true }) });
};

const deleteQuestionById = async (req, res, next) => {
    const questionId = req.params.questionId;

    let question;
    try {
        question = await Munaqasyah.findById(questionId);
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    if (!question) {
        return next(new HttpError("Question not found!", 404));
    }

    try {
        await question.deleteOne();
    } catch (err) {
        console.error(err);
        return next(new HttpError("Gagal menghapus soal!", 500));
    }

    console.log(`Deleted munaqasyah question with id ${questionId}`)
    res.json({ message: "Berhasil menghapus soal!" });
};

exports.getClassesInfo = getClassesInfo;
exports.getMunaqasyahQuestions = getMunaqasyahQuestions;
exports.getQuestionById = getQuestionById;
exports.getMunaqasyahQuestionsByClassGrades = getMunaqasyahQuestionsByClassGrades;
exports.createMunaqasyahQuestion = createMunaqasyahQuestion;
exports.patchQuestionById = patchQuestionById;
exports.deleteQuestionById = deleteQuestionById;