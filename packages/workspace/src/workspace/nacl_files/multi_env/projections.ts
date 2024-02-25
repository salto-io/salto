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
import {
  Values,
  isObjectType,
  TypeElement,
  ObjectType,
  PrimitiveType,
  Field,
  InstanceElement,
  Element,
  isType,
  isField,
  isInstanceElement,
  getChangeData,
  Value,
  ElemID,
  DetailedChange,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData } from '@salto-io/adapter-utils'
import { ElementsSource } from '../../elements_source'

export class InvalidProjectionError extends Error {
  constructor(change: DetailedChange, reason: string) {
    super(`Can not project ${getChangeData(change).elemID}: ${reason}`)
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

const projectType = (src: TypeElement, target: TypeElement): TypeElement => {
  const annotations = projectValue(src.annotations, target.annotations)
  const annotationRefTypes = _.pick(src.annotationRefTypes, _.keys(target.annotationRefTypes))
  if (isObjectType(src) && isObjectType(target)) {
    const fields = _.pick(src.fields, _.keys(target.fields))
    return new ObjectType({
      ...src,
      annotationRefsOrTypes: annotationRefTypes,
      annotations,
      fields,
    })
  }
  return new PrimitiveType({
    ...(src as PrimitiveType),
    annotationRefsOrTypes: annotationRefTypes,
    annotations,
  })
}

const projectField = (src: Field, target: Field): Field => {
  if (!src.refType.elemID.isEqual(target.refType.elemID)) return src
  const annotations = projectValue(src.annotations, target.annotations)
  return _.isEmpty(annotations) ? target : new Field(target.parent, src.name, src.refType, annotations)
}

const projectInstance = (src: InstanceElement, target: InstanceElement): InstanceElement | undefined => {
  const projectedValue = projectValue(src.value, target.value)
  const projectedAnnotations = projectValue(src.annotations, target.annotations)
  return _.isEmpty(projectedValue) && _.isEmpty(projectedAnnotations)
    ? undefined
    : new InstanceElement(src.elemID.name, src.refType, projectedValue, src.path, projectedAnnotations)
}

export const projectElementOrValueToEnv = (
  value: Element | Value,
  targetElement: Element | Value,
): Element | Value | undefined => {
  if (isType(value) && isType(targetElement)) {
    return projectType(value, targetElement)
  }
  if (isField(value) && isField(targetElement)) {
    return projectField(value, targetElement)
  }
  if (isInstanceElement(value) && isInstanceElement(targetElement)) {
    return projectInstance(value, targetElement)
  }
  return projectValue(value, targetElement)
}

export const createAddChange = (value: Element | Value, id: ElemID, path?: ReadonlyArray<string>): DetailedChange => ({
  data: { after: value },
  action: 'add',
  id,
  path,
})

export const createRemoveChange = (
  value: Element | Value,
  id: ElemID,
  path?: ReadonlyArray<string>,
): DetailedChange => ({
  data: { before: value },
  action: 'remove',
  id,
  path,
})

export const projectChange = async (change: DetailedChange, env: ElementsSource): Promise<DetailedChange[]> => {
  const targetElement = await env.get(change.id)
  if (targetElement === undefined) {
    return change.action === 'add' ? [change] : []
  }
  if (change.action === 'add') {
    throw new InvalidProjectionError(change, 'can not project an add change to an existing env element.')
  }

  const projectedChange = await applyFunctionToChangeData(change, changeData =>
    projectElementOrValueToEnv(changeData, targetElement),
  )
  return [projectedChange]
}
