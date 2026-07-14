import { toAbsoluteImageUrl } from '@/utils/api';

type MiniProgramFileSystem = {
  writeFile(options: {
    filePath: string;
    data: ArrayBuffer;
    success: () => void;
    fail: (error: { errMsg?: string }) => void;
  }): void;
};

type MiniProgramRuntime = typeof uni & {
  env?: { USER_DATA_PATH?: string };
  getFileSystemManager?: () => MiniProgramFileSystem;
};

declare const wx: MiniProgramRuntime;

const pendingImages = new Map<string, Promise<string>>();

export function resolveImageForDisplay(source: string | undefined, fallback: string): Promise<string> {
  if (!source) return Promise.resolve(fallback);
  if (source.startsWith('/static/')) return Promise.resolve(source);

  const absoluteUrl = toAbsoluteImageUrl(source);
  if (isDevtools() || !absoluteUrl.startsWith('http://')) {
    return Promise.resolve(absoluteUrl);
  }

  const cached = pendingImages.get(absoluteUrl);
  if (cached) return cached;

  const task = downloadToLocalFile(absoluteUrl).catch((error) => {
    console.error('[product image cache failed]', absoluteUrl, error);
    return fallback;
  });
  pendingImages.set(absoluteUrl, task);
  return task;
}

function isDevtools(): boolean {
  try {
    return uni.getDeviceInfo().platform === 'devtools';
  } catch {
    return false;
  }
}

function downloadToLocalFile(url: string): Promise<string> {
  const runtime = typeof wx === 'undefined' ? (uni as MiniProgramRuntime) : wx;
  const userDataPath = runtime.env?.USER_DATA_PATH;
  const fileSystem = runtime.getFileSystemManager?.();
  if (!userDataPath || !fileSystem) {
    return Promise.reject(new Error('小程序文件系统不可用'));
  }

  const extension = imageExtension(url);
  const filePath = `${userDataPath}/moonisle-${stableHash(url)}${extension}`;

  return new Promise((resolve, reject) => {
    uni.request({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300 || !(response.data instanceof ArrayBuffer)) {
          reject(new Error(`图片请求失败：${response.statusCode}`));
          return;
        }
        fileSystem.writeFile({
          filePath,
          data: response.data,
          success: () => resolve(filePath),
          fail: (error) => reject(new Error(error.errMsg || '图片写入失败')),
        });
      },
      fail: (error) => reject(new Error(error.errMsg || '图片下载失败')),
    });
  });
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function imageExtension(url: string): string {
  const pathname = url.split('?')[0].toLowerCase();
  if (pathname.endsWith('.png')) return '.png';
  if (pathname.endsWith('.webp')) return '.webp';
  if (pathname.endsWith('.gif')) return '.gif';
  return '.jpg';
}
