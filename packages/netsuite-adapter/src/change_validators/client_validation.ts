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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { Change, ChangeError, changeId, getChangeData } from '@salto-io/adapter-api'
import NetsuiteClient from '../client/client'
import { AdditionalDependencies } from '../client/types'
import { getChangeGroupIdsFunc } from '../group_changes'
import { ObjectsValidationError, ManifestValidationError } from '../errors'
import { SCRIPT_ID } from '../constants'
import { getElementValueOrAnnotations } from '../types'

const { awu } = collections.asynciterable

export type ClientChangeValidator = (
  changes: ReadonlyArray<Change>,
  client: NetsuiteClient,
  additionalDependencies: AdditionalDependencies,
  deployReferencedElements?: boolean
) => Promise<ReadonlyArray<ChangeError>>

const changeValidator: ClientChangeValidator = async (
  changes, client, additionalDependencies, deployReferencedElements = false
) => {
  const getChangeGroupIds = getChangeGroupIdsFunc(client.isSuiteAppConfigured())
  const { changeGroupIdMap } = await getChangeGroupIds(
    new Map(changes.map(change => [changeId(change), change]))
  )
  const changesByGroupId = _(changes)
    .filter(change => changeGroupIdMap.has(changeId(change)))
    .groupBy(change => changeGroupIdMap.get(changeId(change)))
    .entries()
    .value()

  return awu(changesByGroupId)
    .flatMap(async ([groupId, groupChanges]) => {
      try {
        await client.validate(
          groupChanges,
          groupId,
          deployReferencedElements,
          additionalDependencies
        )
        return []
      } catch (error) {
        if (error instanceof ObjectsValidationError) {
          return groupChanges.map(getChangeData)
            .filter(element => error.invalidObjects.has(
              getElementValueOrAnnotations(element)[SCRIPT_ID]
            ))
            .map(element => ({
              message: 'SDF Objects Validation Error',
              severity: 'Warning' as const,
              elemID: element.elemID,
              detailedMessage: error.invalidObjects.get(
                getElementValueOrAnnotations(element)[SCRIPT_ID]
              ),
            }))
        }
        const message = error instanceof ManifestValidationError
          ? 'SDF Manifest Validation Error'
          : `Validation Error on ${groupId}`
        return groupChanges.map(change => ({
          message,
          severity: 'Warning' as const,
          elemID: getChangeData(change).elemID,
          detailedMessage: error.message,
        }))
      }
    })
    .toArray()
}

export default changeValidator
