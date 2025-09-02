const sharp = require("sharp");
const path = require("path");
const fs = require("fs").promises;

/**
 * Generate a base64 thumbnail from an image file
 * @param {string} imagePath - Path to the original image file
 * @param {number} width - Thumbnail width (default: 150)
 * @param {number} height - Thumbnail height (default: 150)
 * @param {number} quality - JPEG quality (default: 80)
 * @returns {Promise<string>} Base64 encoded thumbnail
 */
const generateThumbnailBase64 = async (
    imagePath,
    width = 150,
    height = 150,
    quality = 80
) => {
    try {
        // Check if file exists
        await fs.access(imagePath);

        // Generate thumbnail and convert to base64
        const thumbnailBuffer = await sharp(imagePath)
            .resize(width, height, {
                fit: "cover",
                position: "center",
            })
            .jpeg({ quality })
            .toBuffer();

        // Convert to base64
        const base64Thumbnail = `data:image/jpeg;base64,${thumbnailBuffer.toString(
            "base64"
        )}`;

        return base64Thumbnail;
    } catch (error) {
        console.error("Error generating thumbnail:", error);
        throw new Error(`Failed to generate thumbnail: ${error.message}`);
    }
};

/**
 * Generate a thumbnail file and save it to disk
 * @param {string} imagePath - Path to the original image file
 * @param {string} outputPath - Path where thumbnail will be saved
 * @param {number} width - Thumbnail width (default: 150)
 * @param {number} height - Thumbnail height (default: 150)
 * @param {number} quality - JPEG quality (default: 80)
 * @returns {Promise<string>} Path to the generated thumbnail file
 */
const generateThumbnailFile = async (
    imagePath,
    outputPath,
    width = 150,
    height = 150,
    quality = 80
) => {
    try {
        // Check if file exists
        await fs.access(imagePath);

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        await fs.mkdir(outputDir, { recursive: true });

        // Generate thumbnail and save to file
        await sharp(imagePath)
            .resize(width, height, {
                fit: "cover",
                position: "center",
            })
            .jpeg({ quality })
            .toFile(outputPath);

        return outputPath;
    } catch (error) {
        console.error("Error generating thumbnail file:", error);
        throw new Error(`Failed to generate thumbnail file: ${error.message}`);
    }
};

/**
 * Generate thumbnail file path based on original file path
 * @param {string} originalPath - Path to the original image
 * @returns {string} Path for the thumbnail file
 */
const generateThumbnailPath = (originalPath) => {
    const parsedPath = path.parse(originalPath);
    return path.join(
        parsedPath.dir,
        `${parsedPath.name}_thumb${parsedPath.ext}`
    );
};

module.exports = {
    generateThumbnailBase64,
    generateThumbnailFile,
    generateThumbnailPath,
};
