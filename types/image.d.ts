export interface WeekImage {
  id: string;
  name: string;
  path: string;
  addedTime: string;
  hash?: string;
  updatedTime?: string;
}

export interface ImageRelation {
  [weekKey: string]: Array<{
    name: string;
    path: string;
    hash?: string;
    id?: string;
  }>;
}

export interface ImageUploadInfo {
  weekKey: string;
  image: WeekImage;
  yearMonth: string;
  imageName: string;
  remotePath: string;
}
