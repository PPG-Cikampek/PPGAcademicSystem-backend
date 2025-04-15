const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const academicYearSchema = new Schema({
    name: { type: String, required: true, unique: true },
    isActive: { type: Boolean, required: true },
    isMunaqasyahActive: { type: Boolean, required: true },
    munaqasyah: {
        gradePraPaudSeed: { type: Number, required: true },
        gradePaudSeed: { type: Number, required: true },
        grade1Seed: { type: Number, required: true },
        grade2Seed: { type: Number, required: true },
        grade3Seed: { type: Number, required: true },
        grade4Seed: { type: Number, required: true },
        grade5Seed: { type: Number, required: true },
        grade6Seed: { type: Number, required: true }
    },
    teachingGroupYears: [{ type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroupYear' }]
});


module.exports = mongoose.model('AcademicYear', academicYearSchema);

