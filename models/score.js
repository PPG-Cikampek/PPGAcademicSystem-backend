const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const scoreSchema = new Schema({
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    studentId: { type: mongoose.Types.ObjectId, required: true, ref: 'Student' },
    studentNis: { type: Number, required: true },
    teachingGroupYearId: { type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroupYear' },
    classId: { type: mongoose.Types.ObjectId, required: true, ref: 'Class' },
    isBeingScored: { type: String, required: true, default: false },
    reciting: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    writing: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    quranTafsir: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    hadithTafsir: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    practice: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    moralManner: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    memorizingSurah: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    memorizingHadith: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    memorizingDua: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    memorizingBeautifulName: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    knowledge: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    },
    independence: {
        score: { type: Number, required: true },
        examinerUserId: { type: mongoose.Types.ObjectId, required: false, ref: 'User' },
        timestamp: { type: Date, required: false }
    }
});

module.exports = mongoose.model('Score', scoreSchema);

