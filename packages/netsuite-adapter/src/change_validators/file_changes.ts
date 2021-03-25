/*
*                      Copyright 2021 Salto Labs Ltd.
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
import {
  isInstanceElement, ChangeValidator, getChangeElement,
} from '@salto-io/adapter-api'
import { fileCabinetTopLevelFolders } from '../client/constants'
import { isFileCabinetType } from '../types'

const changeValidator: ChangeValidator = async changes => (
  changes
    .map(getChangeElement)
    .filter(isInstanceElement)
    .filter(inst => isFileCabinetType(inst.type))
    .filter(inst => fileCabinetTopLevelFolders.every(folder => !inst.value.path.startsWith(`${folder}/`)))
    .map(inst => ({
      elemID: inst.elemID,
      severity: 'Error',
      message: 'Changing files is not supported for the changed file path',
      detailedMessage: `Changing files is only supported for files under the folders ${fileCabinetTopLevelFolders.join(', ')}. Attempted to change file in ${inst.value.path}`,
    }))
)

export default changeValidator
