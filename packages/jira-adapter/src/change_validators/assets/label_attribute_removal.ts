/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  isInstanceChange,
  SeverityLevel,
  isRemovalChange,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE } from '../../constants'
import { JiraConfig } from '../../config/config'

const { awu } = collections.asynciterable

/*
 * This validator prevents the deletion of the label attribute of an objectType.
 */
export const deleteLabelAtttributeValidator: (config: JiraConfig) => ChangeValidator =
  config => async (changes, elementsSource) => {
    if (elementsSource === undefined || !config.fetch.enableJSM) {
      return []
    }
    const objectTypeAttributeRemovalChanges = changes
      .filter(isInstanceChange)
      .filter(isRemovalChange)
      .map(getChangeData)
      .filter(instance => instance.elemID.typeName === OBJECT_TYPE_ATTRIBUTE_TYPE)

    if (objectTypeAttributeRemovalChanges.length === 0) {
      return []
    }

    const labelAttributesFullNames = await awu(await elementsSource.list())
      .filter(id => id.typeName === OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE)
      .map(id => elementsSource.get(id))
      .filter(isInstanceElement)
      .filter(instance => isReferenceExpression(instance.value.labelAttribute))
      .map(instance => instance.value.labelAttribute.elemID.getFullName())
      .toArray()

    return objectTypeAttributeRemovalChanges
      .filter(instance => labelAttributesFullNames.includes(instance.elemID.getFullName()))
      .map(instance => ({
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Cannot delete this attribute, as it is the label attribute of its Object Type.',
        detailedMessage: 'Cannot delete this attribute, as it is the label attribute of its objectType.',
      }))
  }
