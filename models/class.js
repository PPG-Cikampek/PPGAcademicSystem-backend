const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const classSchema = new Schema({
    name: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isLocked: { type: Boolean, required: false },
    teachers: [{ type: mongoose.Types.ObjectId, required: true, ref: 'Teacher' }],
    students: [{ type: mongoose.Types.ObjectId, required: true, ref: 'Student' }],
    teachingGroupId: { type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroup' },
});


module.exports = mongoose.model('Class', classSchema);  

