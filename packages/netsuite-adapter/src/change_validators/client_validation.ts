/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  Change,
  ChangeError,
  changeId,
  getChangeData,
  isSaltoElementError,
  SaltoElementError,
} from '@salto-io/adapter-api'
import { AdditionalDependencies } from '../config/types'
import { getGroupItemFromRegex } from '../client/utils'
import NetsuiteClient from '../client/client'
import { getChangeGroupIdsFunc } from '../group_changes'
import { multiLanguageErrorDetectors, OBJECT_ID } from '../client/language_utils'
import { Filter } from '../filter'
import { cloneChange } from './utils'

const log = logger(module)
const { awu } = collections.asynciterable

const toChangeErrors = (errors: SaltoElementError[]): ChangeError[] => {
  const missingDependenciesRegexes = Object.values(multiLanguageErrorDetectors).map(
    regexes => regexes.manifestErrorDetailsRegex,
  )
  const [missingDependenciesErrors, otherErrors] = _.partition(errors, error =>
    missingDependenciesRegexes.some(regex => getGroupItemFromRegex(error.message, regex, OBJECT_ID).length > 0),
  )

  const missingDependenciesChangeErrors = Object.values(
    _.groupBy(missingDependenciesErrors, error => error.elemID.getFullName()),
  ).map(elementErrors => {
    const missingDependencies = _.uniq(
      elementErrors.flatMap(error =>
        missingDependenciesRegexes.flatMap(regex => getGroupItemFromRegex(error.message, regex, OBJECT_ID)),
      ),
    )

    return {
      elemID: elementErrors[0].elemID,
      severity: 'Error' as const,
      message: 'This element depends on missing elements',
      detailedMessage:
        `Cannot deploy elements because of missing dependencies: ${missingDependencies.join(', ')}.` +
        ' The missing dependencies might be locked elements in the source environment which do not exist in the target environment.' +
        ' Moreover, the dependencies might be part of a 3rd party bundle or SuiteApp.' +
        ' If so, please make sure that all the bundles from the source account are installed and updated in the target account.',
    }
  })

  return otherErrors
    .map(error => ({
      elemID: error.elemID,
      severity: error.severity,
      message: 'SDF validation error',
      detailedMessage: error.message,
    }))
    .concat(missingDependenciesChangeErrors)
}

export type ClientChangeValidator = (
  changes: ReadonlyArray<Change>,
  client: NetsuiteClient,
  additionalDependencies: AdditionalDependencies,
  filtersRunner: (groupID: string) => Required<Filter>,
) => Promise<ReadonlyArray<ChangeError>>

const changeValidator: ClientChangeValidator = async (changes, client, additionalDependencies, filtersRunner) => {
  const changesMap = new Map(changes.map(change => [changeId(change), change]))
  // SALTO-3016 we can validate only SDF elements because
  // we need FileCabinet references to be included in the SDF project
  const { changeGroupIdMap } = await getChangeGroupIdsFunc(false)(changesMap)
  const changesByGroupId = _(changes)
    .filter(change => changeGroupIdMap.has(changeId(change)))
    .groupBy(change => changeGroupIdMap.get(changeId(change)))
    .entries()
    .value()

  const { changeGroupIdMap: realChangesGroupIdMap } = await getChangeGroupIdsFunc(client.isSuiteAppConfigured())(
    changesMap,
  )

  return awu(changesByGroupId)
    .flatMap(async ([groupId, groupChanges]) => {
      // SALTO-3016 if the real change group of all changes is different than the one used for validation
      // (e.g. only FileCabinet instances) we should skip the validation.
      if (groupChanges.every(change => realChangesGroupIdMap.get(changeId(change)) !== groupId)) {
        return []
      }

      const clonedChanges = groupChanges.map(cloneChange)
      await filtersRunner(groupId).preDeploy(clonedChanges)
      const errors = await client.validate(clonedChanges, groupId, additionalDependencies)
      const originalChangesElemIds = new Set(groupChanges.map(change => getChangeData(change).elemID.getFullName()))

      const [saltoElementErrors, saltoErrors] = _.partition(errors, isSaltoElementError)

      const originalChangesErrors = saltoElementErrors.filter(error => {
        if (!originalChangesElemIds.has(error.elemID.createBaseID().parent.getFullName())) {
          log.warn('ignoring error on element that is not in the original changes list: %o', error)
          return false
        }
        return true
      })

      const errorsOnAllChanges = saltoErrors.flatMap(error =>
        groupChanges.map(change => ({
          elemID: getChangeData(change).elemID,
          message: error.message,
          severity: error.severity,
        })),
      )

      return toChangeErrors(originalChangesErrors.concat(errorsOnAllChanges))
    })
    .toArray()
}

export default changeValidator
