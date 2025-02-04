const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const attendanceSchema = new Schema({
    forDate: { type: Date, required: true },
    timestamp: { type: Date, required: true },
    status: { type: String, required: true },
    attributes: { type: Boolean, required: true },
    violations: { type: Object, required: true },
    updateReason: { type: String, required: false },
    teachersNotes: { type: String, required: false },
    studentId: { type: mongoose.Types.ObjectId, required: true, ref: 'Student' },
    classId: { type: mongoose.Types.ObjectId, required: true, ref: 'Class', index: true },
});


module.exports = mongoose.model('Attendance', attendanceSchema);

