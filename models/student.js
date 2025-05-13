const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const studentSchema = new Schema({
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    nis: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    dateOfBirth: { type: Date, required: false },
    gender: { type: String, required: false },
    parentName: { type: String, required: false },
    parentPhone: { type: String, required: false },
    address: { type: String, required: false },
    image: { type: String, required: false },
    thumbnail: { type: String, required: false },
    isProfileComplete: { type: Boolean, required: false },
    attendanceIds: [{ type: mongoose.Types.ObjectId, required: false, ref: 'Attendance' }],
    classIds: [{ type: mongoose.Types.ObjectId, required: false, ref: 'Class' }],
});


module.exports = mongoose.model('Student', studentSchema);

