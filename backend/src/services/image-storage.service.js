const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} = require("@aws-sdk/client-s3");
const {
  S3_ENDPOINT,
  S3_REGION,
  S3_ACCESS_KEY,
  S3_SECRET_KEY,
  S3_BUCKET,
  S3_FORCE_PATH_STYLE,
} = require("../config");

const s3Client = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
});

async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode;
    if (statusCode !== 404 && statusCode !== 400 && statusCode !== 403) {
      throw error;
    }

    await s3Client.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
  }
}

async function uploadObject({ key, body, contentType, cacheControl }) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: cacheControl,
    }),
  );

  return {
    bucket: S3_BUCKET,
    key,
  };
}

async function getObject(key) {
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    }),
  );

  return response;
}

async function deleteObjects(keys) {
  const validKeys = (keys || []).filter(Boolean);
  if (validKeys.length === 0) {
    return;
  }

  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: S3_BUCKET,
      Delete: {
        Objects: validKeys.map((key) => ({ Key: key })),
        Quiet: true,
      },
    }),
  );
}

module.exports = {
  ensureBucket,
  uploadObject,
  getObject,
  deleteObjects,
  bucket: S3_BUCKET,
};
