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
  ReadOnlyElementsSource,
  isElement,
  isField,
} from '@salto-io/adapter-api'
import { collections, multiIndex } from '@salto-io/lowerdash'
import _ from 'lodash'
import { naclCase } from '@salto-io/adapter-utils'
import { FilterContext, FilterCreator } from '../filter'
import { FIELD_ANNOTATIONS, FIELD_DEPENDENCY_FIELDS, VALUE_SET_FIELDS } from '../constants'
import { apiName } from '../transformers/transformer'
import { isInstanceOfType, buildElementsSourceForFetch, isCustomObjectSync } from './utils'
import { ValueSettings } from '../client/types'

const { awu } = collections.asynciterable

export const GLOBAL_VALUE_SET = 'GlobalValueSet'
export const CUSTOM_VALUE = 'customValue'
export const MASTER_LABEL = 'master_label'

const isValidValueSettings = (vs: Value): vs is ValueSettings =>
  !(_.isUndefined(vs.valueName) || _.isUndefined(vs.controllingFieldValue)) &&
  (isReferenceExpression(vs.valueName) || _.isString(vs.valueName)) &&
  Array.isArray(vs.controllingFieldValue)

const addGlobalValueSetRefToObject = async (
  object: ObjectType,
  gvsToRef: multiIndex.Index<[string], Element>,
  elementsSource: ReadOnlyElementsSource,
  config: FilterContext,
): Promise<void> => {
  const getValueSetName = (field: Field): string | undefined => field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]

  await awu(Object.values(object.fields)).forEach(async f => {
    const valueSetName = getValueSetName(f)
    if (valueSetName === undefined) {
      return
    }
    const valueSetInstance: Value = gvsToRef.get(valueSetName)
    if (!valueSetInstance) {
      return
    }
    f.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = new ReferenceExpression(valueSetInstance.elemID, valueSetInstance)
    if (
      !(f.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY] && config.fetchProfile.isFeatureEnabled('picklistsAsMaps'))
    ) {
      return
    }
    const fieldDependency = f.annotations[FIELD_ANNOTATIONS.FIELD_DEPENDENCY]
    const controllingFieldName = fieldDependency[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD]
    const controllingField = _.isString(controllingFieldName) ? object.fields[controllingFieldName] : undefined
    if (!isField(controllingField)) {
      return
    }
    fieldDependency[FIELD_DEPENDENCY_FIELDS.CONTROLLING_FIELD] = new ReferenceExpression(
      controllingField.elemID,
      controllingField,
    )
    const controllingFieldValueSetNameOrRef = controllingField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
    let controllingValueSet: Value
    if (isReferenceExpression(controllingFieldValueSetNameOrRef)) {
      controllingValueSet = await controllingFieldValueSetNameOrRef.getResolvedValue(elementsSource)
    } else if (_.isString(controllingFieldValueSetNameOrRef)) {
      controllingValueSet = gvsToRef.get(controllingFieldValueSetNameOrRef)
    }
    const isControllingValueSet = isElement(controllingValueSet)
    if (!_.isArray(fieldDependency[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS])) {
      return
    }
    fieldDependency[FIELD_DEPENDENCY_FIELDS.VALUE_SETTINGS].forEach((vs: Value) => {
      if (!isValidValueSettings(vs)) {
        return
      }
      if (_.isString(vs.valueName)) {
        vs.valueName = !_.isUndefined(valueSetInstance.value.customValue.values[naclCase(vs.valueName)])
          ? new ReferenceExpression(
              valueSetInstance.elemID.createNestedID('customValue', 'values', naclCase(vs.valueName), 'fullName'),
              naclCase(vs.valueName),
            )
          : vs.valueName
      }
      if (!isControllingValueSet) {
        return
      }
      vs.controllingFieldValue = vs.controllingFieldValue.map((cfv: Value) => {
        if (_.isString(cfv) && !_.isUndefined(controllingValueSet.value.customValue.values[naclCase(cfv)])) {
          return new ReferenceExpression(
            controllingValueSet.elemID.createNestedID('customValue', 'values', naclCase(cfv), 'fullName'),
            naclCase(cfv),
          )
        }
        return cfv
      })
    })
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
    await awu(customObjects).forEach(object =>
      addGlobalValueSetRefToObject(object, valueSetNameToRef, referenceElements, config),
    )
  },
})

export default filterCreator
