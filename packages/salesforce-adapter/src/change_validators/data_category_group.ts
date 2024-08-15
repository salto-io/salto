/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  ChangeError,
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { DATA_CATEGORY_GROUP_METADATA_TYPE } from '../constants'
import { isInstanceOfTypeChange } from '../filters/utils'

const { awu } = collections.asynciterable

const destructiveDataCategoryGroupDeployError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Warning',
  message: 'DataCategoryGroup deployments may be destructive',
  detailedMessage:
    'Deploying category changes from one environment to another may permanently remove some categories and record categorizations. It is recommended to manually create data categories and record associations via the Salesforce UI from ‘Setup’ by entering ‘Data Categories’ in the Quick Find box, then selecting ‘Data Categories’. You can learn more about this deployment preview error here: https://help.salto.io/en/articles/8046692-datacategorygroup-deployment-may-be-destructive',
})

/*
Changes in DataCategoryGroup can be destructive (remove elements from the current environment).
Issue a warning on all such changes
*/
function changeValidator(): ChangeValidator {
  return async changes =>
    awu(changes)
      .filter(isInstanceChange)
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceOfTypeChange(DATA_CATEGORY_GROUP_METADATA_TYPE))
      .map(getChangeData)
      .map(destructiveDataCategoryGroupDeployError)
      .toArray()
}

export default changeValidator()
