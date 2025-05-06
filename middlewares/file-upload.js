const multer = require('multer')
const {v1 : uuidv1} = require('uuid')

const MIME_TYPE_MAP = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg'
}

const fileUpload = multer({
    limits: 1000000, // 10mb
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/images')
        },
        filename: (req, file, cb) => {
            const ext = MIME_TYPE_MAP[file.mimetype]
            cb(null, uuidv1() + '.' + ext)
        }
    }),
    fileFilter: (req, file, cb) => {
        if (!file) {
            cb(null, true) // No file present, proceed without error
            return
        }
        const isValid = !!MIME_TYPE_MAP[file.mimetype]
        const error = isValid ? null : new Error('Invalid mime type!')
        cb(error, isValid)
    }

})

module.exports = fileUpload