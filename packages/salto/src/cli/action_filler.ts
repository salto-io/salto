import _ from 'lodash'
import {
  Field, Type, isObjectType, isInstanceElement, PlanActionType,
  PlanAction, Values, ObjectType, InstanceElement,
} from 'adapter-api'

type ActionPrintFormatType = PlanActionType | 'eq'
export interface ActionPrintFormat {
  name: string
  action: ActionPrintFormatType
  subChanges: ActionPrintFormat[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: { before?: any; after?: any }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getActionType = (before: any, after: any): ActionPrintFormatType => {
  const hasBefore = _.isObject(before) ? !_.isEmpty(before) : !_.isUndefined(before)
  const hasAfter = _.isObject(after) ? !_.isEmpty(after) : !_.isUndefined(after)
  if (before === after) {
    return 'eq'
  }
  if (hasBefore && hasAfter) {
    return 'modify'
  }
  if (!hasBefore && hasAfter) {
    return 'add'
  }
  return 'remove'
}

const createValuesChanges = (before: Values, after: Values): ActionPrintFormat[] =>
  _.union(Object.keys(before), Object.keys(after)).map(name => {
    const action = getActionType(before[name], after[name])
    const subChanges = (_.isPlainObject(before[name]) || _.isPlainObject(after[name]))
      ? createValuesChanges(before[name] || {}, after[name] || {}) : []
    return {
      name, action, subChanges, data: { before: before[name], after: after[name] },
    }
  })

const createRecordChanges = (
  before: Record<string, Field|Type>,
  after: Record<string, Field|Type>
): ActionPrintFormat[] => _.union(Object.keys(before), Object.keys(after)).map(name => {
  const action = getActionType(before[name], after[name])
  const subChanges = createValuesChanges(
    (before[name]) ? before[name].getAnnotationsValues() : {},
    (after[name]) ? after[name].getAnnotationsValues() : {}
  )
  return {
    name, action, subChanges, data: { before, after },
  }
})

const createFromTypes = (
  before?: Type,
  after?: Type
): ActionPrintFormat => {
  const name = ((before || after) as Type).elemID.getFullName()
  const action = getActionType(before, after)
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
  const subChanges = [
    ...fieldChanges,
    ...annotationsChanges,
    ...annotationsValueChanges,
  ]
  return {
    name, action, subChanges, data: { before, after },
  }
}

const createFromInstanceElements = (
  before?: InstanceElement,
  after?: InstanceElement
): ActionPrintFormat => {
  const name = ((before || after) as InstanceElement).elemID.getFullName()
  const subChanges = createValuesChanges(
    (before) ? before.value : {},
    (after) ? after.value : {}
  )
  const action = getActionType(before, after)
  return {
    name, action, subChanges, data: { before, after },
  }
}

export const fillAction = (action: PlanAction): ActionPrintFormat => {
  const { before, after } = { ...action.data }
  if (isInstanceElement(before || after)) {
    return createFromInstanceElements(before as InstanceElement, after as InstanceElement)
  }
  return createFromTypes(before as Type, after as Type)
}
