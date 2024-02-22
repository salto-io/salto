import { LogTags } from './log-tags'
import { LogTimeDecorator } from './log-time-decorator'

declare global {
  namespace NodeJS {
    interface Global {
      globalLogTags: LogTags
      globalLogTimeDecorator: LogTimeDecorator
    }
  }
}
