interface WxCloudCallFunctionParam {
  name: string;
  data?: Record<string, unknown>;
  config?: {
    env?: string;
    timeout?: number;
  };
}

interface WxCloudCallFunctionResult {
  result: Record<string, unknown>;
  errMsg: string;
}

interface WxCloudUploadFileParam {
  cloudPath: string;
  filePath: string;
  config?: {
    env?: string;
  };
}

interface WxCloudDownloadFileParam {
  fileID: string;
  config?: {
    env?: string;
  };
}

interface WxCloudDownloadFileResult {
  tempFilePath: string;
  statusCode: number;
}

interface CompressImageParam {
  src: string;
  quality?: number;
}

interface CompressImageSuccessResult {
  tempFilePath: string;
}

interface GetFileInfoParam {
  filePath: string;
}

interface GetFileInfoSuccessResult {
  size: number;
  mtime: string;
}

interface StorageInfo {
  keys: string[];
  currentSize: number;
  limitSize: number;
}
