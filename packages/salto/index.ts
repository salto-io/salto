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
export {
  Workspace, Blueprint, Errors, ParsedBlueprintMap,
  WorkspaceError, SourceFragment, WorkspaceErrorSeverity,
  ResolvedParsedBlueprint as ParsedBlueprint,
} from './src/workspace/workspace'
export { Config, loadConfig } from './src/workspace/config'
export { SourceMap, SourceRange, parseElemID } from './src/parser/parse'
export { dump, dumpElemID } from './src/parser/dump'
export { readAllCsvContents } from './test/common/helpers'
export { deserialize } from './src/serializer/elements'
export const file = f
