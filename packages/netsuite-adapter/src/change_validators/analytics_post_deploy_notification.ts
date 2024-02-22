/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getChangeData, ChangeError, isInstanceChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { NetsuiteChangeValidator } from './types'
import { DATASET, WORKBOOK } from '../constants'

const changeValidator: NetsuiteChangeValidator = async (
  changes,
  _deplyReferencedElements,
  _elementsSource,
  _config,
  client,
) =>
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
              client ? `Go to ${client.url}app/common/report/list.nl` : 'Within the NetSuite UI, navigate to Analytics',
              'Verify that the changes you made in workbooks/datasets have been successfully deployed',
            ],
          },
        },
      }),
    )

export default changeValidator
