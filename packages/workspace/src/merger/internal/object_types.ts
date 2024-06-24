/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { ObjectType, ElemID, Field } from '@salto-io/adapter-api'
import { MergeResult, MergeError, mergeNoDuplicates, DuplicateAnnotationError } from './common'

export abstract class FieldDefinitionMergeError extends MergeError {
  readonly cause: string

  constructor({ elemID, cause }: { elemID: ElemID; cause: string }) {
    super({
      elemID,
      error: `Cannot merge '${elemID.createParentID().getFullName()}': field '${elemID.name}' ${cause}`,
    })
    this.cause = cause
  }
}

export class DuplicateAnnotationFieldDefinitionError extends FieldDefinitionMergeError {
  readonly annotationKey: string
  constructor({ elemID, annotationKey }: { elemID: ElemID; annotationKey: string }) {
    super({ elemID, cause: `has duplicate annotation key '${annotationKey}'` })
    this.annotationKey = annotationKey
  }
}

export class ConflictingFieldTypesError extends FieldDefinitionMergeError {
  readonly definedTypes: string[]
  constructor({ elemID, definedTypes }: { elemID: ElemID; definedTypes: string[] }) {
    super({ elemID, cause: `has conflicting type definitions '${[...definedTypes.values()].join(', ')}'` })
    this.definedTypes = definedTypes
  }
}

export class ConflictingSettingError extends MergeError {
  constructor({ elemID }: { elemID: ElemID }) {
    super({ elemID, error: 'conflicting is settings definitions' })
  }
}

export class DuplicateAnnotationTypeError extends MergeError {
  readonly key: string

  constructor({ elemID, key }: { elemID: ElemID; key: string }) {
    super({ elemID, error: `duplicate annotation type '${key}'` })
    this.key = key
  }
}

const mergeFieldDefinitions = (elemID: ElemID, definitions: Field[]): MergeResult<Field> => {
  const [base] = definitions
  if (definitions.length === 1) {
    return { merged: base, errors: [] }
  }

  // Ensure each annotation value is updated at most once.
  const mergedAnnotations = mergeNoDuplicates(
    definitions.map(u => u.annotations),
    annotationKey => new DuplicateAnnotationFieldDefinitionError({ elemID, annotationKey }),
  )

  // Ensure all types are compatible
  const definedTypes = new Set(definitions.map(field => field.refType.elemID.getFullName()))
  const typeErrors =
    definedTypes.size === 1 ? [] : [new ConflictingFieldTypesError({ elemID, definedTypes: [...definedTypes] })]

  return {
    merged: base.clone(mergedAnnotations.merged),
    errors: [...mergedAnnotations.errors, ...typeErrors],
  }
}

const mergeObjectDefinitions = ({ elemID }: { elemID: ElemID }, objects: ObjectType[]): MergeResult<ObjectType> => {
  const fieldDefs = _(objects)
    .map(obj => Object.values(obj.fields))
    .flatten()
    .groupBy(field => field.name)
    .value()

  const fieldsMergeResults = _.mapValues(fieldDefs, (defs, key) =>
    mergeFieldDefinitions(elemID.createNestedID('field', key), defs),
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
    objects.map(o => o.annotationRefTypes),
    key => new DuplicateAnnotationTypeError({ elemID, key }),
  )

  // There are no rules in the spec on merging annotations and
  // annotations values so we simply merge without allowing duplicates
  const annotationsMergeResults = mergeNoDuplicates(
    objects.map(o => o.annotations),
    (key, existingValue, newValue) => new DuplicateAnnotationError({ elemID, key, existingValue, newValue }),
  )

  const refIsSettings = objects[0].isSettings
  const isSettingsErrors = _.every(objects, obj => obj.isSettings === refIsSettings)
    ? []
    : [new ConflictingSettingError({ elemID: objects[0].elemID })]

  return {
    merged: new ObjectType({
      elemID,
      fields: _.mapValues(fieldsMergeResults, r => r.merged),
      annotationRefsOrTypes: annotationTypesMergeResults.merged,
      annotations: annotationsMergeResults.merged,
      isSettings: refIsSettings,
    }),
    errors: _.flatten([
      ...Object.values(fieldsMergeResults).map(r => r.errors),
      ...annotationTypesMergeResults.errors,
      ...annotationsMergeResults.errors,
      ...isSettingsErrors,
    ]),
  }
}

/**
 * Merge all of the object types by dividing into groups according to elemID
 * and merging the defs
 */
export const mergeObjectTypes = (objectTypes: ObjectType[]): MergeResult<ObjectType> =>
  mergeObjectDefinitions(objectTypes[0], objectTypes)
