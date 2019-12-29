import cliMain from './cli'
import { CredsSpec as CredsSpec_ } from './jest-environment/creds'

export { default as createEnvUtils } from './jest-environment/process_env'
export { default as JestEnvironment } from './jest-environment'
export type CredsSpec<TCreds> = CredsSpec_<TCreds>

export * from './types'
export const cli = { main: cliMain }
