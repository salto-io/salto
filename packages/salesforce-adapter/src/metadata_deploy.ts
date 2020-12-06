/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { DeployResult, Change, getChangeElement, isRemovalChange, isModificationChange, isInstanceChange, isContainerType, isAdditionChange } from '@salto-io/adapter-api'
import { DeployResult as SFDeployResult, DeployMessage } from 'jsforce'
import SalesforceClient from './client/client'
import { createDeployPackage, DeployPackage } from './transformers/xml_transformer'
import { isMetadataInstanceElement, apiName, metadataType, isMetadataObjectType, MetadataInstanceElement, assertMetadataObjectType } from './transformers/transformer'
import { fullApiName } from './filters/utils'
import { INSTANCE_FULL_NAME_FIELD } from './constants'
import { RunTestsResult } from './client/jsforce'

const { makeArray } = collections.array
const log = logger(module)

// Put this marker in the value of an instance if it is just a wrapper for child instances
// and is not meant to actually be deployed
export const DEPLOY_WRAPPER_INSTANCE_MARKER = '_magic_constant_that_means_this_is_a_wrapper_instance'

// Mapping of metadata type to fullNames
type MetadataIdsMap = Record<string, Set<string>>

const addNestedInstancesToPackageManifest = (
  pkg: DeployPackage,
  nestedTypeInfo: NestedMetadataTypeInfo,
  change: Change<MetadataInstanceElement>,
  addNestedAfterInstances: boolean,
): MetadataIdsMap => {
  const changeElem = getChangeElement(change)

  const getNestedInstanceApiName = (name: string): string => (
    nestedTypeInfo.isNestedApiNameRelative
      ? fullApiName(apiName(changeElem), name)
      : name
  )

  const addNestedInstancesFromField = (fieldName: string): MetadataIdsMap => {
    const rawFieldType = changeElem.getType().fields[fieldName]?.getType()
    // We generally expect these to be lists, handling non list types just in case of a bug
    const fieldType = isContainerType(rawFieldType) ? rawFieldType.getInnerType() : rawFieldType
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

    const idsToDelete = removedNestedInstances
      .map(getNestedInstanceApiName)

    idsToDelete.forEach(nestedInstName => {
      pkg.delete(fieldType, nestedInstName)
    })

    const idsToAdd = addNestedAfterInstances
      ? [...nestedAfter].map(getNestedInstanceApiName)
      : []

    idsToAdd.forEach(nestedInstName => {
      pkg.addToManifest(fieldType, nestedInstName)
    })

    return { [metadataType(fieldType)]: new Set([...idsToDelete, ...idsToAdd]) }
  }

  return Object.assign(
    {},
    ...nestedTypeInfo.nestedInstanceFields.map(addNestedInstancesFromField)
  )
}

const addChangeToPackage = (
  pkg: DeployPackage,
  change: Change<MetadataInstanceElement>,
  nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>
): MetadataIdsMap => {
  const instance = getChangeElement(change)
  const isWrapperInstance = _.get(instance.value, DEPLOY_WRAPPER_INSTANCE_MARKER) === true

  const addInstanceToManifest = !isWrapperInstance
  const addedIds = addInstanceToManifest
    ? { [metadataType(instance)]: new Set([apiName(instance)]) }
    : {}

  if (isRemovalChange(change)) {
    pkg.delete(assertMetadataObjectType(instance.getType()), apiName(instance))
  } else {
    pkg.add(instance, addInstanceToManifest)
  }

  // Handle child xml instances
  const nestedTypeInfo = nestedMetadataTypes[metadataType(instance)]
  if (nestedTypeInfo !== undefined) {
    const addChildInstancesToManifest = isWrapperInstance
    const nestedInstanceIds = addNestedInstancesToPackageManifest(
      pkg,
      nestedTypeInfo,
      change,
      addChildInstancesToManifest,
    )
    Object.assign(addedIds, nestedInstanceIds)
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
): { successfulFullNames: ReadonlyArray<MetadataId>; errors: ReadonlyArray<Error> } => {
  const allFailureMessages = makeArray(result.details)
    .flatMap(detail => makeArray(detail.componentFailures))

  const testFailures = makeArray(result.details)
    .flatMap(detail => makeArray((detail.runTestResult as RunTestsResult)?.failures))

  const testErrors = testFailures
    .map(failure => new Error(
      `Test failed for class ${failure.name} method ${failure.methodName} with error:\n${failure.message}\n${failure.stackTrace}`
    ))

  const componentErrors = allFailureMessages
    .filter(failure => !isUnFoundDelete(failure, deletionsPackageName))
    .map(failure => new Error(
      `Failed to deploy ${failure.fullName} with error: ${failure.problem} (${failure.problemType})`
    ))

  const errors = [...testErrors, ...componentErrors]

  if (result.checkOnly || (result.rollbackOnError && !result.success)) {
    // In checkOnly none of the changes are actually applied
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
    .filter(values.isDefined)

  const successfulFullNames = allSuccessMessages
    .map(success => ({ type: success.componentType, fullName: success.fullName }))
    .concat(unFoundDeleteNames)

  return { successfulFullNames, errors }
}

export type NestedMetadataTypeInfo = {
  nestedInstanceFields: string[]
  isNestedApiNameRelative: boolean
}

const getChangeError = (change: Change): string | undefined => {
  const changeElem = getChangeElement(change)
  if (apiName(changeElem) === undefined) {
    return `Cannot ${change.action} element because it has no api name`
  }
  if (isModificationChange(change)) {
    const beforeName = apiName(change.data.before)
    const afterName = apiName(change.data.after)
    if (beforeName !== afterName) {
      return `Failed to update element because api names prev=${beforeName} and new=${afterName} are different`
    }
  }
  if (!isInstanceChange(change) || !isMetadataInstanceElement(changeElem)) {
    return 'Cannot deploy because it is not a metadata instance'
  }
  return undefined
}

const validateChanges = (
  changes: ReadonlyArray<Change>
): { validChanges: ReadonlyArray<Change<MetadataInstanceElement>>; errors: Error[] } => {
  const changesAndValidation = changes.map(change => ({ change, error: getChangeError(change) }))

  const [invalidChanges, validChanges] = _.partition(
    changesAndValidation,
    ({ error }) => values.isDefined(error)
  )

  const errors = invalidChanges
    .map(({ change, error }) => (
      new Error(`${getChangeElement(change).elemID.getFullName()}: ${error}}`)
    ))

  return {
    // We can cast to MetadataInstanceElement here because we will have an error for changes that
    // are not metadata instance changes
    validChanges: validChanges.map(({ change }) => change as Change<MetadataInstanceElement>),
    errors,
  }
}


export const deployMetadata = async (
  changes: ReadonlyArray<Change>,
  client: SalesforceClient,
  nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>,
  deleteBeforeUpdate?: boolean,
): Promise<DeployResult> => {
  const pkg = createDeployPackage(deleteBeforeUpdate)

  const { validChanges, errors: validationErrors } = validateChanges(changes)

  if (validChanges.length === 0) {
    // Skip deploy if there are no valid changes
    return { appliedChanges: [], errors: validationErrors }
  }

  const changeToDeployedIds: Record<string, MetadataIdsMap> = {}
  validChanges.forEach(change => {
    const deployedIds = addChangeToPackage(pkg, change, nestedMetadataTypes)
    changeToDeployedIds[getChangeElement(change).elemID.getFullName()] = deployedIds
  })

  const pkgData = await pkg.getZip()

  const deployRes = await client.deploy(pkgData)

  log.debug('deploy result: %s', JSON.stringify(deployRes, undefined, 2))

  const { errors, successfulFullNames } = processDeployResponse(
    deployRes, pkg.getDeletionsPackageName()
  )

  const isSuccessfulChange = (change: Change<MetadataInstanceElement>): boolean => {
    const changeElem = getChangeElement(change)
    const changeDeployedIds = changeToDeployedIds[changeElem.elemID.getFullName()]
    // TODO - this logic is not perfect, it might produce false positives when there are
    // child xml instances (because we pass in everything with a single change)
    return successfulFullNames.some(
      successfulId => changeDeployedIds[successfulId.type]?.has(successfulId.fullName)
    )
  }

  return {
    appliedChanges: validChanges.filter(isSuccessfulChange),
    errors: [...validationErrors, ...errors],
  }
}
