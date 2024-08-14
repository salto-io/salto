/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { collections } from '@salto-io/lowerdash'
import { ChangeError, getChangeData, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { NOT_YET_SUPPORTED_VALUE } from '../constants'
import { isElementContainsStringValue } from './utils'
import { NetsuiteChangeValidator } from './types'

const { awu } = collections.asynciterable

const changeValidator: NetsuiteChangeValidator = async changes =>
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isStandardInstanceOrCustomRecordType)
    .filter(element => isElementContainsStringValue(element, NOT_YET_SUPPORTED_VALUE))
    .map(
      element =>
        ({
          elemID: element.elemID,
          severity: 'Error',
          message: "Can't deploy instances with the value 'NOT_YET_SUPPORTED'",
          detailedMessage:
            "This element contains the value 'NOT_YET_SUPPORTED', which can't be deployed due to NetSuite's SDF restrictions.\n" +
            "In Salto, remove or replace the value 'NOT_YET_SUPPORTED' with a valid value, before deploying it, and after the deployment succeeds, change it back to the required value, in NetSuite's UI.\n" +
            'Learn more at https://docs.salto.io/docs/deploying-elements-containing-not-yet-supported-values',
        }) as ChangeError,
    )
    .toArray()

export default changeValidator
