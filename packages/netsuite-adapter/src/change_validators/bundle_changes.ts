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
import { values, collections } from '@salto-io/lowerdash'
import { Change, ChangeError, getChangeData, isAdditionChange } from '@salto-io/adapter-api'
import { NetsuiteChangeValidator } from './types'
import { getElementValueOrAnnotations, isBundleInstance } from '../types'

const { awu } = collections.asynciterable
const { isDefined } = values

const getBundlesChangeError = (change: Change): ChangeError | undefined => {
  const changeData = getChangeData(change)
  if (isAdditionChange(change) && isDefined(getElementValueOrAnnotations(changeData).bundle)) {
    return {
      message: "Can't add new elements to bundle",
      severity: 'Error',
      elemID: changeData.elemID,
      detailedMessage:
        'Adding elements to a bundle is not supported. Learn more at https://help.salto.io/en/articles/8963376-enhancing-the-visibility-of-bundles-in-netsuite-with-salto-s-suiteapp',
    }
  }
  if (isBundleInstance(changeData)) {
    return {
      message: 'Cannot add, modify, or remove bundles',
      severity: 'Error',
      elemID: changeData.elemID,
      detailedMessage:
        'Cannot create, modify or remove bundles.To manage bundles, please manually install or update them in the target account.' +
        ' Follow these steps: Customization > SuiteBundler > Search & Install Bundles.' +
        ' Learn more at https://help.salto.io/en/articles/8963376-enhancing-the-visibility-of-bundles-in-netsuite-with-salto-s-suiteapp',
    }
  }
  return undefined
}

const changeValidator: NetsuiteChangeValidator = async changes =>
  awu(changes).map(getBundlesChangeError).filter(isDefined).toArray()

export default changeValidator
