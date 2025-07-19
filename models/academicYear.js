const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const academicYearSchema = new Schema({
    name: { type: String, required: true, unique: true },
    isActive: { type: Boolean, required: true },
    munaqasyahStatus: { type: String, required: true },
    munaqasyah: {
        reciting: { type: Number, required: false },
        writing: { type: Number, required: false },
        quranTafsir: { type: Number, required: false },
        hadithTafsir: { type: Number, required: false },
        practice: { type: Number, required: false },
        moralManner: { type: Number, required: false },
        memorizingSurah: { type: Number, required: false },
        memorizingHadith: { type: Number, required: false },
        memorizingDua: { type: Number, required: false },
        memorizingBeautifulName: { type: Number, required: false },
        knowledge: { type: Number, required: false },
        independence: { type: Number, required: false }
    },
    branchYears: [{ type: mongoose.Types.ObjectId, required: true, ref: 'BranchYear' }]
});

academicYearSchema.index({ 'branchYears': 1 }); // Frequent query by branchYears

module.exports = mongoose.model('AcademicYear', academicYearSchema);

