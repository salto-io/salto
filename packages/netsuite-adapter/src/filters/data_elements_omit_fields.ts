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

import { isAdditionOrModificationChange, isInstanceChange, isModificationChange, isAdditionChange, Change, ModificationChange, getChangeData, ChangeDataType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { LocalFilterCreator } from '../filter'
import { isDataElementChange } from '../change_validators/inactive_parent'
import { getElementValueOrAnnotations } from '../types'

export const CLASS_TRANSLATION_LIST = 'classTranslationList'
const FIELDS_TO_OMIT = [CLASS_TRANSLATION_LIST]

const fieldIsModified = (
  change: ModificationChange<ChangeDataType>,
  fieldToOmit: string,
): boolean => {
  const { before, after } = change.data
  return !_.isEqual(
    getElementValueOrAnnotations(before)[fieldToOmit],
    getElementValueOrAnnotations(after)[fieldToOmit]
  )
}

export const shouldOmitField = (
  change: Change,
  fieldToOmit: string
): boolean => (isAdditionChange(change) || (isModificationChange(change) && fieldIsModified(change, fieldToOmit)))


const filterCreator: LocalFilterCreator = () => ({
  name: 'dataElementsOmitFields',
  preDeploy: async changes => {
    changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(isDataElementChange)
      .filter(change => shouldOmitField(change, CLASS_TRANSLATION_LIST))
      .map(getChangeData)
      .forEach(instanceElement => {
        instanceElement.value = _.omit(instanceElement.value, FIELDS_TO_OMIT)
      })
  },
})

export default filterCreator
