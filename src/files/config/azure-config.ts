import { BlobServiceClient } from '@azure/storage-blob';

const getBlobServiceInstance = async () => {
  const blobService = await BlobServiceClient.fromConnectionString(
    process.env.CONNECTION_STRING,
  );
  return blobService;
};
export const getContainerClient = async () => {
  const blobService = await getBlobServiceInstance();
  const containerClient = blobService.getContainerClient(
    process.env.AZURE_CONTAINER_NAME,
  );
  return containerClient;
};
