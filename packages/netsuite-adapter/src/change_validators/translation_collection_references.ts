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
import { ChangeError, getChangeData, isAdditionOrModificationChange, Element, isField, isObjectTypeChange } from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { captureServiceIdInfo } from '../service_id_info'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { NetsuiteChangeValidator } from './types'

const { isDefined } = values
const CUSTOM_COLLECTION = 'custcollection'
const MESSAGE = 'Cannot deploy element with invalid translation reference'

const toChangeErrorForElement = (
  element: Element,
  references: string[]
): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: MESSAGE,
  detailedMessage: `Cannot deploy this element because it contains references to the following translation collections that do not exist in your environment: ${references.map(reference => `'${reference}'`).join(', ')}.`
   + ' To proceed with the deployment, please replace the reference with a valid string. After the deployment, you can reconnect the elements in the NetSuite UI.',
})

const toChangeErrorForParent = (
  element: Element,
  referencesInParent: string[]
): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: MESSAGE,
  detailedMessage: `Cannot deploy this field because its parent type contains references to the following translation collections that do not exist in your environment: ${referencesInParent.map(reference => `'${reference}'`).join(', ')}.`
   + ' To proceed with the deployment, please replace the reference with a valid string. After the deployment, you can reconnect the elements in the NetSuite UI.',
})

const toChangeErrorForElementAndParent = (
  element: Element,
  references: string[],
  referencesInParent: string[]
): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: MESSAGE,
  detailedMessage: `Cannot deploy this field because it contains references to the following translation collections that do not exist in your environment: ${references.map(reference => `'${reference}'`).join(', ')}.`
   + ` In addition, its parent type also contains references to translation collections that do not exist in your environment: ${referencesInParent.map(reference => `'${reference}'`).join(', ')}.`
   + ' To proceed with the deployment, please replace the references with valid strings. After the deployment, you can reconnect the elements in the NetSuite UI.',
})

const changeValidator: NetsuiteChangeValidator = async changes => {
  const typesChangesIds = new Set(
    changes
      .filter(isObjectTypeChange)
      .map(getChangeData)
      .map(type => type.elemID.getFullName())
  )
  return changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isStandardInstanceOrCustomRecordType)
    .map(element => {
      const customCollectionReferences: string[] = []
      const customCollectionReferencesInParent: string[] = []
      walkOnElement({
        element: isField(element) && !typesChangesIds.has(element.parent.elemID.getFullName())
          ? element.parent : element,
        func: ({ path, value }) => {
          if (_.isString(value)) {
            const pushToArray = element.elemID.isParentOf(path)
              ? customCollectionReferences : customCollectionReferencesInParent
            pushToArray.push(
              ...captureServiceIdInfo(value)
                .map(serviceIdInfo => serviceIdInfo.serviceId)
                .filter(serviceId => serviceId.startsWith(CUSTOM_COLLECTION))
                .map(serviceId => serviceId.split('.')[0])
            )
            return WALK_NEXT_STEP.SKIP
          }
          return WALK_NEXT_STEP.RECURSE
        },
      })
      if (customCollectionReferences.length > 0 && customCollectionReferencesInParent.length === 0) {
        return toChangeErrorForElement(element, _.uniq(customCollectionReferences))
      }
      if (customCollectionReferences.length === 0 && customCollectionReferencesInParent.length > 0) {
        return toChangeErrorForParent(element, _.uniq(customCollectionReferencesInParent))
      }
      if (customCollectionReferences.length > 0 && customCollectionReferencesInParent.length > 0) {
        return toChangeErrorForElementAndParent(
          element,
          _.uniq(customCollectionReferences),
          _.uniq(customCollectionReferencesInParent),
        )
      }
      return undefined
    })
    .filter(isDefined)
}

export default changeValidator
