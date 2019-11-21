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
export { dumpCsv, readCsv } from './src/core/csv'
export { FetchChange, FetchProgressEvents, StepEmitter, MergeErrorWithElements as MergeError } from './src/core/fetch'
export * from './src/api'
export { FoundSearchResult, SearchResult } from './src/core/search'
// ParsedBlueprint and Blueprint are exported with an alias to avoid
// conflict with the Blueprint and ParsedBlueprint from ./src/core/blueprint
// which are still used. See: SALTO-205
export {
  Workspace, Blueprint, Errors, ParsedBlueprint, ParsedBlueprintMap,
  WorkspaceError, SourceFragment, WorkspaceErrorSeverity,
} from './src/workspace/workspace'
export { Config, loadConfig } from './src/workspace/config'
export { SourceMap, SourceRange, parseElemID } from './src/parser/parse'
export { dump, dumpElemID } from './src/parser/dump'

export const file = f
