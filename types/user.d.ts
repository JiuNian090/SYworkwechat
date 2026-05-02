export interface CloudUserInfo {
  userId: string;
  account: string;
  nickname: string;
  avatarType: string;
  avatarEmoji: string;
  avatarText: string;
}

export interface UserInfo {
  nickname: string;
  avatarType: string;
  avatarEmoji: string;
}

export interface UserLoginResult {
  success: boolean;
  data?: {
    userId: string;
    account: string;
    nickname: string;
    avatarType?: string;
    avatarEmoji?: string;
    avatarText?: string;
  };
  errMsg?: string;
}
