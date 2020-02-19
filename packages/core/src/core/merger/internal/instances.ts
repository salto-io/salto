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
  InstanceElement, ElemID, ObjectType, TypeElement, Values, isObjectType, CORE_ANNOTATIONS,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import {
  MergeResult, MergeError, mergeNoDuplicates, DuplicateAnnotationError,
} from './common'

const log = logger(module)

export class DuplicateInstanceKeyError extends MergeError {
  readonly key: string

  constructor({ elemID, key }: { elemID: ElemID; key: string }) {
    super({ elemID, error: `duplicate key ${key}` })
    this.key = key
  }
}

const buildDefaults = (
  type: TypeElement
): Values | undefined => {
  const buildObjectDefaults = (object: ObjectType): Values | undefined => {
    const def = _(object.fields).mapValues(field =>
      ((field.annotations[CORE_ANNOTATIONS.DEFAULT] === undefined && !field.isList)
        ? buildDefaults(field.type)
        : field.annotations[CORE_ANNOTATIONS.DEFAULT])).pickBy(v => v !== undefined).value()
    return _.isEmpty(def) ? undefined : def
  }

  return (type.annotations[CORE_ANNOTATIONS.DEFAULT] === undefined && isObjectType(type)
    ? buildObjectDefaults(type)
    : type.annotations[CORE_ANNOTATIONS.DEFAULT])
}

const mergeInstanceDefinitions = (
  { elemID, type }: { elemID: ElemID; type: ObjectType },
  instanceDefs: InstanceElement[]
): MergeResult<InstanceElement> => {
  const valueMergeResult = instanceDefs.length > 1 ? mergeNoDuplicates(
    instanceDefs.map(i => i.value),
    key => new DuplicateInstanceKeyError({ elemID, key }),
  ) : {
    merged: instanceDefs[0].value,
    errors: [],
  }

  const annotationsMergeResults = mergeNoDuplicates(
    instanceDefs.map(o => o.annotations),
    key => new DuplicateAnnotationError({ elemID, key }),
  )

  const defaults = buildDefaults(type)
  const valueWithDefault = !_.isEmpty(defaults)
    ? _.merge({}, defaults || {}, valueMergeResult.merged)
    : valueMergeResult.merged
  return {
    merged: new InstanceElement(
      elemID.name, type, valueWithDefault, undefined, annotationsMergeResults.merged,
    ),
    errors: [...valueMergeResult.errors, ...annotationsMergeResults.errors],
  }
}

export const mergeInstances = (
  instances: InstanceElement[]
): MergeResult<InstanceElement[]> => {
  const mergeResults = _(instances)
    .groupBy(i => i.elemID.getFullName())
    .map(elementGroup => mergeInstanceDefinitions(elementGroup[0], elementGroup))
    .value()

  const merged = mergeResults.map(r => r.merged)
  const errors = _.flatten(mergeResults.map(r => r.errors))
  log.debug(`merged ${instances.length} instances to ${merged.length} elements [errors=${
    errors.length}]`)
  return { merged, errors }
}
