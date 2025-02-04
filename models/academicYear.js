const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const academicYearSchema = new Schema({
    name: { type: String, required: true, unique: true },
    isActive: { type: Boolean, required: true },
    teachingGroupYears: [{ type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroupYear' }]
});


module.exports = mongoose.model('AcademicYear', academicYearSchema);

    