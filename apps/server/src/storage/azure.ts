import { BlobServiceClient, type ContainerClient } from '@azure/storage-blob';
import type { PhotoStore } from './index.js';

/** Azure Blob Storage. Container riêng tư (không public). Không có test tự động — thử tay khi lên Azure. */
export function azureStore(connectionString: string, container = 'photos'): PhotoStore {
  const client = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(container);
  let ready: Promise<ContainerClient> | undefined;
  // Tạo container lười, một lần (không đặt access → riêng tư).
  const c = () => (ready ??= client.createIfNotExists().then(
    () => client,
    (e) => {
      ready = undefined; // lần sau thử lại, không giữ lỗi tạm thời mãi
      throw e;
    },
  ));
  const isNotFound = (e: unknown) => (e as { statusCode?: number }).statusCode === 404;
  return {
    async put(key, data) {
      await (await c()).getBlockBlobClient(key).uploadData(data, { blobHTTPHeaders: { blobContentType: 'image/webp' } });
    },
    async get(key) {
      try {
        return await (await c()).getBlobClient(key).downloadToBuffer();
      } catch (e) {
        if (isNotFound(e)) return null;
        throw e;
      }
    },
    async delete(key) { await (await c()).getBlobClient(key).deleteIfExists(); },
    async copy(from, to) {
      const cc = await c();
      const poller = await cc.getBlobClient(to).beginCopyFromURL(cc.getBlobClient(from).url);
      await poller.pollUntilDone();
    },
  };
}
