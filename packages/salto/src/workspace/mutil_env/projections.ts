import {
  Values, isObjectType, Type, ObjectType, PrimitiveType, Field, InstanceElement,
  Element, isType, isField, isInstanceElement, getChangeElement,
} from 'adapter-api'
import _ from 'lodash'
import { DetailedChange } from 'src/core/plan'
import { ElementsSource } from '../elements_source'

export class InvalidProjectionError extends Error {
  constructor(change: DetailedChange, reason: string) {
    super(`Can not project ${getChangeElement(change).elemID}: ${reason}`)
  }
}

const projectValues = (src: Values, target: Values): Values => {
  const projection: Values = {}
  _.keys(src).forEach(key => {
    if (target[key]) {
      projection[key] = _.isPlainObject(src[key])
        ? projectValues(src[key], target[key])
        : src[key]
    }
  })
  return projection
}

const projectType = (src: Type, target: Type): Type => {
  const annotations = projectValues(src.annotations, target.annotations)
  const annotationTypes = _.pick(src.annotationTypes, _.keys(target.annotationTypes))
  if (isObjectType(src) && isObjectType(target)) {
    const fields = _.pick(src.fields, _.keys(target.fields))
    return new ObjectType({
      annotationTypes,
      annotations,
      fields,
      ...target,
    })
  }
  return new PrimitiveType({
    annotationTypes,
    annotations,
    ...target as PrimitiveType,
  })
}

const projectField = (src: Field, target: Field): Field => {
  const annotations = projectValues(src.annotations, target.annotations)
  return new Field(src.parentID, src.name, src.type, annotations, src.isList)
}

const projectInstance = (
  src: InstanceElement,
  target: InstanceElement
): InstanceElement => new InstanceElement(
  src.elemID.name,
  src.type,
  projectValues(src.value, target.value)
)

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
  return undefined
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
