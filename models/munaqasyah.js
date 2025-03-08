const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const munaqasyahSchema = new Schema({
    classGrade: { type: String, required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    semester: { type: String, required: true },
    maxScore: { type: Number, required: true },
    scoreOptions: { type: [Number], required: false },
    instruction: { type: String, required: false },
    question: { type: String, required: false },
    answers: { type: [String], required: false },
});


module.exports = mongoose.model('Munaqasyah', munaqasyahSchema);

