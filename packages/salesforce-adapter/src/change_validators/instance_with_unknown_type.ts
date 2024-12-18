/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isPlaceholderObjectType,
} from '@salto-io/adapter-api'

const createInstanceWithoutTypeError = (change: Change<InstanceElement>): ChangeError => {
  const instance = getChangeData(change)
  const instanceType = instance.elemID.typeName
  return {
    elemID: instance.elemID,
    message: 'Instance of unknown type',
    detailedMessage: `Cannot ${change.action} the instance ${instance.elemID.getFullName()} because the ${instanceType} type is not managed by Salto in the target environment. Ensure that ${instanceType} is enabled in Salesforce and is not excluded in Salto's Application Connection configuration. For guidance on including it, refer to: https://help.salto.io/en/articles/7439350-supported-salesforce-types`,
    severity: 'Error',
  }
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(change => isPlaceholderObjectType(getChangeData(change).getTypeSync()))
    .map(createInstanceWithoutTypeError)

export default changeValidator
