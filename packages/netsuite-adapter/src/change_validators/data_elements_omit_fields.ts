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
import { isAdditionOrModificationChange, isInstanceChange, getChangeData } from '@salto-io/adapter-api'
import { isDataElementChange } from './inactive_parent'
import { NetsuiteChangeValidator } from './types'
import { shouldOmitField, CLASS_TRANSLATION_LIST } from '../filters/data_elements_omit_fields'

const changeValidator: NetsuiteChangeValidator = async changes =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(isInstanceChange)
    .filter(isDataElementChange)
    .filter(change => shouldOmitField(change, CLASS_TRANSLATION_LIST))
    .map(getChangeData)
    .map(instance => ({
      elemID: instance.elemID,
      severity: 'Warning',
      message: `Changes to the ${CLASS_TRANSLATION_LIST} are not deployable`,
      detailedMessage: `Changes to the ${CLASS_TRANSLATION_LIST} are not deployable and will be removed from the deployment.`,
    }))


export default changeValidator
