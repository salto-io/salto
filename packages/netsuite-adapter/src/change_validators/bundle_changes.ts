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
import { ChangeDataType, ChangeError, getChangeData, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { NetsuiteChangeValidator } from './types'
import { isBundleInstance, isFileCabinetInstance } from '../types'

const { awu } = collections.asynciterable
const { isDefined } = values

const getBundlesChangeError = (changeData: ChangeDataType): ChangeError | undefined => {
  if (isFileCabinetInstance(changeData) && isDefined(changeData.value.bundle)) {
    return {
      message: 'Can\'t deploy file cabinet elements which are part of a bundle',
      severity: 'Error',
      elemID: changeData.elemID,
      detailedMessage: 'Netsuite does not support modifying file cabinet elements that are part of a bundle.\nUsually, these files are installed with the bundle itself.',
    }
  } if (isBundleInstance(changeData)) {
    return {
      message: 'Can\'t deploy bundle',
      severity: 'Error',
      elemID: changeData.elemID,
      detailedMessage: 'This bundle doesn\'t exist in the target account, and cannot be automatically deployed. \nIt may be required by some elements in your deployment.\nYou can manually install this bundle in the target account: <guide to install>',
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
