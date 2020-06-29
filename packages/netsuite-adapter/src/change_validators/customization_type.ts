/*
*                      Copyright 2020 Salto Labs Ltd.
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
  isInstanceElement,
  ChangeValidator,
  getChangeElement,
  isAdditionOrModificationDiff,
} from '@salto-io/adapter-api'
import { isCustomType, isFileCabinetType } from '../types'

const changeValidator: ChangeValidator = async changes => (
  changes.changes
    .filter(isAdditionOrModificationDiff)
    .map(getChangeElement)
    .filter(isInstanceElement)
    .filter(inst => !isCustomType(inst.type) && !isFileCabinetType(inst.type))
    .map(({ elemID }) => ({
      elemID,
      severity: 'Error',
      message: 'Salto supports changes to instances of customTypes and fileCabinet only',
      detailedMessage: `Changing (${elemID.name}) is not supported. Salto supports changing instances of customTypes and fileCabinet only`,
    }))
)

export default changeValidator
