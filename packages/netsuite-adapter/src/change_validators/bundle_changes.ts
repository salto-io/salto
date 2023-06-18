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
import { values, collections } from '@salto-io/lowerdash'
import { ChangeDataType, ChangeError, getChangeData, InstanceElement, isAdditionOrModificationChange, isInstanceElement, Element } from '@salto-io/adapter-api'
import { NetsuiteChangeValidator } from './types'
import { isBundleType, isFileCabinetInstance } from '../types'

const { awu } = collections.asynciterable
const { isDefined } = values

const isBundleInstance = (element: Element): element is InstanceElement =>
  isInstanceElement(element) && isBundleType(element.refType)

const getBundlesChangeError = (changeData: ChangeDataType): ChangeError | undefined => {
  if (isFileCabinetInstance(changeData) && isDefined(changeData.value.bundle)) {
    return {
      // TODO: consult PM on error messages
      message: '',
      severity: 'Error',
      elemID: changeData.elemID,
      detailedMessage: '',
    }
  } if (isBundleInstance(changeData)) {
    return {
      message: '',
      severity: 'Error',
      elemID: changeData.elemID,
      detailedMessage: '',
    }
  }
  return undefined
}

const changeValidator: NetsuiteChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .map(getBundlesChangeError)
    .filter(isDefined)
    .toArray()
)

export default changeValidator
