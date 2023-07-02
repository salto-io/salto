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
import { ChangeError, getChangeData, InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { NetsuiteChangeValidator } from './types'

const { isDefined } = values
const customCollectionRegex = new RegExp('\\[scriptid=custcollection.*', 'gm')

const toChangeError = (instance: InstanceElement): ChangeError => ({
  elemID: instance.elemID,
  severity: 'Error',
  message: 'Cannot deploy elements with translation references',
  detailedMessage: 'Cannot deploy this element since it contains a translation reference.'
  + ' To deploy it, replace the reference with any string. After the deployment, reconnect the elements in the NS UI',
})

const changeValidator: NetsuiteChangeValidator = async changes => (
  changes
    .map(getChangeData)
    .filter(isInstanceElement)
    .map(instance => {
      let changeError: ChangeError | undefined
      walkOnElement({
        element: instance,
        func: ({ value }) => {
          if (_.isString(value) && customCollectionRegex.test(value)) {
            changeError = toChangeError(instance)
            return WALK_NEXT_STEP.EXIT
          }
          return WALK_NEXT_STEP.RECURSE
        },
      })
      return changeError
    })
    .filter(isDefined)
)

export default changeValidator
