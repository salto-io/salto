/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { getChangeData, ChangeError, isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { NetsuiteChangeValidator } from './types'
import { DATASET, WORKBOOK } from '../constants'

const changeValidator: NetsuiteChangeValidator = async (changes, { client }) =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(inst => inst.elemID.typeName === WORKBOOK || inst.elemID.typeName === DATASET)
    .map(
      ({ elemID }): ChangeError => ({
        elemID,
        severity: 'Info',
        message: 'The deployment might not affect this element',
        detailedMessage: '',
        deployActions: {
          postAction: {
            title: 'Verify deployment success',
            description:
              'Verify that your selected workbooks or datasets have been successfully deployed in the NetSuite UI.',
            showOnFailure: false,
            subActions: [
              `Go to ${client.url}app/common/report/list.nl`,
              'Verify that the changes you made in workbooks/datasets have been successfully deployed',
            ],
          },
        },
      }),
    )

export default changeValidator
