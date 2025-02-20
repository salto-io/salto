/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Element,
  ObjectType,
  Field,
  ReferenceExpression,
  isObjectType,
  Value,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { multiIndex } from '@salto-io/lowerdash'
import _ from 'lodash'
import { FilterCreator } from '../filter'
import { FIELD_ANNOTATIONS, FIELD_DEPENDENCY_FIELDS, VALUE_SETTINGS_FIELDS, VALUE_SET_FIELDS } from '../constants'
import { apiName } from '../transformers/transformer'
import { isInstanceOfType, buildElementsSourceForFetch, isCustomObjectSync } from './utils'
import { ValueSettings } from '../client/types'

export const GLOBAL_VALUE_SET = 'GlobalValueSet'
export const CUSTOM_VALUE = 'customValue'
export const MASTER_LABEL = 'master_label'

const addGlobalValueSetRefToObject = (object: ObjectType, gvsToRef: multiIndex.Index<[string], Element>): void => {
  const getValueSetName = (field: Field): string | undefined => field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]

  Object.values(object.fields).forEach(f => {
    const valueSetName = getValueSetName(f)
    if (valueSetName === undefined) {
      return
    }
    const valueSetInstance: Value = gvsToRef.get(valueSetName)
    if (valueSetInstance) {
      f.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = new ReferenceExpression(
        valueSetInstance.elemID,
        valueSetInstance,
      )
      if (f.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]) {
        const controllingFieldName =
          f.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY][FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
        const controllingField = object.fields[controllingFieldName]
        f.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY][FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD] =
          new ReferenceExpression(controllingField.elemID)
        const controllingFieldValueSetNameOrRef = controllingField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
        let controllingValueSet: Value
        if (isReferenceExpression(controllingFieldValueSetNameOrRef)) {
          controllingValueSet = controllingFieldValueSetNameOrRef.getResolvedValue()
        } else if (_.isString(controllingFieldValueSetNameOrRef)) {
          controllingValueSet = gvsToRef.get(controllingFieldValueSetNameOrRef)
        }
        if (_.isArray(f.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY][FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS])) {
          f.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY][FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS].forEach(
            (vs: ValueSettings) => {
              vs.valueName = !_.isUndefined(valueSetInstance.value.customValue.values[vs.valueName])
                ? new ReferenceExpression(
                    valueSetInstance.elemID.createNestedID(
                      'customValue',
                      'values',
                      vs[VALUE_SETTINGS_FIELDS.VALUE_NAME],
                    ),
                  )
                : vs[VALUE_SETTINGS_FIELDS.VALUE_NAME]

              vs[VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE] = vs[VALUE_SETTINGS_FIELDS.CONTROLLING_FIELD_VALUE].map(
                (cfv: string) => {
                  if (!_.isUndefined(controllingValueSet.value.customValue.values[cfv])) {
                    return new ReferenceExpression(
                      controllingValueSet.elemID.createNestedID('customValue', 'values', cfv),
                    )
                  }
                  return cfv
                },
              )
            },
          )
        }
      }
    }
  })
}

/**
 * Create filter that adds global value set references where needed
 */
const filterCreator: FilterCreator = ({ config }) => ({
  name: 'globalValueSetFilter',
  /**
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const referenceElements = buildElementsSourceForFetch(elements, config)
    const valueSetNameToRef = await multiIndex.keyByAsync({
      iter: await referenceElements.getAll(),
      filter: isInstanceOfType(GLOBAL_VALUE_SET),
      key: async inst => [await apiName(inst)],
    })
    const customObjects = elements.filter(isObjectType).filter(isCustomObjectSync)
    customObjects.forEach(object => addGlobalValueSetRefToObject(object, valueSetNameToRef))
    console.log(customObjects)
  },
})

export default filterCreator
