declare function App<T extends Record<string, any>>(options: T & WechatMiniprogram.App.Options<T>): void;

declare function Page<T extends Record<string, any>>(
  options: T & WechatMiniprogram.Page.Options<Record<string, any>, Record<string, any>>
): void;

declare function Component<T extends Record<string, any>>(
  options: T & WechatMiniprogram.Component.Options<Record<string, any>, Record<string, any>, Record<string, any>, Record<string, any>>
): void;

declare function Behavior<T extends Record<string, any>>(options: T): T;

declare function getApp<T = Record<string, any>>(): T;
