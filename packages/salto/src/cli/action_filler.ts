import _ from 'lodash'
import {
  Field, Type, isObjectType, isInstanceElement, isEqualElements,
  PlanAction, Values, ObjectType, InstanceElement,
} from 'adapter-api'
import Prompts from './prompts'

export interface ActionLineFormat {
  name: string
  actionModifier: string
  subLines: ActionLineFormat[]
  value?: string
}

const exists = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any
): boolean => (_.isObject(value) ? !_.isEmpty(value) : !_.isUndefined(value))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const normalizeValuePrint = (value: any): string => {
  if (typeof value === 'string') {
    return `"${value}"`
  }
  if (Array.isArray(value)) {
    return `[${value.map(normalizeValuePrint)}]`
  }
  return JSON.stringify(value)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const createdActionStepValue = (before?: any, after?: any): string|undefined => {
  if (exists(before) && exists(after)) {
    return `${normalizeValuePrint(before)} => ${normalizeValuePrint(after)}`
  }
  return normalizeValuePrint(before || after)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getActionModifer = (before: any, after: any): string => {
  if (isEqualElements(before, after) || _.isEqual(before, after)) {
    return ' '
  }
  if (exists(before) && exists(after)) {
    return Prompts.MODIFIERS.modify
  }
  if (!exists(before) && exists(after)) {
    return Prompts.MODIFIERS.add
  }
  return Prompts.MODIFIERS.remove
}

const filterEQ = (
  actions: ActionLineFormat[]
): ActionLineFormat[] => actions.filter(a => a.actionModifier !== ' ')

const createValuesChanges = (before: Values, after: Values): ActionLineFormat[] =>
  _.union(Object.keys(before), Object.keys(after)).map(name => {
    const actionModifier = getActionModifer(before[name], after[name])
    const subLines = (_.isPlainObject(before[name]) || _.isPlainObject(after[name]))
      ? createValuesChanges(before[name] || {}, after[name] || {}) : []
    return {
      name,
      actionModifier,
      subLines: filterEQ(subLines),
      value: _.isEmpty(subLines) ? createdActionStepValue(before[name], after[name]) : undefined,
    }
  })

const createRecordChanges = (
  before: Record<string, Field|Type>,
  after: Record<string, Field|Type>
): ActionLineFormat[] => _.union(Object.keys(before), Object.keys(after)).map(name => {
  const actionModifier = getActionModifer(before[name], after[name])
  const subLines = createValuesChanges(
    (before[name]) ? before[name].getAnnotationsValues() : {},
    (after[name]) ? after[name].getAnnotationsValues() : {}
  )
  return {
    name,
    actionModifier,
    subLines: filterEQ(subLines),
  }
})

const createFromTypes = (
  before?: Type,
  after?: Type
): ActionLineFormat => {
  const name = ((before || after) as Type).elemID.getFullName()
  const actionModifier = getActionModifer(before, after)
  const annotationsValueChanges = createValuesChanges(
    (before) ? before.getAnnotationsValues() : {},
    (after) ? after.getAnnotationsValues() : {}
  )
  const annotationsChanges = createRecordChanges(
    (before) ? before.annotations : {},
    (after) ? after.annotations : {}
  )
  const fieldChanges = isObjectType(before || after)
    ? createRecordChanges(
      (before) ? (before as ObjectType).fields : {},
      (after) ? (after as ObjectType).fields : {}
    ) : []
  const subLines = [
    ...fieldChanges,
    ...annotationsChanges,
    ...annotationsValueChanges,
  ]

  return {
    name,
    actionModifier,
    subLines: filterEQ(subLines),
  }
}

const createFromInstanceElements = (
  before?: InstanceElement,
  after?: InstanceElement
): ActionLineFormat => {
  const name = ((before || after) as InstanceElement).elemID.getFullName()
  const subLines = createValuesChanges(
    (before) ? before.value : {},
    (after) ? after.value : {}
  )
  const actionModifier = getActionModifer(before, after)
  return {
    name,
    actionModifier,
    subLines: filterEQ(subLines),
  }
}

export const formatAction = (action: PlanAction): ActionLineFormat => {
  const { before, after } = { ...action.data }
  if (isInstanceElement(before || after)) {
    return createFromInstanceElements(before as InstanceElement, after as InstanceElement)
  }
  return createFromTypes(before as Type, after as Type)
}
