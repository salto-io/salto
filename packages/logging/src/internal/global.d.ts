import { LogTags } from './log-tags'

declare global {
  namespace NodeJS {
    interface Global {
      globalLogTags: LogTags
    }
  }
}