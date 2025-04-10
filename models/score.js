const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const scoreSchema = new Schema({
    userId: { type: String, required: true },
    teachingGroupYearId: { type: String, required: true },
    reciting: { type: Number, required: true },
    writing: { type: Number, required: true },
    quranTafsir: { type: Number, required: true },
    hadithTafsir: { type: Number, required: true },
    practice: { type: Number, required: true },
    moralManner: { type: Number, required: true },
    memorizingSurah: { type: Number, required: true },
    memorizingHadith: { type: Number, required: true },
    memorizingDua: { type: Number, required: true },
    memorizingBeautifulName: { type: Number, required: true },
    knowledge: { type: Number, required: true },
    independence: { type: Number, required: true },
});


module.exports = mongoose.model('Score', scoreSchema);

