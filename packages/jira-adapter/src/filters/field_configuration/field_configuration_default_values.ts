/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement } from '@salto-io/adapter-api'
import Joi from 'joi'
import { createSchemeGuard } from '@salto-io/adapter-utils'

type FieldConfigurationItem = {
  id: string
  isHidden?: boolean
  isRequired?: boolean
  description?: string
}

const FIELD_CONFIGURATION_ITEM_SCHEME = Joi.object({
  id: Joi.string().required(),
  isHidden: Joi.boolean(),
  isRequired: Joi.boolean(),
  description: Joi.string().allow(''),
}).unknown(true)

const isFieldConfigurationItem = createSchemeGuard<FieldConfigurationItem>(
  FIELD_CONFIGURATION_ITEM_SCHEME,
  'Received unexpected FieldConfigurationItem',
)

// the default values of isHidden and isRequired are false
export const removeFieldConfigurationItemDefaultValues = (
  instance: InstanceElement,
  idToFieldMap: Record<string, InstanceElement>,
): void => {
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
        idToFieldMap[fieldItem.id] !== undefined &&
        fieldItem.description === idToFieldMap[fieldItem.id].value.description
      ) {
        delete fieldItem.description
      }
    })
}

export const addFieldConfigurationItemDefaultValues = (
  instance: InstanceElement,
  idToFieldMap: Record<string, InstanceElement>,
): void => {
  Object.values(instance.value.fields)
    .filter(isFieldConfigurationItem)
    .forEach(fieldItem => {
      if (fieldItem.isHidden === undefined) {
        fieldItem.isHidden = false
      }
      if (fieldItem.isRequired === undefined) {
        fieldItem.isRequired = false
      }
      if (fieldItem.description === undefined && idToFieldMap[fieldItem.id] !== undefined) {
        fieldItem.description = idToFieldMap[fieldItem.id].value.description
      }
    })
}
