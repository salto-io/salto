import { LogTags } from './log-tags'
import { LogTimeDecorator } from './log-time-decorator'

declare global {
  namespace globalThis {
    var globalLogTags: LogTags
    var globalLogTimeDecorator: LogTimeDecorator
  }
}
