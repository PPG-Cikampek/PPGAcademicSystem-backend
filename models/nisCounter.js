const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const nisCounterSchema = new Schema({
    year: { type: Number, required: true },
    count: { type: Number, required: true },
});

module.exports = mongoose.model('NisCounter', nisCounterSchema);
