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
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { Change, ChangeError, changeId, getChangeData, Element, ChangeDataType, isField, isFieldChange, isInstanceChange, isObjectTypeChange, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { getGroupItemFromRegex, objectValidationErrorRegex, OBJECT_ID } from '../client/sdf_client'
import NetsuiteClient from '../client/client'
import { AdditionalDependencies } from '../client/types'
import { getChangeGroupIdsFunc } from '../group_changes'
import { ManifestValidationError, ObjectsDeployError, SettingsDeployError } from '../client/errors'
import { SCRIPT_ID } from '../constants'
import { getElementValueOrAnnotations } from '../types'
import { Filter } from '../filter'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'


const { awu } = collections.asynciterable
const VALIDATION_FAIL = 'Validation failed.'

type FailedChangeWithDependencies = {
  change: Change<ChangeDataType>
  dependencies: string[]
}

const mapObjectDeployErrorToInstance = (error: Error):
{ get: (changeData: ChangeDataType) => string | undefined } => {
  const scriptIdToErrorRecord: Record<string, string> = {}
  const errorMessageChunks = error.message.split(VALIDATION_FAIL)[1]?.split('\n\n')
  errorMessageChunks.forEach(chunk => {
    const objectErrorScriptId = getGroupItemFromRegex(
      chunk, objectValidationErrorRegex, OBJECT_ID
    )
    objectErrorScriptId.forEach(scriptId => { scriptIdToErrorRecord[scriptId] = chunk })
  })
  return {
    get: changeData => scriptIdToErrorRecord[getElementValueOrAnnotations(changeData)[SCRIPT_ID]] ?? (
      isField(changeData)
        ? scriptIdToErrorRecord[getElementValueOrAnnotations(changeData.parent)[SCRIPT_ID]]
        : undefined
    ),
  }
}

const getFailedChangesWithDependencies = (
  groupChanges:Change<ChangeDataType>[],
  dependencyMap: Map<string, Set<string>>,
  error: ManifestValidationError,
): FailedChangeWithDependencies[] => groupChanges
  .map(change => ({
    change,
    dependencies: error.missingDependencyScriptIds.filter(scriptid =>
      dependencyMap.get(getChangeData(change).elemID.getFullName())?.has(scriptid)
      || (isFieldChange(change)
      && dependencyMap.get(getChangeData(change).parent.elemID.getFullName())?.has(scriptid))),
  }))
  .filter(({ dependencies }) => dependencies.length > 0)


export type ClientChangeValidator = (
  changes: ReadonlyArray<Change>,
  client: NetsuiteClient,
  additionalDependencies: AdditionalDependencies,
  filtersRunner: Required<Filter>,
  elementsSourceIndex: LazyElementsSourceIndexes,
  deployReferencedElements?: boolean
) => Promise<ReadonlyArray<ChangeError>>

const changeValidator: ClientChangeValidator = async (
  changes,
  client,
  additionalDependencies,
  filtersRunner,
  elementsSourceIndex,
) => {
  const clonedChanges = changes.map(change => ({
    action: change.action,
    data: _.mapValues(change.data, (element: Element) => element.clone()),
  })) as Change[]
  await filtersRunner.preDeploy(clonedChanges)

  // SALTO-3016 we can validate only SDF elements because
  // we need FileCabinet references to be included in the SDF project
  const getChangeGroupIds = getChangeGroupIdsFunc(false)
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
        additionalDependencies,
        elementsSourceIndex,
      )
      if (errors.length > 0) {
        const topLevelChanges = changes.filter(
          change => isInstanceChange(change) || isObjectTypeChange(change)
        ) as Change<InstanceElement | ObjectType>[]
        const { dependencyMap } = await NetsuiteClient.createDependencyMapAndGraph(
          topLevelChanges, elementsSourceIndex
        )
        return awu(errors).flatMap(async error => {
          if (error instanceof ObjectsDeployError) {
            const scriptIdToErrorMap = mapObjectDeployErrorToInstance(error)
            return groupChanges.map(getChangeData)
              .filter(element => scriptIdToErrorMap.get(element) !== undefined)
              .map(element => ({
                message: 'SDF Objects Validation Error',
                severity: 'Error' as const,
                elemID: element.elemID,
                detailedMessage: scriptIdToErrorMap.get(element) ?? '',
              }))
          }
          if (error instanceof SettingsDeployError) {
            const failedChanges = groupChanges
              .filter(change => error.failedConfigTypes.has(getChangeData(change).elemID.typeName))
            return (failedChanges.length > 0 ? failedChanges : groupChanges)
              .map(change => ({
                message: 'SDF Settings Validation Error',
                severity: 'Error' as const,
                elemID: getChangeData(change).elemID,
                detailedMessage: error.message,
              }))
          }
          if (error instanceof ManifestValidationError) {
            const failedChangesWithDependencies = getFailedChangesWithDependencies(
              groupChanges, dependencyMap, error
            )
            if (failedChangesWithDependencies.length === 0) {
              return groupChanges.map(change => ({
                message: 'Some elements in this deployment have missing dependencies',
                severity: 'Error' as const,
                elemID: getChangeData(change).elemID,
                detailedMessage: `Cannot deploy elements because of missing dependencies: ${error.missingDependencyScriptIds.join(', ')}. Please make sure that all the bundles from the source account are installed and updated in the target account.`,
              }))
            }
            return failedChangesWithDependencies
              .map(changeAndMissingDependencies => ({
                message: 'This element depends on missing elements',
                severity: 'Error' as const,
                elemID: getChangeData(changeAndMissingDependencies.change).elemID,
                detailedMessage: `This element depends on the following missing elements: ${changeAndMissingDependencies.dependencies.join(', ')}. Please make sure that all the bundles from the source account are installed and updated in the target account.`,
              }))
          }
          return groupChanges
            .map(change => ({
              message: `Validation Error on ${groupId}`,
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
