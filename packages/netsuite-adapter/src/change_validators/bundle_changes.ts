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
import { Change, ChangeError, getChangeData, isAdditionChange, isAdditionOrModificationChange } from '@salto-io/adapter-api'
import { NetsuiteChangeValidator } from './types'
import { getElementValueOrAnnotations, isBundleInstance } from '../types'

const { awu } = collections.asynciterable
const { isDefined } = values

const getBundlesChangeError = (change: Change): ChangeError | undefined => {
  const changeData = getChangeData(change)
  if (isAdditionChange(change) && isDefined(getElementValueOrAnnotations(changeData).bundle)) {
    return {
      message: 'Can\'t add new elements to bundle',
      severity: 'Error',
      elemID: changeData.elemID,
      detailedMessage: 'Adding elements to a bundle is not supported.',
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
    .map(getBundlesChangeError)
    .filter(isDefined)
    .toArray()
)

export default changeValidator
