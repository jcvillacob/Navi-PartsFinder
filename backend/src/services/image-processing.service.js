const sharp = require("sharp");

const MEDIUM_MAX_SIZE = 1280;
const THUMB_SIZE = 320;

async function processImageVariants(fileBuffer) {
  const sourceMetadata = await sharp(fileBuffer).metadata();

  if (!sourceMetadata.width || !sourceMetadata.height) {
    throw new Error("Archivo de imagen inválido");
  }

  const mediumBuffer = await sharp(fileBuffer)
    .rotate()
    .resize({
      width: MEDIUM_MAX_SIZE,
      height: MEDIUM_MAX_SIZE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();

  const thumbBuffer = await sharp(fileBuffer)
    .rotate()
    .resize({
      width: THUMB_SIZE,
      height: THUMB_SIZE,
      fit: "cover",
      position: "center",
    })
    .webp({ quality: 76 })
    .toBuffer();

  const mediumMetadata = await sharp(mediumBuffer).metadata();

  return {
    mediumBuffer,
    thumbBuffer,
    mediumWidth: mediumMetadata.width || sourceMetadata.width,
    mediumHeight: mediumMetadata.height || sourceMetadata.height,
  };
}

module.exports = {
  processImageVariants,
};
