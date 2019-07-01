import * as _ from 'lodash'
import {
  Type, isListType, isObjectType, Values,
} from './elements'

type NullableType = Type | null | undefined
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

  static createAnnotationValuesChanges(oldAnno: Values, newAnno: Values): PlanAction[] {
    const allKeys = Object.keys(oldAnno).concat(Object.keys(newAnno))

    return allKeys.map((k) => {
      let actionType
      if (oldAnno[k] && newAnno[k]) {
        actionType = PlanActionType.MODIFY
      } else if (!oldAnno[k] && newAnno[k]) {
        actionType = PlanActionType.ADD
      } else {
        actionType = PlanActionType.REMOVE
      }
      const subChanges = (_.isPlainObject(oldAnno[k]) || _.isPlainObject(newAnno[k]))
        ? PlanAction.createAnnotationValuesChanges(oldAnno[k] || {}, newAnno[k] || {}) : []
      return new PlanAction(k, actionType, subChanges, newAnno[k], oldAnno[k])
    })
  }


  static fillActionPlanWithElement(
    element: Type,
    actionType: PlanActionType,
    name: string,
  ): PlanAction {
    const newValue = (actionType === PlanActionType.ADD) ? element : undefined
    const oldValue = (actionType === PlanActionType.REMOVE) ? element : undefined

    const annotationFill = Object.keys(element.annotations).map(
      key => PlanAction.fillActionPlanWithElement(element.annotations[key], actionType, key),
    )

    const valuesFill = (actionType === PlanActionType.ADD)
      ? PlanAction.createAnnotationValuesChanges({}, element.annotationsValues)
      : PlanAction.createAnnotationValuesChanges(element.annotationsValues, {})

    const baseFill = annotationFill.concat(valuesFill)

    if (isObjectType(element)) {
      const fieldChanges = Object.keys(element.fields).map(
        key => PlanAction.fillActionPlanWithElement(element.fields[key], actionType, key),
      )
      const subChanges = baseFill.concat(fieldChanges)
      return new PlanAction(name, actionType, subChanges, newValue, oldValue)
    }

    if (isListType(element) && element.elementType) {
      return PlanAction.fillActionPlanWithElement(element.elementType, actionType, name)
    }

    return new PlanAction(name, actionType, baseFill, newValue, oldValue)
  }

  static createFromElements(
    oldValue: NullableType,
    newValue: NullableType,
    name: string,
  ): PlanAction {
    if (oldValue && !newValue) {
      return PlanAction.fillActionPlanWithElement(oldValue, PlanActionType.REMOVE, name)
    }

    if (!oldValue && newValue) {
      return PlanAction.fillActionPlanWithElement(newValue, PlanActionType.ADD, name)
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
          key => PlanAction.createFromElements(oldValue.fields[key], newValue.fields[key], key),
        ) : []

      const valuesChanges = PlanAction.createAnnotationValuesChanges(
        oldValue.annotationsValues,
        newValue.annotationsValues,
      )
      const subChanges = annotationChanges.concat(fieldChanges).concat(valuesChanges)
      return new PlanAction(name, actionType, subChanges, newValue, oldValue)
    }

    throw new Error('At least one element has to be defined')
  }
}
