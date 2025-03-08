const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const Munaqasyah = require('../models/munaqasyah');

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

exports.getMunaqasyahQuestions = getMunaqasyahQuestions;
exports.getQuestionById = getQuestionById
exports.getMunaqasyahQuestionsByClassGrades = getMunaqasyahQuestionsByClassGrades
exports.createMunaqasyahQuestion = createMunaqasyahQuestion