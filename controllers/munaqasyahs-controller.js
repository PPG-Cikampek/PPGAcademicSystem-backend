const HttpError = require('../models/http-error')
const mongoose = require('mongoose');

const Munaqasyah = require('../models/munaqasyah');
const TeachingGroupYear = require('../models/teachingGroupYear');
const Score = require('../models/score');

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

const getClassesByTeachingGroupYearId = async (req, res, next) => {
    const teachingGroupYearId = req.params.teachingGroupYearId

    let teachingGroupYear;
    try {
        teachingGroupYear = await TeachingGroupYear.findById(teachingGroupYearId)
            .populate('classes') // Add this line to populate the classes
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    if (!teachingGroupYear) {
        return next(new HttpError("Teaching group year not found!", 404));
    }

    console.log(`Get classes for munaqasyah for teachinggrupyearId of ${teachingGroupYearId}`);
    res.json({ classes: teachingGroupYear.classes.map(x => x.toObject({ getters: true })) });
};

const getMunaqasyahQuestionsForExamination = async (req, res, next) => {
    const { semester, classGrade, category } = req.query;

    try {
        // Get all eligible questions matching the criteria
        const eligibleQuestions = await Munaqasyah.find({
            semester,
            classGrade,
            category,
            // status: 'active'
        });

        if (!eligibleQuestions || eligibleQuestions.length === 0) {
            return next(new HttpError("No questions found for given criteria", 404));
        }

        // Shuffle the questions array
        const shuffledQuestions = [...eligibleQuestions].sort(() => Math.random() - 0.5);

        // Select questions that sum up to exactly 100 points
        const targetTotalScore = 40;
        const selectedQuestions = [];
        let currentSum = 0;

        for (const question of shuffledQuestions) {
            if (currentSum + question.maxScore <= targetTotalScore) {
                selectedQuestions.push(question);
                currentSum += question.maxScore;
            }
            if (currentSum === targetTotalScore) break;
        }

        if (currentSum !== targetTotalScore) {
            return next(new HttpError(`Could not find questions that sum up to exactly ${targetTotalScore} points`, 404));
        }

        console.log(`Selected ${selectedQuestions.length} questions for examination with total score ${currentSum}`);

        // Map and remove redundant fields from each question
        const formattedQuestions = selectedQuestions.map(q => {
            const questionObj = q.toObject({ getters: true });
            delete questionObj.classGrade;
            delete questionObj.semester;
            delete questionObj.category;
            return questionObj;
        });

        res.json({
            semester,
            classGrade,
            category,
            questions: formattedQuestions,
            totalScore: currentSum
        });

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }
};

const getMunaqasyahQuestionsForExaminationByCategory = async (req, res, next) => {
    const { semester, category, seed = Date.now() } = req.query;

    const seededRandom = (seed) => {
        const x = Math.sin(seed++) * 10000;
        return x - Math.floor(x);
    };

    try {
        const categories = ['paud', 'pra-paud', '1', '2', '3', '4', '5', '6'];
        const result = {
            semester,
            category,
            seed: Number(seed),
            classes: []
        };

        let currentSeed = Number(seed);

        for (const classGrade of categories) {
            const eligibleQuestions = await Munaqasyah.find({
                semester,
                classGrade,
                category,
            });

            if (eligibleQuestions.length > 0) {
                const shuffledQuestions = [...eligibleQuestions].sort(() => seededRandom(currentSeed++) - 0.5);

                const targetTotalScore = 300;
                const selectedQuestions = [];
                let currentSum = 0;

                for (const question of shuffledQuestions) {
                    if (currentSum + question.maxScore <= targetTotalScore) {
                        selectedQuestions.push(question);
                        currentSum += question.maxScore;
                    }
                    if (currentSum === targetTotalScore) break;
                }

                if (currentSum === targetTotalScore) {
                    const formattedQuestions = selectedQuestions.map(q => {
                        const questionObj = q.toObject({ getters: true });
                        delete questionObj.classGrade;
                        delete questionObj.semester;
                        delete questionObj.category;
                        return questionObj;
                    });

                    result.classes.push({
                        classGrade,
                        totalScore: currentSum,
                        questions: formattedQuestions
                    });
                }
            }
        }

        if (result.classes.length === 0) {
            return next(new HttpError("No questions found for given criteria", 404));
        }

        res.json(result);

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }
};

const createMunaqasyahQuestion = async (req, res, next) => {
    const { classGrade, type, category, semester, curriculumMonth, maxScore, scoreOptions, instruction, question, answers } = req.body

    const createdQuestion = new Munaqasyah({
        status: 'inactive',
        classGrade,
        type,
        curriculumMonth,
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
    const { classGrade, type, category, semester, curriculumMonth, maxScore, scoreOptions, instruction, question, answers } = req.body;

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
    existingQuestion.curriculumMonth = curriculumMonth || existingQuestion.curriculumMonth;
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

const patchQuestionStatusById = async (req, res, next) => {
    const questionId = req.params.questionId;
    const { status } = req.body;

    let existingQuestion;
    try {
        existingQuestion = await Munaqasyah.findOneAndUpdate(
            { _id: questionId },
            { status },
            { new: true }
        );

        if (!existingQuestion) {
            return next(new HttpError("Question not found!", 404));
        }

        console.log(`Updated munaqasyah question with id ${questionId}`);
        res.json({
            message: "Berhasil meng-update status soal!",
            question: existingQuestion.toObject({ getters: true })
        });

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }
};

const startTeachingGroupYearMunaqasyah = async (req, res, next) => {
    const teachingGroupYearId = req.params.teachingGroupYearId;
    const { isMunaqasyahActive } = req.body;

    let existingTeachingGroupYear;
    try {
        existingTeachingGroupYear = await TeachingGroupYear.findById(teachingGroupYearId)
            .populate({
                path: 'classes',
                populate: {
                    path: 'students',
                    select: 'userId nis'
                }
            });

        if (!existingTeachingGroupYear) {
            return next(new HttpError("Tahun Ajaran tidak ditemukan!", 404));
        }

        const scoreEntries = existingTeachingGroupYear.classes.flatMap(classObj =>
            classObj.students.map(student => ({
                userId: student.userId,
                studentId: student._id,
                studentNis: student.nis,
                teachingGroupYearId: teachingGroupYearId,
                classId: classObj._id,
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
            }))
        );

        await Score.insertMany(scoreEntries);
        existingTeachingGroupYear.isMunaqasyahActive = isMunaqasyahActive;
        await existingTeachingGroupYear.save();

        console.log(`Started munaqosyah for teachingGroupYear with id ${teachingGroupYearId}`);
        res.json({
            message: "Munaqosah dimulai dan nilai awal siswa telah dibuat!",
            teachingGroupYear: existingTeachingGroupYear.toObject({ getters: true })
        });

    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }
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
exports.getClassesByTeachingGroupYearId = getClassesByTeachingGroupYearId;
exports.getMunaqasyahQuestionsForExamination = getMunaqasyahQuestionsForExamination;
exports.getMunaqasyahQuestionsForExaminationByCategory = getMunaqasyahQuestionsForExaminationByCategory;
exports.createMunaqasyahQuestion = createMunaqasyahQuestion;
exports.patchQuestionById = patchQuestionById;
exports.patchQuestionStatusById = patchQuestionStatusById;
exports.startTeachingGroupYearMunaqasyah = startTeachingGroupYearMunaqasyah;
exports.deleteQuestionById = deleteQuestionById;