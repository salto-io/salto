/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ActionName,
  Change,
  InstanceElement,
  isMapType,
  isObjectType,
  ObjectType,
  ReadOnlyElementsSource,
  Values,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData, transformElement } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { OPERATION_TO_ANNOTATION } from '../../../deployment/annotations'

const log = logger(module)

const removeAdditionalPropertiesFlat = async (
  values: Values,
  type: ObjectType,
  action: ActionName,
  elementsSource?: ReadOnlyElementsSource,
): Promise<void> => {
  const additionalPropertiesField = type.fields.additionalProperties
  if (additionalPropertiesField === undefined || !isMapType(await additionalPropertiesField.getType(elementsSource))) {
    return
  }

  const deploymentAnnotationValue = additionalPropertiesField.annotations[OPERATION_TO_ANNOTATION[action]]
  if (
    (deploymentAnnotationValue === true || deploymentAnnotationValue === undefined) &&
    values.additionalProperties !== undefined
  ) {
    const objectKeys = new Set(Object.keys(values))
    const commonKeys = Object.keys(values.additionalProperties).filter(key => objectKeys.has(key))
    if (commonKeys.length !== 0) {
      log.warn(
        `additional properties of type ${type.elemID.getFullName()} have common keys with the rest of the instance and will override them: ${commonKeys.join(', ')}`,
      )
    }
    _.assign(values, values.additionalProperties)
    delete values.additionalProperties
  }
}

// TODO remove this
// https://salto-io.atlassian.net/browse/SALTO-5332
/**
 * Remove the additional properties value we added on fetch in normalizeElementValues before deploy
 * and add its values to the top level values if deployable
 */
export const flattenAdditionalProperties = async (
  change: Change<InstanceElement>,
  elementsSource?: ReadOnlyElementsSource,
): Promise<Change<InstanceElement>> =>
  applyFunctionToChangeData(change, async element =>
    transformElement({
      element,
      strict: false,
      allowEmptyArrays: true,
      allowExistingEmptyObjects: true,
      elementsSource,
      transformFunc: async ({ value, field, path }) => {
        const type = path?.isTopLevel() ? await element.getType(elementsSource) : await field?.getType(elementsSource)
        if (type !== undefined && isObjectType(type) && _.isPlainObject(value)) {
          await removeAdditionalPropertiesFlat(value, type, change.action, elementsSource)
        }

        return value
      },
    }),
  )
