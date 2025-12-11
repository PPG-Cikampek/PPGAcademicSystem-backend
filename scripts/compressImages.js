// scripts/compressImages.js
// Image compression script for optimizing uploaded images in-place
// Usage: node scripts/compressImages.js [--dry-run] [--verbose] [--target=path]

const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const isVerbose = args.includes("--verbose");
const targetArg = args.find((arg) => arg.startsWith("--target="));
const targetPath = targetArg
    ? targetArg.split("=")[1]
    : path.join(__dirname, "../uploads/images");

// Statistics tracking
const stats = {
    totalFiles: 0,
    processedFiles: 0,
    skippedFiles: 0,
    failedFiles: 0,
    totalOriginalSize: 0,
    totalCompressedSize: 0,
    errors: [],
};

// Supported image formats and their compression settings
const IMAGE_FORMATS = {
    png: {
        extensions: [".png"],
        compress: async (buffer) =>
            await sharp(buffer)
                .png({
                    compressionLevel: 9,
                    quality: 90,
                    effort: 10,
                })
                .toBuffer(),
    },
    jpeg: {
        extensions: [".jpg", ".jpeg"],
        compress: async (buffer) =>
            await sharp(buffer)
                .jpeg({
                    quality: 85,
                    mozjpeg: true,
                })
                .toBuffer(),
    },
    webp: {
        extensions: [".webp"],
        compress: async (buffer) =>
            await sharp(buffer)
                .webp({
                    quality: 85,
                    effort: 6,
                })
                .toBuffer(),
    },
    gif: {
        extensions: [".gif"],
        compress: async (buffer) => buffer, // GIF compression is complex, skip for now
    },
    bmp: {
        extensions: [".bmp"],
        compress: async (buffer) =>
            await sharp(buffer)
                .png({
                    compressionLevel: 9,
                    quality: 90,
                })
                .toBuffer(),
    },
};

/**
 * Get format handler based on file extension
 */
function getFormatHandler(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    for (const [format, config] of Object.entries(IMAGE_FORMATS)) {
        if (config.extensions.includes(ext)) {
            return { format, handler: config };
        }
    }
    return null;
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}

/**
 * Compress a single image file
 */
async function compressImage(filePath) {
    try {
        // Get file stats
        const fileStats = await fs.stat(filePath);
        const originalSize = fileStats.size;
        stats.totalOriginalSize += originalSize;

        // Check if it's an image
        const formatInfo = getFormatHandler(filePath);
        if (!formatInfo) {
            if (isVerbose) {
                console.log(`  ⊘ Skipping ${path.basename(filePath)} - Not a supported image format`);
            }
            stats.skippedFiles++;
            return;
        }

        // Skip GIF files (require special handling)
        if (formatInfo.format === "gif") {
            if (isVerbose) {
                console.log(`  ⊘ Skipping ${path.basename(filePath)} - GIF format not optimized`);
            }
            stats.skippedFiles++;
            stats.totalCompressedSize += originalSize;
            return;
        }

        // Read original file
        const originalBuffer = await fs.readFile(filePath);

        // Validate image can be read by sharp
        try {
            await sharp(originalBuffer).metadata();
        } catch (error) {
            throw new Error(`Corrupted or invalid image file: ${error.message}`);
        }

        // Compress the image
        const compressedBuffer = await formatInfo.handler.compress(originalBuffer);
        const compressedSize = compressedBuffer.length;
        stats.totalCompressedSize += compressedSize;

        // Calculate savings
        const savings = originalSize - compressedSize;
        const savingsPercent = ((savings / originalSize) * 100).toFixed(2);

        // Only replace if compression actually reduces size
        if (compressedSize < originalSize) {
            if (!isDryRun) {
                // Write compressed image back to original path
                await fs.writeFile(filePath, compressedBuffer);

                // Verify the file was written correctly
                const verifyStats = await fs.stat(filePath);
                if (verifyStats.size !== compressedSize) {
                    throw new Error("File size mismatch after write");
                }
            }

            if (isVerbose || isDryRun) {
                console.log(
                    `  ✓ ${path.basename(filePath)}: ${formatBytes(originalSize)} → ${formatBytes(compressedSize)} (saved ${formatBytes(savings)} / ${savingsPercent}%)`
                );
            }
        } else {
            // File is already well-compressed
            stats.totalCompressedSize += originalSize - compressedSize; // Adjust stats
            if (isVerbose) {
                console.log(
                    `  → ${path.basename(filePath)}: Already optimized (${formatBytes(originalSize)})`
                );
            }
        }

        stats.processedFiles++;
    } catch (error) {
        stats.failedFiles++;
        stats.errors.push({
            file: path.basename(filePath),
            error: error.message,
        });
        console.error(`  ✗ Error processing ${path.basename(filePath)}: ${error.message}`);
    }
}

/**
 * Process all images in directory
 */
async function compressImagesInDirectory(dirPath) {
    try {
        // Check if directory exists
        await fs.access(dirPath);

        // Read all files in directory
        const files = await fs.readdir(dirPath);
        const imageFiles = files.filter((file) => {
            const ext = path.extname(file).toLowerCase();
            return Object.values(IMAGE_FORMATS).some((format) =>
                format.extensions.includes(ext)
            );
        });

        stats.totalFiles = imageFiles.length;

        if (stats.totalFiles === 0) {
            console.log("⚠ No image files found in directory");
            return;
        }

        console.log(`\n📁 Target directory: ${dirPath}`);
        console.log(`📊 Found ${stats.totalFiles} image file(s)\n`);

        if (isDryRun) {
            console.log("🔍 DRY RUN MODE - No files will be modified\n");
        }

        console.log("Processing images...\n");

        // Process each image
        for (const file of imageFiles) {
            const filePath = path.join(dirPath, file);
            await compressImage(filePath);
        }
    } catch (error) {
        console.error(`Error accessing directory: ${error.message}`);
        process.exit(1);
    }
}

/**
 * Display final statistics
 */
function displayStatistics() {
    const totalSavings = stats.totalOriginalSize - stats.totalCompressedSize;
    const savingsPercent = stats.totalOriginalSize > 0
        ? ((totalSavings / stats.totalOriginalSize) * 100).toFixed(2)
        : 0;

    console.log("\n" + "=".repeat(60));
    console.log("📊 COMPRESSION STATISTICS");
    console.log("=".repeat(60));
    console.log(`Total files found:       ${stats.totalFiles}`);
    console.log(`Successfully processed:  ${stats.processedFiles}`);
    console.log(`Skipped:                 ${stats.skippedFiles}`);
    console.log(`Failed:                  ${stats.failedFiles}`);
    console.log("-".repeat(60));
    console.log(`Original total size:     ${formatBytes(stats.totalOriginalSize)}`);
    console.log(`Compressed total size:   ${formatBytes(stats.totalCompressedSize)}`);
    console.log(`Total space saved:       ${formatBytes(totalSavings)} (${savingsPercent}%)`);
    console.log("=".repeat(60));

    if (stats.errors.length > 0) {
        console.log("\n❌ ERRORS:");
        stats.errors.forEach((err) => {
            console.log(`  • ${err.file}: ${err.error}`);
        });
    }

    if (isDryRun) {
        console.log("\n💡 This was a dry run. Run without --dry-run to apply changes.");
    } else {
        console.log("\n✅ Compression complete!");
    }
}

/**
 * Main execution
 */
async function main() {
    console.log("╔══════════════════════════════════════════════════════════╗");
    console.log("║          IMAGE COMPRESSION UTILITY                       ║");
    console.log("╚══════════════════════════════════════════════════════════╝");

    const startTime = Date.now();

    await compressImagesInDirectory(targetPath);
    displayStatistics();

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`\n⏱ Total execution time: ${duration} seconds\n`);
}

// Run the script
main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
