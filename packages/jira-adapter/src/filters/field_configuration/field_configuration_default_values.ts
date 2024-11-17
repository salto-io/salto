/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard, isResolvedReferenceExpression } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { FIELD_CONFIGURATION_TYPE_NAME } from '../../constants'

type FieldConfigurationItem = {
  id: ReferenceExpression
  isHidden?: boolean
  isRequired?: boolean
  description?: string
}

const FIELD_CONFIGURATION_ITEM_SCHEME = Joi.object({
  id: Joi.object().required(),
  isHidden: Joi.boolean(),
  isRequired: Joi.boolean(),
  description: Joi.string().allow(''),
}).unknown(true)

const isFieldConfigurationItem = createSchemeGuard<FieldConfigurationItem>(
  FIELD_CONFIGURATION_ITEM_SCHEME,
  'Received unexpected FieldConfigurationItem',
)

// the default values of isHidden and isRequired are false
const removeFieldConfigurationItemDefaultValues = (instance: InstanceElement): void => {
  Object.values(instance.value.fields)
    .filter(isFieldConfigurationItem)
    .forEach(fieldItem => {
      if (fieldItem.isHidden === false) {
        delete fieldItem.isHidden
      }
      if (fieldItem.isRequired === false) {
        delete fieldItem.isRequired
      }
      if (
        isResolvedReferenceExpression(fieldItem.id) &&
        fieldItem.description === fieldItem.id.value.value.description
      ) {
        delete fieldItem.description
      }
    })
}

const addFieldConfigurationItemDefaultValues = (instance: InstanceElement): void => {
  Object.values(instance.value.fields)
    .filter(isFieldConfigurationItem)
    .forEach(fieldItem => {
      if (fieldItem.isHidden === undefined) {
        fieldItem.isHidden = false
      }
      if (fieldItem.isRequired === undefined) {
        fieldItem.isRequired = false
      }
      if (fieldItem.description === undefined && isResolvedReferenceExpression(fieldItem.id)) {
        fieldItem.description = fieldItem.id.value.value.description
      }
    })
}

const filter: FilterCreator = ({ config }) => ({
  name: 'fieldConfigurationDefaultValuesFilter',
  onFetch: async elements => {
    if (!config.fetch.removeFieldConfigurationDefaultValues) {
      return
    }
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .forEach(removeFieldConfigurationItemDefaultValues)
  },
  preDeploy: async changes => {
    if (!config.fetch.removeFieldConfigurationDefaultValues) {
      return
    }
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .map(addFieldConfigurationItemDefaultValues)
  },
  onDeploy: async changes => {
    if (!config.fetch.removeFieldConfigurationDefaultValues) {
      return
    }
    changes
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .map(removeFieldConfigurationItemDefaultValues)
  },
})

export default filter
