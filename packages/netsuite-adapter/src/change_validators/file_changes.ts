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
import {
  getChangeData, Change, ChangeError,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { fileCabinetTopLevelFolders } from '../client/constants'
import { isFileCabinetInstance } from '../types'
import * as suiteAppFileCabinet from '../suiteapp_file_cabinet'
import { NetsuiteChangeValidator } from './types'


const { awu } = collections.asynciterable

const isChangeSupported = async (change: Change): Promise<boolean> => {
  const element = getChangeData(change)
  if (!isFileCabinetInstance(element)) {
    return true
  }

  return await suiteAppFileCabinet.isChangeDeployable(change) || fileCabinetTopLevelFolders.some(folder => element.value.path.startsWith(`${folder}/`))
}


const changeValidator: NetsuiteChangeValidator = async changes => (
  awu(changes)
    .filter(async change => !await isChangeSupported(change))
    .map(getChangeData)
    .map((inst): ChangeError => ({
      elemID: inst.elemID,
      severity: 'Error',
      message: 'File change is not supported',
      detailedMessage: `Salto does not support deploying changes to files above 10 MB and to the generateurltimestamp field for files outside the folders ${fileCabinetTopLevelFolders.join(', ')}.`,
    }))
    .toArray()
)

export default changeValidator
