/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { Change, ChangeValidator, getChangeData, ChangeError, InstanceElement, isInstanceChange, isAdditionOrModificationChange, isObjectType, Field, Element } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { isInstanceOfTypeSync } from '../filters/utils'
import { API_NAME, CUSTOM_APPLICATION_METADATA_TYPE } from '../constants'
import { metadataType } from '../transformers/transformer'

const { awu } = collections.asynciterable
const defaultMap = collections.map.DefaultMap

const getDuplicateActionOverrides = 

const getDuplicateProfileActionOverrides = 

const isInvalidChange = async (change: Change<InstanceElement>): Promise<Boolean> => {
  const app = getChangeData(change).value.
  app.
  return true
}

const createChangeError = (change: Change): ChangeError => ({
  elemID: getChangeData(change).elemID.
  severity: 'Warning',
  message: 'Custom application CV',
  detailedMessage: 'Testing pipe',
})

const isCustomApplication = (element: Element): boolean => {
  const res =
    isObjectType(element) &&
    (metadataTypeSync(element)) === CUSTOM_APPLICATION_METADATA_TYPE &&
    element.annotations[API_NAME] !== undefined
  return res
}

const isFieldOfCustomApplication = async (field: Field): Promise<boolean> => isCustomApplication(field.parent)

const changeValidator: ChangeValidator = async changes => {
  const apps = changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => )
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(CUSTOM_APPLICATION_METADATA_TYPE))
    .forEach(instance => {
      const customApplicationValues: unknown = instance.value
      if (!isCustomApplicationValues(customApplicationValues)) {
        return 
      }

    })


  return awu(changes).map(createChangeError).toArray()
}

export default changeValidator
