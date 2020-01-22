import _ from 'lodash'
import { logger } from '@salto/logging'
import { Element } from 'adapter-api'
import { types } from '@salto/lowerdash'
import { mergeElements, MergeError } from '../core/merger'
import { validateElements, ValidationError } from '../core/validator'
import { saltoConfigType } from './config'
import { ParseError } from '../parser/parse'


const log = logger(module)

export class Errors extends types.Bean<Readonly<{
  parse: ReadonlyArray<ParseError>
  merge: ReadonlyArray<MergeError>
  validation: ReadonlyArray<ValidationError>
}>> {
  hasErrors(): boolean {
    return [this.parse, this.merge, this.validation].some(errors => errors.length > 0)
  }

  strings(): ReadonlyArray<string> {
    return [
      ...this.parse.map(error => error.detail),
      ...this.merge.map(error => error.error),
      ...this.validation.map(error => error.error),
    ]
  }
}

export type ParsedBlueprint = {
  filename: string
  elements: Element[]
  errors: ParseError[]
  timestamp: number
}

export type ParsedBlueprintMap = {
  [key: string]: ParsedBlueprint
}

export type BlueprintsState = {
  readonly parsedBlueprints: ParsedBlueprintMap
  readonly elements: ReadonlyArray<Element>
  readonly errors: Errors
  readonly elementsIndex: Record<string, string[]>
}

export const blueprintState = (blueprints: ParsedBlueprint[]):
BlueprintsState => {
  const bpsElements = _.flatten(blueprints.map(bp => bp.elements))
  const { merged: elements, errors: mergeErrors } = mergeElements(bpsElements)
  elements.push(saltoConfigType)
  const parsedBlueprints: ParsedBlueprintMap = _.keyBy(blueprints, 'filename')
  log.info('workspace has %d elements and %d parsed blueprints', elements.length,
    _.size(parsedBlueprints))

  const elementsIndex: Record<string, string[]> = {}
  blueprints.forEach(bp => bp.elements.forEach(e => {
    const key = e.elemID.getFullName()
    elementsIndex[key] = elementsIndex[key] || []
    elementsIndex[key] = _.uniq([...elementsIndex[key], bp.filename])
  }))

  const errors = new Errors({
    parse: Object.freeze(_.flatten(blueprints.map(bp => bp.errors))),
    merge: mergeErrors,
    validation: validateElements(elements),
  })
  if (errors.hasErrors()) {
    log.warn('workspace has %d parse errors, %d merge errors and %d validations errors',
      errors.parse.length, errors.merge.length, errors.validation.length)
  }

  return {
    parsedBlueprints,
    elements,
    errors,
    elementsIndex,
  }
}
