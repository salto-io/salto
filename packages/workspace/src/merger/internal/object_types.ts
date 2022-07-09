/*
*                      Copyright 2022 Salto Labs Ltd.
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
  ObjectType, ElemID, Field, getTopLevelPath,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import {
  MergeResult, MergeError, mergeNoDuplicates, DuplicateAnnotationError,
} from './common'

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
  constructor(
    { elemID, annotationKey }:
      { elemID: ElemID; annotationKey: string }
  ) {
    super({ elemID, cause: `has duplicate annotation key '${annotationKey}'` })
    this.annotationKey = annotationKey
  }
}

export class ConflictingFieldTypesError extends FieldDefinitionMergeError {
  readonly definedTypes: string[]
  constructor(
    { elemID, definedTypes }:
      { elemID: ElemID; definedTypes: string[] }
  ) {
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

// TODO: not sure about this one
const mergeFieldDefinitions = (
  elemID: ElemID,
  definitions: Field[]
): MergeResult<Field> => {
  const [base] = definitions
  if (definitions.length === 1) {
    return {
      merged: base,
      errors: [],
      pathIndex: base.pathIndex,
    }
  }

  // Ensure each annotation value is updated at most once.
  const mergedAnnotations = mergeNoDuplicates({
    sources: definitions
      .map(u => ({ source: u.annotations, pathIndex: u.pathIndex })),
    errorCreator: annotationKey =>
      new DuplicateAnnotationFieldDefinitionError({ elemID, annotationKey }),
    baseId: elemID,
  })

  // Ensure all types are compatible
  const definedTypes = new Set(definitions.map(field => field.refType.elemID.getFullName()))
  const typeErrors = definedTypes.size === 1
    ? []
    : [new ConflictingFieldTypesError({ elemID, definedTypes: [...definedTypes] })]

  return {
    merged: base.clone(mergedAnnotations.merged),
    errors: [
      ...mergedAnnotations.errors,
      ...typeErrors,
    ],
    pathIndex: mergedAnnotations.pathIndex,
  }
}

const mergeObjectDefinitions = (
  { elemID }: ObjectType,
  objects: ObjectType[],
): MergeResult<ObjectType> => {
  const fieldDefs = _(objects)
    .map(obj => Object.values(obj.fields)
      .map(field => {
        field.pathIndex = obj.pathIndex
          ? collections.treeMap.TreeMap.getTreeMapOfId(obj.pathIndex, field.elemID.getFullName())
          : undefined
        return field
      }))
    .flatten()
    .groupBy(field => field.name)
    .value()

  const fieldsMergeResults = _.mapValues(
    fieldDefs,
    (defs, key) => mergeFieldDefinitions(elemID.createNestedID('field', key), defs)
  )

  if (objects.length === 1) {
    return {
      merged: objects[0],
      errors: _.flatten(Object.values(fieldsMergeResults).map(r => r.errors)),
      pathIndex: objects[0].pathIndex,
    }
  }
  // There are no rules in the spec on merging annotations and
  // annotations values so we simply merge without allowing duplicates
  const annotationTypesMergeResults = mergeNoDuplicates({
    sources: objects.map(o => ({ source: o.annotationRefTypes, pathIndex: o.pathIndex })),
    errorCreator: key => new DuplicateAnnotationTypeError({ elemID, key }),
    baseId: elemID.createNestedID('annotation'),
  })

  // There are no rules in the spec on merging annotations and
  // annotations values so we simply merge without allowing duplicates
  const annotationsMergeResults = mergeNoDuplicates({
    sources: objects.map(o => ({ source: o.annotations, pathIndex: o.pathIndex })),
    errorCreator: (key, existingValue, newValue) =>
      new DuplicateAnnotationError({ elemID, key, existingValue, newValue }),
    baseId: elemID.createNestedID('attr'),
  })

  const refIsSettings = objects[0].isSettings
  const isSettingsErrors = _.every(objects, obj => obj.isSettings === refIsSettings)
    ? []
    : [new ConflictingSettingError({ elemID: objects[0].elemID })]

  const objTypeWithPath = objects.find(obj => !_.isEmpty(getTopLevelPath(obj)))
  const objPathIndex = new collections.treeMap.TreeMap<string>([
    ...((objTypeWithPath
      ? [[elemID.getFullName(), getTopLevelPath(objTypeWithPath)]]
      : []) as [string, string[]][]),
    ...Object.values(fieldsMergeResults)
      .map(mergeRes => Array.from(mergeRes.pathIndex?.entries() ?? [])).flat(),
    ...(annotationsMergeResults.pathIndex?.entries() ?? []),
    ...(annotationTypesMergeResults.pathIndex?.entries() ?? []),
  ])

  return {
    merged: new ObjectType({
      elemID,
      fields: _.mapValues(fieldsMergeResults, r => r.merged),
      annotationRefsOrTypes: annotationTypesMergeResults.merged,
      annotations: annotationsMergeResults.merged,
      isSettings: refIsSettings,
      path: objPathIndex,
    }),
    errors: _.flatten([
      ...Object.values(fieldsMergeResults).map(r => r.errors),
      ...annotationTypesMergeResults.errors,
      ...annotationsMergeResults.errors,
      ...isSettingsErrors,
    ]),
    pathIndex: objPathIndex,
  }
}

/**
 * Merge all of the object types by dividing into groups according to elemID
 * and merging the defs
 */
export const mergeObjectTypes = (
  objectTypes: ObjectType[]
): MergeResult<ObjectType> => mergeObjectDefinitions(objectTypes[0], objectTypes)
