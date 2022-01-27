/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ChangeValidator, getChangeData, ChangeError, ElemID } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'


const { awu } = collections.asynciterable
// TODO what is the right logic
const getCpqError = async (
  elemId: ElemID,
): Promise<ChangeError | undefined> => {
  if (elemId.getFullName().includes('SBQQ')) {
    return {
      elemID: elemId,
      severity: 'Info',
      // TODO re-write messages
      message: 'Identify cpq change',
      detailedMessage: `Identify cpq change for ${elemId}`,
      deployActions: {
        preAction: {
          label: 'disable CPQ trigger',
          subtext: [
            'In your Salesforce destination org, native to: \'Setup\' > \'Installed Packages\' > \'Salesforce CPQ\' > \'Configure\' > \'Additional Settings\'',
            'Check \'Triggers Disabled\'',
            'Click Save',
          ],
        },
        postAction: {
          label: 'disable CPQ trigger',
          subtext: [],
        },
      },
    } as ChangeError
  }
  return undefined
}


const changeValidator: ChangeValidator = async changes => {
  const updateChangeErrors = await awu(changes)
    .map(change =>
      getCpqError(
        getChangeData(change).elemID
      ))
    .filter(values.isDefined)
    .toArray()

  return [
    ...updateChangeErrors,
  ]
}

export default changeValidator
