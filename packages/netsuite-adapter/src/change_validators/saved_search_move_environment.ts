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
import { collections } from '@salto-io/lowerdash'
import { ChangeValidator, getChangeElement,
  isAdditionChange, InstanceElement, isInstanceChange, ChangeError } from '@salto-io/adapter-api'
import _ from 'lodash'
import { SAVED_SEARCH } from '../constants'
import { parseDefinition } from '../saved_search_parser'

const { awu } = collections.asynciterable
const wasModified = async (instance:InstanceElement):Promise<boolean> => {
  const parsedDefinition = await parseDefinition(instance.value.definition)
  return Object.keys(parsedDefinition)
    .some((i:string) => !_.isEqual(parsedDefinition[i], instance.value[i]))
}

const getChangeError = async (instance: InstanceElement):Promise<ChangeError> => {
  if (await wasModified(instance)) {
    return ({
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Modified added saved searches cannot be deployed.',
      detailedMessage: `Changing (${instance.elemID.name}) is not supported`,
    } as ChangeError)
  }
  return ({
    elemID: instance.elemID,
    severity: 'Warning',
    message: 'Added saved searches might be curropted when moving to a new environment.',
    detailedMessage: `Instance (${instance.elemID.name}) might be Corrupted after this operation`,
  } as ChangeError)
}


const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .filter(isAdditionChange)
    .filter(isInstanceChange)
    .map(getChangeElement)
    .filter(instance => instance.elemID.typeName === SAVED_SEARCH)
    .map(getChangeError)
    .toArray()
)

export default changeValidator
