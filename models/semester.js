const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const semesterSchema = new Schema({
    semester: { type: String, required: true },
    isActive: { type: Boolean, required: true },
    academicYearId: { type: mongoose.Types.ObjectId, required: true, ref: 'AcademicYear' },
    classes: [{ type: mongoose.Types.ObjectId, required: true, ref: 'Class' }]
});


module.exports = mongoose.model('Semester', semesterSchema);

