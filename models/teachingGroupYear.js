const mongoose = require('mongoose');
const academicYear = require('./academicYear');

const Schema = mongoose.Schema;

const teachingGroupYearSchema = new Schema({
    name: { type: String, required: false },
    academicYearId: { type: mongoose.Types.ObjectId, required: true, ref: 'AcademicYear', index: true },
    teachingGroupId: { type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroup', index: true },
    semesterTarget: { type: Number, required: false },
    isActive: { type: Boolean, required: true },
    classes: [{ type: mongoose.Types.ObjectId, required: true, ref: 'Class' }]
});


module.exports = mongoose.model('TeachingGroupYear', teachingGroupYearSchema);

    