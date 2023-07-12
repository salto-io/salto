/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { ChangeError, getChangeData, isAdditionOrModificationChange, Element } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { captureServiceIdInfo } from '../service_id_info'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { NetsuiteChangeValidator } from './types'

const { isDefined } = values
const CUSTOM_COLLECTION = 'custcollection'

const toChangeError = (element: Element, referenceName: string): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: 'Cannot deploy element with invalid translation reference',
  detailedMessage: `Cannot deploy this element because it contains a reference to the '${referenceName}' translation collection that does not exist in the environment.`
   + ' To proceed with the deployment, please replace the reference with a valid string. After the deployment, you can reconnect the elements in the NetSuite UI.',
})

const changeValidator: NetsuiteChangeValidator = async changes => (
  changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isStandardInstanceOrCustomRecordType)
    .flatMap(element => {
      const changeErrors: ChangeError[] = []
      walkOnElement({
        element,
        func: ({ value }) => {
          if (_.isString(value)) {
            changeErrors.push(
              ...captureServiceIdInfo(value)
                .map(serviceIdInfo => serviceIdInfo.serviceId)
                .filter(serviceId => serviceId.includes(CUSTOM_COLLECTION))
                .map(serviceId => toChangeError(element, serviceId))
            )
            return WALK_NEXT_STEP.EXIT
          }
          return WALK_NEXT_STEP.RECURSE
        },
      })
      return changeErrors
    })
    .filter(isDefined)
)

export default changeValidator
