const mongoose = require('mongoose');
const validator = require('validator');
const HttpError = require('./http-error');
const Schema = mongoose.Schema;

const accountRequestSchema = new Schema({
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    teachingGroupId: { type: mongoose.Types.ObjectId, required: true, ref: 'TeachingGroup}' },
    ticketId: { type: String, required: true },
    name: { type: String, required: true },
    email: {
        type: String,
        required: false,
        unique: false,
        lowercase: true,
        trim: true,
    },
    dateOfBirth: { type: Date, required: true },
    className: { type: String, required: false },
    accountRole: { type: String, required: true },
    status: { type: String, required: true },
    createdTime: { type: Date, required: true },
});


module.exports = mongoose.model('AccountRequest', accountRequestSchema);

