import * as v from './src/core/validator'
import * as f from './src/file'
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace validator {
  export type ValidationError = v.ValidationError
  export type InvalidValueTypeValidationError = v.InvalidValueTypeValidationError
  export type InvalidValueValidationError = v.InvalidValueValidationError
  export type MissingRequiredFieldValidationError = v.MissingRequiredFieldValidationError
  export const {
    validateElements,
    ValidationError,
    InvalidValueTypeValidationError, InvalidValueValidationError,
    MissingRequiredFieldValidationError,
  } = v
}

export { Plan, PlanItem, DetailedChange } from './src/core/plan'
export { dumpCsv, readCsvFromStream } from './src/core/csv'
export { FetchChange, FetchProgressEvents, StepEmitter, MergeErrorWithElements as MergeError } from './src/core/fetch'
export * from './src/api'
export { FoundSearchResult, SearchResult } from './src/core/search'
export { ItemStatus } from './src/core/deploy'
export { getAdaptersConfigType } from './src/core/adapters/adapters'
export {
  Workspace, WorkspaceError, SourceFragment,
} from './src/workspace/workspace'
export { Errors } from './src/workspace/errors'
export { Blueprint } from './src/workspace/blueprints/blueprints_source'
export { Config, loadConfig, addServiceToConfig } from './src/workspace/config'
export { parse, SourceMap, SourceRange, parseElemID } from './src/parser/parse'
export { dumpElements, dumpElemID } from './src/parser/dump'
export { readAllCsvContents } from './test/common/helpers'
export { SALTO_HOME_VAR } from './src/workspace/config'

export const file = f
