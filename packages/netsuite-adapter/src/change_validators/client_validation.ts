/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { FEATURE_NAME, multiLanguageErrorDetectors, OBJECT_ID } from '../client/language_utils'
import { Filter } from '../filter'
import { cloneChange } from './utils'

const log = logger(module)
const { awu } = collections.asynciterable

const toChangeErrors = (errors: SaltoElementError[]): ChangeError[] => {
  const missingDependenciesRegexes = Object.values(multiLanguageErrorDetectors).map(
    regexes => regexes.manifestErrorDetailsRegex,
  )
  const [missingDependenciesErrors, nonMissingDependenciesErrors] = _.partition(errors, error =>
    missingDependenciesRegexes.some(regex => getGroupItemFromRegex(error.detailedMessage, regex, OBJECT_ID).length > 0),
  )

  const missingDependenciesChangeErrors = Object.values(
    _.groupBy(missingDependenciesErrors, error => error.elemID.getFullName()),
  ).map(elementErrors => {
    const missingDependencies = _.uniq(
      elementErrors.flatMap(error =>
        missingDependenciesRegexes.flatMap(regex => getGroupItemFromRegex(error.detailedMessage, regex, OBJECT_ID)),
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

  const missingFeatureInAccountRegexes = Object.values(multiLanguageErrorDetectors).map(
    regexes => regexes.missingFeatureInAccountErrorRegex,
  )
  const [missingFeatureErrors, unclassifiedErrors] = _.partition(nonMissingDependenciesErrors, error =>
    missingFeatureInAccountRegexes.some(
      regex => getGroupItemFromRegex(error.detailedMessage, regex, FEATURE_NAME).length > 0,
    ),
  )

  const missingFeatureChangeErrors = Object.values(
    _.groupBy(missingFeatureErrors, error => error.elemID.getFullName()),
  ).map(elementErrors => {
    const missingFeatures = _.uniq(
      elementErrors.flatMap(error =>
        missingFeatureInAccountRegexes.flatMap(regex =>
          getGroupItemFromRegex(error.detailedMessage, regex, FEATURE_NAME),
        ),
      ),
    )

    return {
      elemID: elementErrors[0].elemID,
      severity: 'Error' as const,
      message: 'This element requires features that are not enabled in the account',
      detailedMessage:
        `Cannot deploy element because of required features that are not enabled in the target account: ${missingFeatures.join(', ')}.` +
        ' Please refer to https://help.salto.io/en/articles/9221278-sdf-validation-fails-on-missing-feature for more information.',
    }
  })

  return unclassifiedErrors
    .map(error => ({
      elemID: error.elemID,
      severity: error.severity,
      message: 'Error reported from NetSuite',
      detailedMessage: `SDF validation resulted in some errors. To learn more about SDF validations, visit https://help.salto.io/en/articles/10050892-understanding-sdf-validations-in-netsuite-deployments\n\n${error.detailedMessage}`,
    }))
    .concat(missingDependenciesChangeErrors)
    .concat(missingFeatureChangeErrors)
}

type ClientChangeValidator = (
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
      const realGroupChanges = groupChanges.filter(change => realChangesGroupIdMap.get(changeId(change)) === groupId)
      if (realGroupChanges.length === 0) {
        return []
      }

      const clonedChanges = groupChanges.map(cloneChange)
      await filtersRunner(groupId).preDeploy(clonedChanges)
      const errors = await client.validate(clonedChanges, groupId, additionalDependencies)
      const originalChangesElemIds = new Set(realGroupChanges.map(change => getChangeData(change).elemID.getFullName()))

      const [saltoElementErrors, saltoErrors] = _.partition(errors, isSaltoElementError)

      const originalChangesErrors = saltoElementErrors.filter(error => {
        if (!originalChangesElemIds.has(error.elemID.createBaseID().parent.getFullName())) {
          log.warn('ignoring error on element that is not in the original changes list: %o', error)
          return false
        }
        return true
      })

      const errorsOnAllChanges = saltoErrors.flatMap(error =>
        realGroupChanges.map(change => ({
          elemID: getChangeData(change).elemID,
          message: error.message,
          detailedMessage: error.detailedMessage,
          severity: error.severity,
        })),
      )

      return toChangeErrors(originalChangesErrors.concat(errorsOnAllChanges))
    })
    .toArray()
}

export default changeValidator
