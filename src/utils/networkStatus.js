export const OFFLINE_WRITE_MESSAGE = '通信が切れています。入力内容は残っているので、接続が戻ってからもう一度お試しください。';

export const isBrowserOnline = (navigatorLike = globalThis.navigator) => (
    navigatorLike?.onLine !== false
);
