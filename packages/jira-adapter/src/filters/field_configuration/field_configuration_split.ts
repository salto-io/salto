/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import {
  CORE_ANNOTATIONS,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  ReferenceExpression,
  Values,
} from '@salto-io/adapter-api'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { FilterCreator } from '../../filter'
import { findObject, setTypeDeploymentAnnotations } from '../../utils'
import { FIELD_CONFIGURATION_ITEM_TYPE_NAME, FIELD_CONFIGURATION_TYPE_NAME } from '../../constants'

const FIELD_CONFIGURATION_ITEMS_FOLDER_NAME = 'FieldConfigurationItems'
const FIELD_CONFIGURATION_ITEMS_FILE_NAME = 'Items'

const createFieldItemInstance = (
  instance: InstanceElement,
  fieldItemValues: Values,
  fieldItemType: ObjectType,
): InstanceElement =>
  new InstanceElement(
    naclCase(`${instance.elemID.name}_${fieldItemValues.id.elemID.name}`),
    fieldItemType,
    fieldItemValues,
    instance.path && [
      ...instance.path,
      FIELD_CONFIGURATION_ITEMS_FOLDER_NAME,
      pathNaclCase(naclCase(`${instance.value.name}_${FIELD_CONFIGURATION_ITEMS_FILE_NAME}`)),
    ],
    {
      [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(instance.elemID, instance)],
    },
  )

const filter: FilterCreator = ({ config }) => ({
  name: 'fieldConfigurationSplitFilter',
  onFetch: async elements => {
    if (!config.fetch.splitFieldConfiguration) {
      return
    }

    const fieldConfigurationType = findObject(elements, FIELD_CONFIGURATION_TYPE_NAME)
    const fieldConfigurationItemType = findObject(elements, FIELD_CONFIGURATION_ITEM_TYPE_NAME)

    if (fieldConfigurationType === undefined || fieldConfigurationItemType === undefined) {
      return
    }

    delete fieldConfigurationType.fields.fields
    setTypeDeploymentAnnotations(fieldConfigurationItemType)

    const fieldItems = elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .filter(instance => instance.value.fields !== undefined)
      .flatMap(instance =>
        instance.value.fields.map((field: Values) => {
          const item = createFieldItemInstance(instance, field, fieldConfigurationItemType)

          delete instance.value.fields

          return item
        }),
      )
    elements
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === FIELD_CONFIGURATION_TYPE_NAME)
      .forEach(instance => {
        if (instance.path !== undefined) {
          instance.path = [...instance.path, instance.path[instance.path.length - 1]]
        }
      })
    fieldItems.forEach(item => elements.push(item))
  },
})

export default filter
