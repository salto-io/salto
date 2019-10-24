import _ from 'lodash'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export const LOG_LEVELS: ReadonlyArray<LogLevel> = Object.freeze([
  // I don't know a way to prevent duplication of LogLevel without installing some pre-processor
  // Also, these need to be in increasing order of importance
  'debug', 'info', 'warn', 'error',
])

// Partial of ES6 Module
export type LoggingModule = {
  filename: string
}

export const isLoggingModule = (o: unknown): o is LoggingModule => typeof o === 'object'
  && Object.prototype.hasOwnProperty.call(o, 'filename')

export type Namespace = string

export type NamespaceOrModule = Namespace | LoggingModule

export const ROOT_NAMESPACE: Namespace = 'root'

export type EnabledForNamespaceChecker = (namespace: Namespace) => boolean

export type Format = 'json' | 'text'
export const VALID_FORMATS = Object.freeze(['json', 'text'])
export const validateFormat = (f: string): Format => {
  if (!VALID_FORMATS.includes(f)) {
    throw new Error(`Invalid log format "${f}", expected one of: ${VALID_FORMATS}`)
  }
  return f as Format
}

export type Config = {
  minLevel: LogLevel
  filename: string | null
  format: Format
  enabledForNamespace: EnabledForNamespaceChecker
}

export const DEFAULT_CONFIG: Config = Object.freeze({
  minLevel: 'warn',
  filename: null,
  format: 'text',
  enabledForNamespace: () => true,
})

export const mergeConfigs = (...configs: Partial<Config>[]): Config => _.defaults(
  {}, ...[DEFAULT_CONFIG, ...configs].reverse()
)

export type BasicLogger = {
  log(level: LogLevel, message: string | Error, ...args: unknown[]): void
  end(): void // Note: there is currently no way to wait for a logger to end; see tests
  child: (namespace: Namespace) => BasicLogger
  configure(config: Partial<Config>): void
}
