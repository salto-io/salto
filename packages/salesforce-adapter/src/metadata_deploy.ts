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
import util from 'util'
import { collections, values, hash as hashUtils } from '@salto-io/lowerdash'
import { safeJsonStringify } from '@salto-io/adapter-utils'
import { SaltoError,
  DeployResult,
  Change,
  getChangeData,
  isRemovalChange,
  isModificationChange,
  isInstanceChange,
  isContainerType,
  isAdditionChange,
  SaltoElementError,
  SeverityLevel,
  ElemID } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'


import { DeployResult as SFDeployResult, DeployMessage } from 'jsforce'

import SalesforceClient from './client/client'
import { createDeployPackage, DeployPackage } from './transformers/xml_transformer'
import { isMetadataInstanceElement, apiName, metadataType, isMetadataObjectType, MetadataInstanceElement, assertMetadataObjectType } from './transformers/transformer'
import { fullApiName } from './filters/utils'
import { GLOBAL_VALUE_SET_SUFFIX, INSTANCE_FULL_NAME_FIELD } from './constants'
import { RunTestsResult } from './client/jsforce'
import { getUserFriendlyDeployMessage } from './client/user_facing_errors'
import { QuickDeployParams } from './types'
import { GLOBAL_VALUE_SET } from './filters/global_value_sets'

const { awu } = collections.asynciterable
const { isDefined } = values

const { makeArray } = collections.array
const log = logger(module)

// Put this marker in the value of an instance if it is just a wrapper for child instances
// and is not meant to actually be deployed
export const DEPLOY_WRAPPER_INSTANCE_MARKER = '_magic_constant_that_means_this_is_a_wrapper_instance'

// Mapping of metadata type to fullNames
type MetadataIdsMap = Record<string, Set<string>>

export type NestedMetadataTypeInfo = {
  nestedInstanceFields: string[]
  isNestedApiNameRelative: boolean
}

const addNestedInstancesToPackageManifest = async (
  pkg: DeployPackage,
  nestedTypeInfo: NestedMetadataTypeInfo,
  change: Change<MetadataInstanceElement>,
  addNestedAfterInstances: boolean,
): Promise<MetadataIdsMap> => {
  const changeElem = getChangeData(change)

  const getNestedInstanceApiName = async (name: string): Promise<string> => (
    nestedTypeInfo.isNestedApiNameRelative
      ? fullApiName(await apiName(changeElem), name)
      : name
  )

  const addNestedInstancesFromField = async (fieldName: string): Promise<MetadataIdsMap> => {
    const rawFieldType = await (await changeElem.getType()).fields[fieldName]?.getType()
    // We generally expect these to be lists, handling non list types just in case of a bug
    const fieldType = isContainerType(rawFieldType)
      ? await rawFieldType.getInnerType()
      : rawFieldType
    if (!isMetadataObjectType(fieldType)) {
      log.error(
        'cannot deploy nested instances in %s field %s because the field type %s is not a metadata type',
        changeElem.elemID.getFullName(), fieldName, fieldType?.elemID.getFullName(),
      )
      return {}
    }
    const nestedAfter = new Set(
      isRemovalChange(change)
        ? []
        : makeArray(change.data.after.value[fieldName])
          .map(item => item[INSTANCE_FULL_NAME_FIELD])
    )
    const nestedBefore = isAdditionChange(change)
      ? []
      : makeArray(change.data.before.value[fieldName])
        .map(item => item[INSTANCE_FULL_NAME_FIELD])

    const removedNestedInstances = nestedBefore.filter(instName => !nestedAfter.has(instName))

    const idsToDelete = await Promise.all(removedNestedInstances
      .map(getNestedInstanceApiName))

    idsToDelete.forEach(nestedInstName => {
      pkg.delete(fieldType, nestedInstName)
    })

    const idsToAdd = addNestedAfterInstances
      ? await Promise.all([...nestedAfter].map(getNestedInstanceApiName))
      : []

    idsToAdd.forEach(nestedInstName => {
      pkg.addToManifest(fieldType, nestedInstName)
    })

    return { [await metadataType(fieldType)]: new Set([...idsToDelete, ...idsToAdd]) }
  }

  return Object.assign(
    {},
    ...await Promise.all(nestedTypeInfo.nestedInstanceFields.map(addNestedInstancesFromField))
  )
}

const addChangeToPackage = async (
  pkg: DeployPackage,
  change: Change<MetadataInstanceElement>,
  nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>
): Promise<MetadataIdsMap> => {
  const instance = getChangeData(change)
  const isWrapperInstance = _.get(instance.value, DEPLOY_WRAPPER_INSTANCE_MARKER) === true
  const instanceMetadataType = await metadataType(instance)
  const instanceApiName = await apiName(instance)

  const addInstanceToManifest = !isWrapperInstance
  const addedIds = addInstanceToManifest
    ? { [instanceMetadataType]: new Set([instanceApiName]) }
    : {}
  if (isRemovalChange(change)) {
    pkg.delete(assertMetadataObjectType(await instance.getType()), instanceApiName)
  } else {
    await pkg.add(instance, addInstanceToManifest)
  }

  // Handle child xml instances
  const nestedTypeInfo = nestedMetadataTypes[await metadataType(instance)]
  if (nestedTypeInfo !== undefined) {
    const addChildInstancesToManifest = isWrapperInstance
    const nestedInstanceIds = await addNestedInstancesToPackageManifest(
      pkg,
      nestedTypeInfo,
      change,
      addChildInstancesToManifest,
    )
    Object.assign(addedIds, nestedInstanceIds)
  }

  // Handle special case with global value sets - in version 57.0 salesforce changed the behavior
  // of user-defined global value sets such that their name must end with __gvs. however, it is still possible
  // to address existing value sets and create new ones without the suffix.
  // this causes some confusion and the API will sometimes return the fullName differently from how it was sent.
  // adding the __gvs suffix to the deployedIds works because we consider a deployment of a change successful if
  // any of its related deployed IDs are successful, this means that we will consider the global value set change
  // successful even if it came back with the __gvs suffix
  if (instanceMetadataType === GLOBAL_VALUE_SET && !instanceApiName.endsWith(GLOBAL_VALUE_SET_SUFFIX)) {
    addedIds[instanceMetadataType].add(`${instanceApiName}${GLOBAL_VALUE_SET_SUFFIX}`)
  }

  return addedIds
}

type MetadataId = {
  type: string
  fullName: string
}

const getUnFoundDeleteName = (
  message: DeployMessage,
  deletionsPackageName: string
): MetadataId | undefined => {
  const match = (
    message.fullName === deletionsPackageName && message.problemType === 'Warning'
  )
    ? message.problem.match(/No.*named: (?<fullName>.*) found/)
    : undefined
  const fullName = match?.groups?.fullName
  return fullName === undefined ? undefined : { type: message.componentType, fullName }
}

const isUnFoundDelete = (message: DeployMessage, deletionsPackageName: string): boolean => (
  getUnFoundDeleteName(message, deletionsPackageName) !== undefined
)

const processDeployResponse = (
  result: SFDeployResult,
  deletionsPackageName: string,
  checkOnly: boolean,
): { successfulFullNames: ReadonlyArray<MetadataId>; errors: ReadonlyArray<SaltoError | SaltoElementError> } => {
  const allFailureMessages = makeArray(result.details)
    .flatMap(detail => makeArray(detail.componentFailures))

  const testFailures = makeArray(result.details)
    .flatMap(detail => makeArray((detail.runTestResult as RunTestsResult)?.failures))
  const testErrors: SaltoError[] = testFailures
    .map(failure => ({
      message: util.format(
        'Test failed for class %s method %s with error:\n%s\n%s',
        failure.name,
        failure.methodName,
        failure.message,
        failure.stackTrace
      ),
      severity: 'Error' as SeverityLevel,
    }))
  const componentErrors = allFailureMessages
    .filter(failure => !isUnFoundDelete(failure, deletionsPackageName))
    .map(getUserFriendlyDeployMessage)
    .map(failure => (
      { elemID: ElemID.fromFullName(failure.fullName),
        message: `Failed to ${checkOnly ? 'validate' : 'deploy'} ${failure.fullName} with error: ${failure.problem} (${failure.problemType})`,
        severity: 'Error' as SeverityLevel }
    ))
  const codeCoverageWarningErrors = makeArray(result.details)
    .map(detail => detail.runTestResult as RunTestsResult | undefined)
    .flatMap(runTestResult => makeArray(runTestResult?.codeCoverageWarnings))
    .map(codeCoverageWarning => codeCoverageWarning.message)
    .map(message => ({ message, severity: 'Error' as SeverityLevel }))

  const errors = [...testErrors, ...componentErrors, ...codeCoverageWarningErrors]

  if (isDefined(result.errorMessage)) {
    errors.push({ message: result.errorMessage, severity: 'Error' as SeverityLevel })
  }

  // In checkOnly none of the changes are actually applied
  if (!result.checkOnly && result.rollbackOnError && !result.success) {
    // if rollbackOnError and we did not succeed, nothing was applied as well
    return { successfulFullNames: [], errors }
  }

  const allSuccessMessages = makeArray(result.details)
    .flatMap(detail => makeArray(detail.componentSuccesses))

  // We want to treat deletes for things we haven't found as success
  // Note that if we deploy with ignoreWarnings, these might show up in the success list
  // so we have to look for these messages in both lists
  const unFoundDeleteNames = [...allSuccessMessages, ...allFailureMessages]
    .map(message => getUnFoundDeleteName(message, deletionsPackageName))
    .filter(isDefined)

  const successfulFullNames = allSuccessMessages
    .map(success => ({ type: success.componentType, fullName: success.fullName }))
    .concat(unFoundDeleteNames)

  return { successfulFullNames, errors }
}

const getChangeError = async (change: Change): Promise<SaltoElementError | undefined> => {
  const changeElem = getChangeData(change)
  if (await apiName(changeElem) === undefined) {
    return { elemID: changeElem.elemID, message: `Cannot ${change.action} element because it has no api name`, severity: 'Error' }
  }
  if (isModificationChange(change)) {
    const beforeName = await apiName(change.data.before)
    const afterName = await apiName(change.data.after)
    if (beforeName !== afterName) {
      return { elemID: changeElem.elemID, message: `Failed to update element because api names prev=${beforeName} and new=${afterName} are different`, severity: 'Error' }
    }
  }
  if (!isInstanceChange(change) || !await isMetadataInstanceElement(changeElem)) {
    return { elemID: changeElem.elemID, message: 'Cannot deploy because it is not a metadata instance', severity: 'Error' }
  }
  return undefined
}

const validateChanges = async (
  changes: ReadonlyArray<Change>
): Promise<{
    validChanges: ReadonlyArray<Change<MetadataInstanceElement>>
    errors: (SaltoError | SaltoElementError)[]
  }> => {
  const changesAndValidation = await awu(changes)
    .map(async change => ({ change, error: await getChangeError(change) }))
    .toArray()

  const [invalidChanges, validChanges] = _.partition(
    changesAndValidation,
    ({ error }) => isDefined(error)
  )

  const errors = invalidChanges
    .filter(change => isDefined(change.error))
    .map(({ error }) => error) as SaltoElementError[]

  return {
    // We can cast to MetadataInstanceElement here because we will have an error for changes that
    // are not metadata instance changes
    validChanges: validChanges.map(({ change }) => change as Change<MetadataInstanceElement>),
    errors,
  }
}

const getDeployStatusUrl = async (
  { id }: SFDeployResult,
  client: SalesforceClient
): Promise<string | undefined> => {
  const baseUrl = await client.getUrl()
  if (baseUrl === undefined) {
    log.warn('Could not resolve Salesforce deployment URL')
    return undefined
  }
  return `${baseUrl}lightning/setup/DeployStatus/page?address=%2Fchangemgmt%2FmonitorDeploymentsDetails.apexp%3FasyncId%3D${id}`
}

const quickDeployOrDeploy = async (
  client: SalesforceClient,
  pkgData: Buffer,
  checkOnly?: boolean,
  quickDeployParams?: QuickDeployParams,
): Promise<SFDeployResult> => {
  if (quickDeployParams !== undefined) {
    try {
      return await client.quickDeploy(quickDeployParams.requestId)
    } catch (e) {
      log.warn(`preforming regular deploy instead of quick deploy due to error: ${e.message}`)
    }
  }
  return client.deploy(pkgData, { checkOnly })
}
const isQuickDeployable = (deployRes: SFDeployResult): boolean =>
  deployRes.id !== undefined && deployRes.checkOnly && deployRes.success && deployRes.numberTestsCompleted >= 1

export const deployMetadata = async (
  changes: ReadonlyArray<Change>,
  client: SalesforceClient,
  groupId: string,
  nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>,
  deleteBeforeUpdate?: boolean,
  checkOnly?: boolean,
  quickDeployParams?: QuickDeployParams,
): Promise<DeployResult> => {
  const pkg = createDeployPackage(deleteBeforeUpdate)

  const { validChanges, errors: validationErrors } = await validateChanges(changes)
  if (validChanges.length === 0) {
    // Skip deploy if there are no valid changes
    return { appliedChanges: [], errors: validationErrors }
  }
  const changeToDeployedIds: Record<string, MetadataIdsMap> = {}
  await awu(validChanges).forEach(async change => {
    const deployedIds = await addChangeToPackage(pkg, change, nestedMetadataTypes)
    changeToDeployedIds[getChangeData(change).elemID.getFullName()] = deployedIds
  })

  const pkgData = await pkg.getZip()
  const planHash = hashUtils.toMD5(pkgData)
  if (quickDeployParams !== undefined) {
    if (quickDeployParams.hash !== planHash) {
      return {
        appliedChanges: [],
        errors: [{ message: 'Quick deploy option is not available because the current deploy plan is different than the validated one', severity: 'Error' }],
      }
    }
  }

  const sfDeployRes = await quickDeployOrDeploy(client, pkgData, checkOnly, quickDeployParams)

  log.debug('deploy result: %s', safeJsonStringify({
    ...sfDeployRes,
    details: sfDeployRes.details?.map(detail => ({
      ...detail,
      // The test result can be VERY long
      runTestResult: detail.runTestResult
        ? safeJsonStringify(detail.runTestResult, undefined, 2).slice(100)
        : undefined,
    })),
  }, undefined, 2))

  const { errors, successfulFullNames } = processDeployResponse(
    sfDeployRes, pkg.getDeletionsPackageName(), checkOnly ?? false
  )
  const isSuccessfulChange = (change: Change<MetadataInstanceElement>): boolean => {
    const changeElem = getChangeData(change)
    const changeDeployedIds = changeToDeployedIds[changeElem.elemID.getFullName()]
    // TODO - this logic is not perfect, it might produce false positives when there are
    // child xml instances (because we pass in everything with a single change)
    return successfulFullNames.some(
      successfulId => changeDeployedIds[successfulId.type]?.has(successfulId.fullName)
    )
  }

  const deploymentUrl = await getDeployStatusUrl(sfDeployRes, client)
  return {
    appliedChanges: validChanges.filter(isSuccessfulChange),
    errors: [...validationErrors, ...errors],
    extraProperties: {
      groups: isQuickDeployable(sfDeployRes)
        ? [{ id: groupId, requestId: sfDeployRes.id, hash: planHash, url: deploymentUrl }]
        : [{ id: groupId, url: deploymentUrl }],
    },
  }
}
