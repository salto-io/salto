import _ from 'lodash'

export class ConfigValidationError extends Error {}

const validateOneOf = <V, T extends V>(
  list: ReadonlyArray<T>, typeName: string, v: V
): T => {
  if (!list.includes(v as T)) {
    throw new ConfigValidationError(`Invalid ${typeName} "${v}", expected one of: ${list}`)
  }
  return v as T
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export const LOG_LEVELS: ReadonlyArray<LogLevel> = Object.freeze([
  // I don't know a way to prevent duplication of LogLevel without installing some pre-processor
  // Also, these need to be in increasing order of importance
  'debug', 'info', 'warn', 'error',
])

export const validateLogLevel = (
  l: string,
): LogLevel => validateOneOf(LOG_LEVELS, 'log level', l)

// Partial of ES6 Module
export type LoggingModule = {
  filename: string
}

export const isLoggingModule = (o: unknown): o is LoggingModule => typeof o === 'object'
  && Object.prototype.hasOwnProperty.call(o, 'filename')

export type Namespace = string

export type NamespaceOrModule = Namespace | LoggingModule

export const ROOT_NAMESPACE: Namespace = ''

export type EnabledForNamespaceChecker = (namespace: Namespace) => boolean

export type Format = 'json' | 'text'
export const FORMATS: ReadonlyArray<Format> = Object.freeze(['json', 'text'])
export const validateFormat = (f: string): Format => validateOneOf(FORMATS, 'log format', f)

export type Config = {
  minLevel: LogLevel
  filename: string | null
  format: Format
  enabledForNamespace: EnabledForNamespaceChecker
  colorize: boolean
}

export const DEFAULT_CONFIG: Config = Object.freeze({
  minLevel: 'warn',
  filename: null,
  format: 'text',
  enabledForNamespace: () => true,
  colorize: true,
})

export const mergeConfigs = (...configs: Partial<Config>[]): Config => _.defaults(
  {}, ...[DEFAULT_CONFIG, ...configs].reverse()
)

export const cloneConfig = (c: Readonly<Config>): Readonly<Config> => ({ ...c })

export type LogMethod = (message: string | Error, ...args: unknown[]) => void

export type BaseLogger = {
  log(level: LogLevel, ...rest: Parameters<LogMethod>): ReturnType<LogMethod>
}

export type BaseLoggerMaker = (namespace: Namespace) => BaseLogger

export type BaseLoggerRepo = BaseLoggerMaker & {
  configure(config: Readonly<Config>): void
  end(): void // Note: there is currently no way to wait for a logger to end; see tests
}

// indexed type - needs a separate definition
type HasLoggerFuncs = {
  [level in LogLevel]: LogMethod
}

export type Logger = BaseLogger & HasLoggerFuncs & {
  readonly namespace: Namespace
}

export type LoggerRepo = ((namespace: NamespaceOrModule) => Logger) & {
  configure(config: Readonly<Partial<Config>>): void
  readonly config: Readonly<Config>
  end(): void
}
