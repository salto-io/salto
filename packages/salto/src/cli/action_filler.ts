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
  if (before && after) {
    return (_.isEqual(before, after)) ? 'eq' : 'modify'
  }
  if (!before && after) {
    return 'add'
  }
  return 'remove'
}

const createValuesChanges = (before: Values, after: Values): ActionPrintFormat[] =>
  Object.keys(before).concat(Object.keys(after)).map(name => {
    const action = getActionType(before[name], after[name])
    const subChanges = (_.isPlainObject(before[name]) || _.isPlainObject(after[name]))
      ? createValuesChanges(before[name] || {}, after[name] || {}) : []
    return {
      name, action, subChanges, data: { before, after },
    }
  })

const createRecordChanges = (
  before: Record<string, Field|Type>,
  after: Record<string, Field|Type>
): ActionPrintFormat[] => Object.keys(before).concat(Object.keys(after)).map(name => {
  const action = getActionType(before, after)
  const subChanges = createValuesChanges(
    (before[name]) ? before[name].annotationsValues : {},
    (after[name]) ? after[name].annotationsValues : {}
  )
  return {
    name, action, subChanges, data: { before, after },
  }
})

const createFromObjectTypes = (
  before?: ObjectType,
  after?: ObjectType
): ActionPrintFormat => {
  const name = ((before || after) as ObjectType).elemID.getFullName()
  const action = getActionType(before, after)
  const annotationsValueChanges = createValuesChanges(
    (before) ? before.annotationsValues : {},
    (after) ? after.annotationsValues : {}
  )
  const annotationsChanges = createRecordChanges(
    (before) ? before.annotations : {},
    (after) ? after.annotations : {}
  )
  const fieldChanges = createRecordChanges(
    (before) ? before.fields : {},
    (after) ? after.fields : {}
  )
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
  if (isObjectType(before || after)) {
    return createFromObjectTypes(before as ObjectType, after as ObjectType)
  }
  if (isInstanceElement(before || after)) {
    return createFromInstanceElements(before as InstanceElement, after as InstanceElement)
  }

  throw new Error('unsupported fill action operation')
}
