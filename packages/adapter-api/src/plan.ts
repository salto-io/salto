import * as _ from 'lodash'
import {
  Type, isListType, isObjectType, Values, Element, isType, isInstanceElement, InstanceElement,
} from './elements'

type NullableType = Type | null | undefined
type NullableElement = Element | null | undefined
type NullableInstanceElement = InstanceElement | null | undefined
export enum PlanActionType {
  ADD,
  MODIFY,
  REMOVE,
}

export class PlanAction {
  name: string
  actionType: PlanActionType
  subChanges: PlanAction[]
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  newValue: any
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  oldValue: any
  constructor(
    name: string,
    actionType: PlanActionType,
    subChanges?: PlanAction[],
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    newValue?: any,
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    oldValue?: any,
  ) {
    this.name = name
    this.actionType = actionType
    this.subChanges = subChanges || []
    this.newValue = newValue
    this.oldValue = oldValue
  }

  private static createValuesChanges(oldValues: Values, newValues: Values): PlanAction[] {
    const allKeys = Object.keys(oldValues).concat(Object.keys(newValues))

    return allKeys.map(k => {
      let actionType
      if (oldValues[k] && newValues[k]) {
        actionType = PlanActionType.MODIFY
      } else if (!oldValues[k] && newValues[k]) {
        actionType = PlanActionType.ADD
      } else {
        actionType = PlanActionType.REMOVE
      }
      const subChanges = (_.isPlainObject(oldValues[k]) || _.isPlainObject(newValues[k]))
        ? PlanAction.createValuesChanges(oldValues[k] || {}, newValues[k] || {}) : []
      return new PlanAction(k, actionType, subChanges, newValues[k], oldValues[k])
    })
  }


  private static fillActionPlanWithType(
    element: Type,
    actionType: PlanActionType,
    name: string,
  ): PlanAction {
    const newValue = (actionType === PlanActionType.ADD) ? element : undefined
    const oldValue = (actionType === PlanActionType.REMOVE) ? element : undefined

    const annotationFill = Object.keys(element.annotations).map(
      key => PlanAction.fillActionPlanWithType(element.annotations[key], actionType, key),
    )

    const valuesFill = (actionType === PlanActionType.ADD)
      ? PlanAction.createValuesChanges({}, element.annotationsValues)
      : PlanAction.createValuesChanges(element.annotationsValues, {})

    const baseFill = annotationFill.concat(valuesFill)

    if (isObjectType(element)) {
      const fieldChanges = Object.keys(element.fields).map(
        key => PlanAction.fillActionPlanWithType(element.fields[key].type, actionType, key),
      )
      const subChanges = baseFill.concat(fieldChanges)
      return new PlanAction(name, actionType, subChanges, newValue, oldValue)
    }

    if (isListType(element) && element.elementType) {
      return PlanAction.fillActionPlanWithType(element.elementType, actionType, name)
    }

    return new PlanAction(name, actionType, baseFill, newValue, oldValue)
  }

  private static createFromTypes(
    oldValue: NullableType,
    newValue: NullableType,
    name: string,
  ): PlanAction {
    if (oldValue && !newValue) {
      return PlanAction.fillActionPlanWithType(oldValue, PlanActionType.REMOVE, name)
    }

    if (!oldValue && newValue) {
      return PlanAction.fillActionPlanWithType(newValue, PlanActionType.ADD, name)
    }

    if (isListType(oldValue) && isListType(newValue)) {
      return PlanAction.createFromElements(oldValue.elementType, newValue.elementType, name)
    }

    if (oldValue && newValue) {
      const actionType = PlanActionType.MODIFY
      const annotationChanges = Object.keys(oldValue.annotations).map(
        key => PlanAction.createFromElements(
          oldValue.annotations[key],
          newValue.annotations[key],
          key,
        ),
      )

      const fieldChanges = (isObjectType(oldValue) && isObjectType(newValue))
        ? Object.keys(oldValue.fields).map(
          key => PlanAction.createFromElements(
            oldValue.fields[key].type, newValue.fields[key].type, key
          ),
        ) : []

      const valuesChanges = PlanAction.createValuesChanges(
        oldValue.annotationsValues,
        newValue.annotationsValues,
      )
      const subChanges = annotationChanges.concat(fieldChanges).concat(valuesChanges)
      return new PlanAction(name, actionType, subChanges, newValue, oldValue)
    }

    throw new Error('At least one element has to be defined')
  }

  private static createFromInstanceElement(
    oldValue: NullableInstanceElement,
    newValue: NullableInstanceElement,
    name: string,
  ): PlanAction {
    if (!oldValue && newValue) {
      const subChanges = PlanAction.createValuesChanges({}, newValue.value)
      return new PlanAction(name, PlanActionType.ADD, subChanges, newValue, oldValue)
    }
    if (oldValue && !newValue) {
      const subChanges = PlanAction.createValuesChanges(oldValue.value, {})
      return new PlanAction(name, PlanActionType.REMOVE, subChanges, newValue, oldValue)
    }
    if (oldValue && newValue) {
      const subChanges = PlanAction.createValuesChanges(oldValue.value, newValue.value)
      return new PlanAction(name, PlanActionType.MODIFY, subChanges, newValue, oldValue)
    }
    throw new Error('At least one element has to be defined')
  }

  static createFromElements(
    oldValue: NullableElement,
    newValue: NullableElement,
    name: string,
  ): PlanAction {
    if (isType(oldValue) || isType(newValue)) {
      return PlanAction.createFromTypes(oldValue as NullableType, newValue as NullableType, name)
    }
    if (isInstanceElement(oldValue) || isInstanceElement(newValue)) {
      return PlanAction.createFromInstanceElement(
        oldValue as InstanceElement,
        newValue as InstanceElement,
        name,
      )
    }

    throw new Error('At least one element has to be defined')
  }
}
