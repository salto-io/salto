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
import { ChangeValidator, getChangeData, ChangeError, InstanceElement, ElemID } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { getNamespace } from '../filters/utils'
import { hasNamespace } from './package'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'
import { CPQ_NAMESPACE } from '../constants'


const { awu } = collections.asynciterable
const getCpqError = (
  elemID: ElemID,
): ChangeError => ({
  elemID,
  severity: 'Info',
  message: 'CPQ data changes detected',
  detailedMessage: '',
  deployActions: {
    preAction: {
      title: 'Disable CPQ Triggers',
      description: 'CPQ triggers should be disabled before deploying:',
      subActions: [
        'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
        'Check the "Triggers Disabled" checkbox',
        'Click "Save"',
      ],
    },
    postAction: {
      title: 'Re-enable CPQ Triggers',
      description: 'CPQ triggers should now be re-enabled:',
      showOnFailure: true,
      subActions: [
        'In Salesforce, navigate to Setup > Installed Packages > Salesforce CPQ > Configure > Additional Settings tab',
        'Uncheck the "Triggers Disabled" checkbox',
        'Click "Save"',
      ],
    },
  },
})

// this changeValidator will return none or a single changeError
const changeValidator: ChangeValidator = async changes => {
  const cpqInstance = await awu(changes)
    .filter(isInstanceOfCustomObjectChange)
    .map(change =>
      getChangeData(change) as InstanceElement) // already checked that this is an instance element
    .find(async instance => {
      const type = await instance.getType()
      return await hasNamespace(type) && (await getNamespace(type)) === CPQ_NAMESPACE
    })

  return cpqInstance !== undefined ? [getCpqError(cpqInstance.elemID)] : []
}

export default changeValidator
