const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const materialProgress = new Schema({
    forDate: { type: Date, required: true },
    timestamp: { type: Date, required: true },
    category: { type: String, required: true },
    material: { type: String, required: true },
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    classId: { type: mongoose.Types.ObjectId, required: true, ref: 'Class', index: true },
});


module.exports = mongoose.model('MaterialProgress', materialProgress);

