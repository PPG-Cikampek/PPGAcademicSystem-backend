const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const journalSchema = new Schema({
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    title: { type: String, required: true },
    content: { type: String, required: false },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: false },
    tags: { type: [String], required: false },
});


module.exports = mongoose.model('Journal', journalSchema);

