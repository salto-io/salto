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
import { values, collections } from '@salto-io/lowerdash'
import { ChangeValidator, getChangeElement,
  isAdditionChange, InstanceElement, isInstanceChange, ChangeError } from '@salto-io/adapter-api'
import _ from 'lodash'
import { SAVED_SEARCH } from '../constants'
import { parseDefinition } from '../saved_search_parser'

const { awu } = collections.asynciterable
const { isDefined } = values
const wasModified = async (instance:InstanceElement):Promise<boolean> => {
  const p = await parseDefinition(instance.value.definition)
  return Object.keys(p).some((i:string) => !_.isEqual(p[i], instance.value[i]))
}


const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionChange)
    .filter(isInstanceChange)
    .map(async change => {
      const instance = getChangeElement(change)
      if (instance.elemID.typeName !== SAVED_SEARCH) {
        return undefined
      }
      if (!(await wasModified(instance))) {
        return undefined
      }
      return {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Modified added saved searches cannot be deployed.',
        detailedMessage: `Changing (${instance.elemID.name}) is not supported`,
      } as ChangeError
    })
    .filter(isDefined)
    .toArray()
)

export default changeValidator
