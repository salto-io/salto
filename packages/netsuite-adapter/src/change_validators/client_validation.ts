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
import { Change, ChangeError, changeId, getChangeData, Element } from '@salto-io/adapter-api'
import NetsuiteClient from '../client/client'
import { AdditionalDependencies } from '../client/types'
import { getChangeGroupIdsFunc } from '../group_changes'
import { ManifestValidationError, ObjectsDeployError, SettingsDeployError } from '../errors'
import { SCRIPT_ID } from '../constants'
import { getElementValueOrAnnotations } from '../types'
import { Filter } from '../filter'

const { awu } = collections.asynciterable

const scriptIdRegex = RegExp('\\([a-z_0-9]+\\)', 'gm')

const mapObjectDeployErrorToInstance = (error: Error): Record<string, string> => {
  const scriptIdToErrorRecord: Record<string, string> = {}
  const errorLines = error.message.split('\n')
  errorLines.forEach((line, index) => {
    const caughtScriptId = line.match(scriptIdRegex)
    if (caughtScriptId) {
      const cleanScriptId = caughtScriptId[0].slice(1, -1)
      scriptIdToErrorRecord[cleanScriptId] = errorLines[index + 1]
    }
  })
  return scriptIdToErrorRecord
}

export type ClientChangeValidator = (
  changes: ReadonlyArray<Change>,
  client: NetsuiteClient,
  additionalDependencies: AdditionalDependencies,
  filtersRunner: Required<Filter>,
  deployReferencedElements?: boolean
) => Promise<ReadonlyArray<ChangeError>>

const changeValidator: ClientChangeValidator = async (
  changes, client, additionalDependencies, filtersRunner, deployReferencedElements = false
) => {
  const clonedChanges = changes.map(change => ({
    action: change.action,
    data: _.mapValues(change.data, (element: Element) => element.clone()),
  })) as Change[]
  await filtersRunner.preDeploy(clonedChanges)
  const getChangeGroupIds = getChangeGroupIdsFunc(client.isSuiteAppConfigured())
  const { changeGroupIdMap } = await getChangeGroupIds(
    new Map(clonedChanges.map(change => [changeId(change), change]))
  )
  const changesByGroupId = _(clonedChanges)
    .filter(change => changeGroupIdMap.has(changeId(change)))
    .groupBy(change => changeGroupIdMap.get(changeId(change)))
    .entries()
    .value()

  return awu(changesByGroupId)
    .flatMap(async ([groupId, groupChanges]) => {
      const errors = await client.validate(
        groupChanges,
        groupId,
        deployReferencedElements,
        additionalDependencies
      )
      if (errors.length > 0) {
        return errors.flatMap(error => {
          if (error instanceof ObjectsDeployError) {
            const scriptIdToErrorMap = mapObjectDeployErrorToInstance(error)
            return groupChanges.map(getChangeData)
              .filter(element => error.failedObjects.has(
                getElementValueOrAnnotations(element)[SCRIPT_ID]
              ))
              .map(element => ({
                message: 'SDF Objects Validation Error',
                severity: 'Error' as const,
                elemID: element.elemID,
                detailedMessage:
                scriptIdToErrorMap[getElementValueOrAnnotations(element)[SCRIPT_ID]],
              }))
          }
          if (error instanceof SettingsDeployError) {
            return groupChanges.map(change => ({
              message: 'SDF Settings Validation Error',
              severity: 'Error' as const,
              elemID: getChangeData(change).elemID,
              detailedMessage: error.message,
            }))
          }
          const message = error instanceof ManifestValidationError
            ? 'SDF Manifest Validation Error'
            : `Validation Error on ${groupId}`
          return groupChanges.map(change => ({
            message,
            severity: 'Error' as const,
            elemID: getChangeData(change).elemID,
            detailedMessage: error.message,
          }))
        })
      }
      return []
    })
    .toArray()
}

export default changeValidator
