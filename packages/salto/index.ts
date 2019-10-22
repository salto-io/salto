// TODO: namespaces will not be needed when the imported modules will
// only export the required members and keep the rest at an "internals" subdirectory
/* eslint-disable @typescript-eslint/no-namespace */

import * as v from './src/core/validator'
import * as bp from './src/core/blueprint'
import * as ws from './src/workspace/workspace'
import * as p from './src/core/plan'
import * as m from './src/core/merger'
import * as ap from './src/api'
import * as cs from './src/core/csv'
import * as s from './src/state/state'
import * as srch from './src/core/search'
import * as pa from './src/parser/parse'
import * as du from './src/parser/dump'

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

export namespace merger {
  export const { mergeElements } = m
}

// TODO: api is incosistent with the rest of the namespaces.
// Either move stuff like api.plan to plan or vice versa.
export const api = ap

export namespace csv {
  export const { dumpCsv, readCsv } = cs
}

export namespace state {
  export const { STATEPATH } = s
}

export namespace parser {
  export type SourceMap = pa.SourceMap
  export const { parse } = pa
  export const { dump } = du
}

export namespace blueprints {
  export type ParsedBlueprint = bp.ParsedBlueprint
  export type Blueprint = bp.Blueprint

  export const { loadBlueprints, parseBlueprints, dumpBlueprints } = bp
}

export namespace workspace {
  export type Blueprint = ws.Blueprint
  export type ParsedBlueprint = ws.ParsedBlueprint
  export type Workspace = ws.Workspace
  export type Errors = ws.Errors
  export type ParsedBlueprintMap = ws.ParsedBlueprintMap

  export const { Workspace, Errors } = ws
}

export namespace plan {
  export type PlanItem = p.PlanItem
  export type Plan = p.Plan
  export type DetailedChange = p.DetailedChange
}

export namespace search {
  export type FoundSearchResult = srch.FoundSearchResult
  export type SearchResult = srch.SearchResult
}
