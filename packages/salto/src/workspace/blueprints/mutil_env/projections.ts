import {
  Values, isObjectType, TypeElement, ObjectType, PrimitiveType, Field, InstanceElement,
  Element, isType, isField, isInstanceElement, getChangeElement, Value,
} from 'adapter-api'
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
      if (target[key]) {
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
  return _.isEmpty(projectedValue)
    ? undefined
    : new InstanceElement(
      src.elemID.name,
      src.type,
      projectedValue
    )
}

export const projectElementToEnv = async (
  element: Element,
  env: ElementsSource
): Promise<Element | undefined> => {
  const targetElement = await env.get(element.elemID)
  if (isType(element) && isType(targetElement)) {
    return projectType(element, targetElement)
  }
  if (isField(element) && isField(targetElement)) {
    return projectField(element, targetElement)
  }
  if (isInstanceElement(element) && isInstanceElement(targetElement)) {
    return projectInstance(element as InstanceElement, targetElement)
  }
  return projectValue(element, targetElement)
}

export const createAddChange = (element: Element): DetailedChange => ({
  data: { after: element },
  action: 'add',
  id: element.elemID,
})

export const createRemoveChange = (element: Element): DetailedChange => ({
  data: { before: element },
  action: 'remove',
  id: element.elemID,
})

export const createModifyChange = (before: Element, after: Element): DetailedChange => ({
  data: { before, after },
  action: 'modify',
  id: before.elemID,
})

export const projectChange = async (
  change: DetailedChange,
  env: ElementsSource
): Promise<DetailedChange[]> => {
  const beforeProjection = change.action !== 'add'
    ? await projectElementToEnv(change.data.before, env)
    : undefined
  const afterProjection = change.action !== 'remove'
    ? await projectElementToEnv(change.data.after, env)
    : undefined
  if (change.action === 'add') {
    if (afterProjection) {
      throw new InvalidProjectionError(
        change,
        'can not project an add change to an existing env element.'
      )
    }
    return [change]
  }

  if (change.action === 'modify' && beforeProjection && afterProjection) {
    return [createModifyChange(beforeProjection, afterProjection)]
  }

  if (change.action === 'remove' && beforeProjection) {
    return [createRemoveChange(beforeProjection)]
  }
  return []
}
