import { LogTags } from './log-tags'

declare global {
  namespace NodeJS {
    interface Global {
      globalLogTags: LogTags
      // TODO: Use middleware type here
      globalLogTimeMiddleware: <T>(inner: () => T | Promise<T>, desc: string) => T | Promise<T>
    }
  }
}