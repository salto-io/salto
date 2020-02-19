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
import {
  Values, isObjectType, TypeElement, ObjectType, PrimitiveType, Field, InstanceElement,
  Element, isType, isField, isInstanceElement, getChangeElement, Value, ElemID,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { DetailedChange } from 'src/core/plan'
import { ElementsSource } from '../../elements_source'

export class InvalidProjectionError extends Error {
  constructor(change: DetailedChange, reason: string) {
    super(`Can not project ${getChangeElement(change).elemID}: ${reason}`)
  }
}

const projectValue = (src: Value, target: Value): Value => {
  if (_.isPlainObject(src) && _.isPlainObject(target)) {
    const projection: Values = {}
    _.keys(src).forEach(key => {
      if (_.has(target, key)) {
        projection[key] = projectValue(src[key], target[key])
      }
    })
    return projection
  }
  return target !== undefined ? src : undefined
}

const projectType = (src: TypeElement, target: TypeElement): TypeElement | undefined => {
  const annotations = projectValue(src.annotations, target.annotations)
  const annotationTypes = _.pick(src.annotationTypes, _.keys(target.annotationTypes))
  if (isObjectType(src) && isObjectType(target)) {
    const fields = _.pick(src.fields, _.keys(target.fields))
    return _.isEmpty(annotations) && _.isEmpty(annotationTypes) && _.isEmpty(fields)
      ? undefined
      : new ObjectType({
        ...target,
        annotationTypes,
        annotations,
        fields,
        path: src.path,
      })
  }
  return _.isEmpty(annotations) && _.isEmpty(annotationTypes)
    ? undefined
    : new PrimitiveType({
      ...target as PrimitiveType,
      annotationTypes,
      annotations,
    })
}

const projectField = (src: Field, target: Field): Field | undefined => {
  if (src.isList !== target.isList) return src
  const annotations = projectValue(src.annotations, target.annotations)
  return _.isEmpty(annotations)
    ? undefined
    : new Field(src.parentID, src.name, src.type, annotations, src.isList)
}

const projectInstance = (
  src: InstanceElement,
  target: InstanceElement
): InstanceElement | undefined => {
  const projectedValue = projectValue(src.value, target.value)
  const projectedAnnotations = projectValue(src.annotations, target.annotations)
  return _.isEmpty(projectedValue)
    ? undefined
    : new InstanceElement(
      src.elemID.name,
      src.type,
      projectedValue,
      src.path,
      projectedAnnotations
    )
}

export const projectElementOrValueToEnv = async (
  value: Element | Value,
  id: ElemID,
  env: ElementsSource
): Promise<Element | undefined> => {
  const targetElement = await env.get(id)
  if (isType(value) && isType(targetElement)) {
    return projectType(value, targetElement)
  }
  if (isField(value) && isField(targetElement)) {
    return projectField(value, targetElement)
  }
  if (isInstanceElement(value) && isInstanceElement(targetElement)) {
    return projectInstance(value as InstanceElement, targetElement)
  }
  return projectValue(value, targetElement)
}

export const createAddChange = (
  value: Element | Value,
  id: ElemID,
  path?: string[]
): DetailedChange => ({
  data: { after: value },
  action: 'add',
  id,
  path,
})

export const createRemoveChange = (
  value: Element | Value,
  id: ElemID,
  path?: string[]
): DetailedChange => ({
  data: { before: value },
  action: 'remove',
  id,
  path,
})

export const createModifyChange = (
  before: Element | Value,
  after: Element | Value,
  id: ElemID,
  path?: string[]
): DetailedChange => ({
  data: { before, after },
  action: 'modify',
  id,
  path,
})

export const projectChange = async (
  change: DetailedChange,
  env: ElementsSource
): Promise<DetailedChange[]> => {
  const beforeProjection = change.action !== 'add'
    ? await projectElementOrValueToEnv(change.data.before, change.id, env)
    : undefined
  const afterProjection = change.action !== 'remove'
    ? await projectElementOrValueToEnv(change.data.after, change.id, env)
    : undefined
  if (change.action === 'add') {
    if (!_.isUndefined(afterProjection)) {
      throw new InvalidProjectionError(
        change,
        'can not project an add change to an existing env element.'
      )
    }
    return [change]
  }

  if (change.action === 'modify' && !_.isUndefined(beforeProjection) && !_.isUndefined(afterProjection)) {
    return [createModifyChange(beforeProjection, afterProjection, change.id, change.path)]
  }

  if (change.action === 'remove' && !_.isUndefined(beforeProjection)) {
    return [createRemoveChange(beforeProjection, change.id, change.path)]
  }
  return []
}
