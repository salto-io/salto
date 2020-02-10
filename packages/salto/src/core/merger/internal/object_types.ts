/*
*                      Copyright 2020 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/
import _ from 'lodash'
import {
  ObjectType, ElemID, Field,
} from 'adapter-api'
import { logger } from '@salto/logging'
import { Keywords } from '../../../parser/language'
import {
  MergeResult, MergeError, mergeNoDuplicates, DuplicateAnnotationError,
} from './common'

const log = logger(module)

export abstract class FieldDefinitionMergeError extends MergeError {
  readonly parentID: string
  readonly fieldName: string
  readonly cause: string

  constructor(
    { elemID, parentID, fieldName, cause }:
      { elemID: ElemID; parentID: string; fieldName: string; cause: string },
  ) {
    super({ elemID, error: `Cannot merge '${parentID}': field '${fieldName}' ${cause}` })
    this.parentID = parentID
    this.fieldName = fieldName
    this.cause = cause
  }
}

export class NoBaseDefinitionMergeError extends FieldDefinitionMergeError {
  constructor(
    { elemID, parentID, fieldName }:
      { elemID: ElemID; parentID: string; fieldName: string }
  ) {
    super({ elemID, parentID, fieldName, cause: 'has no base definition' })
  }
}

export class MultipleBaseDefinitionsMergeError extends FieldDefinitionMergeError {
  readonly bases: Field[]
  constructor(
    { elemID, parentID, fieldName, bases }:
      { elemID: ElemID; parentID: string; fieldName: string; bases: Field[] }
  ) {
    super({ elemID, parentID, fieldName, cause: 'has multiple definitions' })
    this.bases = bases
  }
}

export class DuplicateAnnotationFieldDefinitionError extends FieldDefinitionMergeError {
  readonly annotationKey: string
  constructor(
    { elemID, parentID, fieldName, annotationKey }:
      { elemID: ElemID; parentID: string; fieldName: string; annotationKey: string }
  ) {
    super({ elemID, parentID, fieldName, cause: `has duplicate annotation key '${annotationKey}'` })
    this.annotationKey = annotationKey
  }
}

export class DuplicateAnnotationTypeError extends MergeError {
  readonly key: string

  constructor({ elemID, key }: { elemID: ElemID; key: string }) {
    super({ elemID, error: `duplicate annotation type '${key}'` })
    this.key = key
  }
}

const isUpdate = (
  definition: Field
): boolean => definition.type.elemID.name === Keywords.UPDATE_DEFINITION

// ensure exactly one base
const validateFieldBasesAndUpdates = (
  elemID: ElemID,
  definitions: Field[],
): { errors: MergeError[]; base: Field; updates: Field[]; fieldName: string; parentID: string } => {
  const [updates, bases] = _.partition(definitions, isUpdate)

  if (bases.length === 0) {
    // no bases - consider the first update the base
    const base = updates[0]
    const parentID = base.parentID.getFullName()
    const { name: fieldName } = base
    const error = new NoBaseDefinitionMergeError({ elemID, parentID, fieldName })

    return { errors: [error], base, updates: updates.slice(1), fieldName, parentID }
  }

  const base = bases[0]
  const parentID = base.parentID.getFullName()
  const { name: fieldName } = base

  if (bases.length > 1) {
    // multiple bases - consider the first as base and the rest as updates
    const error = new MultipleBaseDefinitionsMergeError({ elemID, parentID, fieldName, bases })
    return { errors: [error], base, updates: [...bases.slice(1), ...updates], fieldName, parentID }
  }

  return { errors: [], base, updates, fieldName, parentID }
}

const mergeFieldDefinitions = (
  elemID: ElemID,
  definitions: Field[]
): MergeResult<Field> => {
  const {
    errors: validationErrors, fieldName, parentID, base, updates,
  } = validateFieldBasesAndUpdates(elemID, definitions)

  if (updates.length === 0) {
    return {
      merged: base,
      errors: validationErrors,
    }
  }
  // Ensure each annotation value is updated at most once.
  const mergedUpdates = mergeNoDuplicates(
    updates.map(u => u.annotations),
    key => new DuplicateAnnotationFieldDefinitionError({
      elemID, parentID, fieldName, annotationKey: key,
    })
  )

  const annotations = _.merge({}, base.annotations, mergedUpdates.merged)

  return {
    merged: new Field(base.parentID, base.name, base.type, annotations, base.isList),
    errors: [
      ...validationErrors,
      ...mergedUpdates.errors,
    ],
  }
}

const mergeObjectDefinitions = (
  { elemID }: { elemID: ElemID },
  objects: ObjectType[],
): MergeResult<ObjectType> => {
  const fieldDefs: Record<string, Field[]> = {}
  objects.forEach(obj => {
    Object.keys(obj.fields).forEach(name => {
      const field = obj.fields[name]
      fieldDefs[name] = fieldDefs[name] ? [...fieldDefs[name], field] : [field]
    })
  })

  const fieldsMergeResults = _.mapValues(
    fieldDefs,
    (defs, key) => mergeFieldDefinitions(elemID.createNestedID('field', key), defs)
  )

  if (objects.length === 1) {
    return {
      merged: objects[0],
      errors: _.flatten(Object.values(fieldsMergeResults).map(r => r.errors)),
    }
  }
  // There are no rules in the spec on merging annotations and
  // annotations values so we simply merge without allowing duplicates
  const annotationTypesMergeResults = mergeNoDuplicates(
    objects.map(o => o.annotationTypes),
    key => new DuplicateAnnotationTypeError({ elemID, key }),
  )

  // There are no rules in the spec on merging annotations and
  // annotations values so we simply merge without allowing duplicates
  const annotationsMergeResults = mergeNoDuplicates(
    objects.map(o => o.annotations),
    key => new DuplicateAnnotationError({ elemID, key }),
  )

  return {
    merged: new ObjectType({
      elemID,
      fields: _.mapValues(fieldsMergeResults, r => r.merged),
      annotationTypes: annotationTypesMergeResults.merged,
      annotations: annotationsMergeResults.merged,
    }),
    errors: _.flatten([
      ...Object.values(fieldsMergeResults).map(r => r.errors),
      ...annotationTypesMergeResults.errors,
      ...annotationsMergeResults.errors,
    ]),
  }
}

/**
 * Merge all of the object types by dividing into groups according to elemID
 * and merging the defs
 */
export const mergeObjectTypes = (
  objectTypes: ObjectType[]
): MergeResult<Record<string, ObjectType>> => {
  const mergeResults = _(objectTypes)
    .groupBy(o => o.elemID.getFullName())
    .mapValues(group => mergeObjectDefinitions(group[0], group))
    .value()
  const merged = _.mapValues(mergeResults, r => r.merged)
  const errors = _.flatten(Object.values(mergeResults).map(r => r.errors))

  log.debug(`merged ${objectTypes.length} objects to ${_.size(merged)} elements [errors=${
    errors.length}]`)
  return { merged, errors }
}
