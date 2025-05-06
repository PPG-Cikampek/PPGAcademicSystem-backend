const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const teacherSchema = new Schema({
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    name: { type: String, required: true },
    nig: { type: String, required: true, unique: true },
    phone: { type: String, required: false },
    position: { type: String, required: false },
    dateOfBirth: { type: Date, required: false },
    gender: { type: String, required: false },
    address: { type: String, required: false },
    image: { type: String, required: false }, 
    thumbnail: { type: String, required: false },
    originalImagePath: { type: String, required: false },
    positionStartDate: { type: Date, required: false },
    positionEndDate: { type: Date, required: false },
    isProfileComplete: { type: Boolean, required: false },
    classIds: [{ type: mongoose.Types.ObjectId, required: false, ref: 'Class' }],
});


module.exports = mongoose.model('Teacher', teacherSchema);

