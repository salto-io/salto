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
import util from 'util'
import { collections, values, hash as hashUtils } from '@salto-io/lowerdash'
import { safeJsonStringify, naclCase } from '@salto-io/adapter-utils'
import {
  SaltoError,
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
  Artifact,
  ProgressReporter,
  ElemID,
  TypeElement,
  Value,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { DeployResult as SFDeployResult, DeployMessage } from '@salto-io/jsforce'
import SalesforceClient from './client/client'
import { createDeployPackage, DeployPackage } from './transformers/xml_transformer'
import {
  isMetadataInstanceElement,
  apiName,
  metadataType,
  isMetadataObjectType,
  MetadataInstanceElement,
  assertMetadataObjectType,
  Types,
} from './transformers/transformer'
import { apiNameSync, fullApiName } from './filters/utils'
import {
  API_NAME_SEPARATOR,
  CUSTOM_FIELD,
  CUSTOM_OBJECT,
  GLOBAL_VALUE_SET_SUFFIX,
  INSTANCE_FULL_NAME_FIELD,
  SalesforceArtifacts,
} from './constants'
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

type NameToElemIDMap = Record<string, ElemID>

export type NestedMetadataTypeInfo = {
  nestedInstanceFields: string[]
  isNestedApiNameRelative: boolean
}

const getTypeOfNestedElement = (changeElem: MetadataInstanceElement, fieldName: string): TypeElement => {
  const rawFieldType = changeElem.getTypeSync().fields[fieldName]?.getTypeSync()
  // We generally expect these to be lists, handling non list types just in case of a bug
  const fieldType = isContainerType(rawFieldType) ? rawFieldType.getInnerTypeSync() : rawFieldType
  return fieldType
}

const getNamesOfNestedElements = (element: MetadataInstanceElement, fieldName: string): string[] =>
  makeArray(element.value[fieldName]).map((fieldValue: Value) =>
    [apiNameSync(element), fieldValue[INSTANCE_FULL_NAME_FIELD]].join(API_NAME_SEPARATOR),
  )

const addNestedInstancesToPackageManifest = async (
  pkg: DeployPackage,
  nestedTypeInfo: NestedMetadataTypeInfo,
  change: Change<MetadataInstanceElement>,
  addNestedAfterInstances: boolean,
): Promise<MetadataIdsMap> => {
  const changeElem = getChangeData(change)

  const getNestedInstanceApiName = async (name: string): Promise<string> =>
    nestedTypeInfo.isNestedApiNameRelative ? fullApiName(await apiName(changeElem), name) : name

  const addNestedInstancesFromField = async (fieldName: string): Promise<MetadataIdsMap> => {
    const fieldType = getTypeOfNestedElement(changeElem, fieldName)
    if (!isMetadataObjectType(fieldType)) {
      log.error(
        'cannot deploy nested instances in %s field %s because the field type %s is not a metadata type',
        changeElem.elemID.getFullName(),
        fieldName,
        fieldType?.elemID.getFullName(),
      )
      return {}
    }
    const nestedAfter = new Set(
      isRemovalChange(change)
        ? []
        : makeArray(change.data.after.value[fieldName]).map(item => item[INSTANCE_FULL_NAME_FIELD]),
    )
    const nestedBefore = isAdditionChange(change)
      ? []
      : makeArray(change.data.before.value[fieldName]).map(item => item[INSTANCE_FULL_NAME_FIELD])

    const removedNestedInstances = nestedBefore.filter(instName => !nestedAfter.has(instName))

    const idsToDelete = await Promise.all(removedNestedInstances.map(getNestedInstanceApiName))

    idsToDelete.forEach(nestedInstName => {
      pkg.delete(fieldType, nestedInstName)
    })

    const idsToAdd = addNestedAfterInstances ? await Promise.all([...nestedAfter].map(getNestedInstanceApiName)) : []

    idsToAdd.forEach(nestedInstName => {
      pkg.addToManifest(fieldType, nestedInstName)
    })

    return {
      [await metadataType(fieldType)]: new Set([...idsToDelete, ...idsToAdd]),
    }
  }

  return Object.assign({}, ...(await Promise.all(nestedTypeInfo.nestedInstanceFields.map(addNestedInstancesFromField))))
}

const addChangeToPackage = async (
  pkg: DeployPackage,
  change: Change<MetadataInstanceElement>,
  nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>,
): Promise<MetadataIdsMap> => {
  const instance = getChangeData(change)
  const isWrapperInstance = _.get(instance.value, DEPLOY_WRAPPER_INSTANCE_MARKER) === true
  const instanceMetadataType = await metadataType(instance)
  const instanceApiName = await apiName(instance)

  const addInstanceToManifest = !isWrapperInstance
  const addedIds = addInstanceToManifest ? { [instanceMetadataType]: new Set([instanceApiName]) } : {}
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

const getUnFoundDeleteName = (message: DeployMessage, deletionsPackageName: string): MetadataId | undefined => {
  const match =
    message.fullName === deletionsPackageName && message.problemType === 'Warning'
      ? message.problem.match(/No.*named: (?<fullName>.*) found/)
      : undefined
  const fullName = match?.groups?.fullName
  return fullName === undefined ? undefined : { type: message.componentType, fullName }
}

const isUnFoundDelete = (message: DeployMessage, deletionsPackageName: string): boolean =>
  getUnFoundDeleteName(message, deletionsPackageName) !== undefined

const processDeployResponse = (
  result: SFDeployResult,
  deletionsPackageName: string,
  typeAndNameToElemId: Record<string, NameToElemIDMap>,
  isCheckOnly: boolean,
): {
  successfulFullNames: ReadonlyArray<MetadataId>
  errors: ReadonlyArray<SaltoError | SaltoElementError>
} => {
  const getElemIdForDeployError = ({ componentType, fullName }: DeployMessage): ElemID | undefined => {
    const rawElemId = typeAndNameToElemId[componentType]?.[fullName]
    if (rawElemId === undefined) {
      log.debug('Unable to match deploy message for %s[%s] with an ElemID.', fullName, componentType)
      return undefined
    }
    if (rawElemId.typeName === CUSTOM_OBJECT) {
      // When there's a deploy error for a custom object, we receive componentType = 'CustomObject',
      // fullName = (e.g.) 'Account'. By this point in the flow, custom objects are converted back into instances of
      // 'CustomObject', so we end up mapping the deploy errors to (e.g.) salesforce.CustomObject.instance.Account
      // instead of salesforce.Account.
      return Types.getElemId(rawElemId.name, true)
    }
    if (rawElemId.typeName === CUSTOM_FIELD) {
      const [typeName, fieldName] = fullName.split(API_NAME_SEPARATOR)
      return Types.getElemId(typeName, true).createNestedID('field', fieldName)
    }
    return rawElemId
  }

  const problemTypeToSeverity = (messageType: string): SeverityLevel => {
    if (['Info', 'Warning', 'Error'].includes(messageType)) {
      return messageType as SeverityLevel
    }
    log.warn('unknown messageType %s', messageType)
    return 'Warning'
  }

  const allFailureMessages = makeArray(result.details).flatMap(detail => makeArray(detail.componentFailures))

  const allSuccessMessages = makeArray(result.details).flatMap(detail => makeArray(detail.componentSuccesses))

  const failedComponentErrors = allFailureMessages
    .filter(failure => !isUnFoundDelete(failure, deletionsPackageName))
    .map(getUserFriendlyDeployMessage)
    .map(failure => ({
      elemID: getElemIdForDeployError(failure),
      message: failure.problem,
      severity: 'Error' as SeverityLevel,
    }))

  if (failedComponentErrors.some(error => error.elemID === undefined)) {
    log.trace(
      'Some deploy messages could not be mapped to an ElemID. typeAndNameToElemId=%s',
      _.pickBy(typeAndNameToElemId, value => !_.isEmpty(value)),
    )
  }

  const successfulComponentProblems = allSuccessMessages
    .filter(message => message.problem)
    .filter(message => !isUnFoundDelete(message, deletionsPackageName))
    .map(message => ({
      elemID: getElemIdForDeployError(message),
      message: message.problem,
      severity: problemTypeToSeverity(message.problemType),
    }))

  if (successfulComponentProblems.length > 0) {
    log.debug(
      'Some components that deployed successfully had problems: %s',
      successfulComponentProblems.map(({ elemID, message }) => `[${elemID}] "${message}"`).join(', '),
    )
  }

  const testFailures = makeArray(result.details).flatMap(detail =>
    makeArray((detail.runTestResult as RunTestsResult)?.failures),
  )
  const testErrors: SaltoError[] = testFailures.map(failure => ({
    message: util.format(
      'Test failed for class %s method %s with error:\n%s\n%s',
      failure.name,
      failure.methodName,
      failure.message,
      failure.stackTrace,
    ),
    severity: 'Error' as SeverityLevel,
  }))
  const codeCoverageWarningErrors = makeArray(result.details)
    .map(detail => detail.runTestResult as RunTestsResult | undefined)
    .flatMap(runTestResult => makeArray(runTestResult?.codeCoverageWarnings))
    .map(codeCoverageWarning => codeCoverageWarning.message)
    .map(message => ({ message, severity: 'Error' as SeverityLevel }))

  const errors = [...testErrors, ...failedComponentErrors, ...successfulComponentProblems, ...codeCoverageWarningErrors]

  if (isDefined(result.errorMessage)) {
    errors.push({
      message: result.errorMessage,
      severity: 'Error' as SeverityLevel,
    })
  }

  const anyErrors = isDefined(result.errorMessage) || failedComponentErrors.length > 0 || testErrors.length > 0
  if (!isCheckOnly && result.rollbackOnError !== false && anyErrors) {
    // If we deployed with 'rollbackOnError' (the default) and any component in the group fails to deploy, then every
    // component in the group will not deploy. Let's create an explicit error for the components that did not have
    // errors to make it clear that they didn't deploy either.
    makeArray(result.details)
      .flatMap(detail => makeArray(detail.componentSuccesses))
      .map(component => ({
        elemID: typeAndNameToElemId[component.componentType]?.[component.fullName],
        message:
          "Element was not deployed because other elements had errors and the 'rollbackOnError' option is enabled (or not set).",
        severity: 'Warning' as const,
        type: 'dependency',
      }))
      .filter(error => error.elemID !== undefined)
      .forEach(error => errors.push(error))
  }

  // In checkOnly none of the changes are actually applied
  if (!result.checkOnly && result.rollbackOnError && !result.success) {
    // if rollbackOnError and we did not succeed, nothing was applied as well
    return { successfulFullNames: [], errors }
  }

  // We want to treat deletes for things we haven't found as success
  // Note that if we deploy with ignoreWarnings, these might show up in the success list
  // so we have to look for these messages in both lists
  const unFoundDeleteNames = [...allSuccessMessages, ...allFailureMessages]
    .map(message => getUnFoundDeleteName(message, deletionsPackageName))
    .filter(isDefined)

  const successfulFullNames = allSuccessMessages
    .map(success => ({
      type: success.componentType,
      fullName: success.fullName,
    }))
    .concat(unFoundDeleteNames)

  return { successfulFullNames, errors }
}

const getChangeError = async (change: Change): Promise<SaltoElementError | undefined> => {
  const changeElem = getChangeData(change)
  if ((await apiName(changeElem)) === undefined) {
    return {
      elemID: changeElem.elemID,
      message: `Cannot ${change.action} element because it has no api name`,
      severity: 'Error',
    }
  }
  if (isModificationChange(change)) {
    const beforeName = await apiName(change.data.before)
    const afterName = await apiName(change.data.after)
    if (beforeName !== afterName) {
      return {
        elemID: changeElem.elemID,
        message: `Failed to update element because api names prev=${beforeName} and new=${afterName} are different`,
        severity: 'Error',
      }
    }
  }
  if (!isInstanceChange(change) || !(await isMetadataInstanceElement(changeElem))) {
    return {
      elemID: changeElem.elemID,
      message: 'Cannot deploy because it is not a metadata instance',
      severity: 'Error',
    }
  }
  return undefined
}

const validateChanges = async (
  changes: ReadonlyArray<Change>,
): Promise<{
  validChanges: ReadonlyArray<Change<MetadataInstanceElement>>
  errors: (SaltoError | SaltoElementError)[]
}> => {
  const changesAndValidation = await awu(changes)
    .map(async change => ({ change, error: await getChangeError(change) }))
    .toArray()

  const [invalidChanges, validChanges] = _.partition(changesAndValidation, ({ error }) => isDefined(error))

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

const getDeployStatusUrl = async ({ id }: SFDeployResult, client: SalesforceClient): Promise<string | undefined> => {
  const baseUrl = await client.getUrl()
  if (baseUrl === undefined) {
    log.warn('Could not resolve Salesforce deployment URL')
    return undefined
  }
  return `${baseUrl}lightning/setup/DeployStatus/page?address=%2Fchangemgmt%2FmonitorDeploymentsDetails.apexp%3FasyncId%3D${id}`
}

const deployProgressMessage = async (client: SalesforceClient, deployResult: SFDeployResult): Promise<string> => {
  const url = await getDeployStatusUrl(deployResult, client)
  const testStatus = `${deployResult.numberTestsCompleted}/${deployResult.numberComponentsTotal} (${deployResult.numberTestErrors} errors)`
  const componentStatus = `${deployResult.numberComponentsDeployed}/${deployResult.numberComponentsTotal} (${deployResult.numberComponentErrors} errors)`
  const progressMessage = `Tests: ${testStatus} Components: ${componentStatus} URL: ${url}`
  log.debug(progressMessage)
  return progressMessage
}

const quickDeployOrDeploy = async (
  client: SalesforceClient,
  pkgData: Buffer,
  checkOnly?: boolean,
  quickDeployParams?: QuickDeployParams,
  progressReporter?: ProgressReporter,
): Promise<SFDeployResult> => {
  const progressReportCallback = async (deployResult: SFDeployResult): Promise<void> => {
    if (!progressReporter) {
      return
    }
    progressReporter.reportProgress({
      message: await deployProgressMessage(client, deployResult),
    })
  }

  if (quickDeployParams !== undefined) {
    try {
      return await client.quickDeploy(quickDeployParams.requestId)
    } catch (e) {
      log.warn(`preforming regular deploy instead of quick deploy due to error: ${e.message}`)
    }
  }
  return client.deploy(pkgData, { checkOnly }, progressReportCallback)
}

const isQuickDeployable = (deployRes: SFDeployResult): boolean =>
  deployRes.id !== undefined && deployRes.checkOnly && deployRes.success && deployRes.numberTestsCompleted >= 1

const mapNestedNamesToElemIds = (nestedType: TypeElement, nestedNames: string[]): NameToElemIDMap =>
  Object.fromEntries(
    nestedNames.map(nestedName => [nestedName, nestedType.elemID.createNestedID('instance', naclCase(nestedName))]),
  )

const getExistingNestedFields = (
  instance: MetadataInstanceElement,
  nestedTypeInfo: NestedMetadataTypeInfo,
): {
  nestedType: TypeElement
  nestedNames: string[]
}[] =>
  nestedTypeInfo.nestedInstanceFields
    .map(field => ({
      nestedType: getTypeOfNestedElement(instance, field),
      nestedNames: getNamesOfNestedElements(instance, field),
    }))
    .filter(({ nestedNames }) => nestedNames.length > 0)

export const deployMetadata = async (
  changes: ReadonlyArray<Change>,
  client: SalesforceClient,
  nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>,
  progressReporter: ProgressReporter,
  deleteBeforeUpdate?: boolean,
  checkOnly?: boolean,
  quickDeployParams?: QuickDeployParams,
): Promise<DeployResult> => {
  const updateTypeToElemIdMapping = (
    deployedComponentsElemIdsByType: Record<string, NameToElemIDMap>,
    deployedIds: Record<string, Set<string>>,
    instance: MetadataInstanceElement,
  ): void => {
    const appendToTypeElemIdMapping = (
      typeName: ReturnType<typeof apiNameSync>,
      nameToElemIdMapping: NameToElemIDMap,
    ): void => {
      if (typeName === undefined) {
        return
      }

      // doing it in a slightly more convoluted way because deployedComponentsElemIdsByType[type] may be undefined
      deployedComponentsElemIdsByType[typeName] = _.assign(
        {},
        deployedComponentsElemIdsByType[typeName],
        nameToElemIdMapping,
      )
    }

    const updateTypeElemIdMappingWithNestedType = (nestedTypeInfo: NestedMetadataTypeInfo): void => {
      const existingNestedFields = getExistingNestedFields(instance, nestedTypeInfo)
      existingNestedFields.forEach(({ nestedType, nestedNames }) => {
        appendToTypeElemIdMapping(apiNameSync(nestedType), mapNestedNamesToElemIds(nestedType, nestedNames))
      })
    }

    Object.entries(deployedIds).forEach(([type, names]) => {
      const nameToElemId: NameToElemIDMap = {}
      const nestedTypeInfo = nestedMetadataTypes[type]
      if (nestedTypeInfo) {
        updateTypeElemIdMappingWithNestedType(nestedTypeInfo)
      }
      names.forEach(name => {
        nameToElemId[name] = instance.elemID
      })
      appendToTypeElemIdMapping(type, nameToElemId)
    })
  }

  const pkg = createDeployPackage(deleteBeforeUpdate)

  const { validChanges, errors: validationErrors } = await validateChanges(changes)
  if (validChanges.length === 0) {
    // Skip deploy if there are no valid changes
    return { appliedChanges: [], errors: validationErrors }
  }
  const changeToDeployedIds: Record<string, MetadataIdsMap> = {}
  const deployedComponentsElemIdsByType: Record<string, NameToElemIDMap> = {}

  await awu(validChanges).forEach(async change => {
    const deployedIds = await addChangeToPackage(pkg, change, nestedMetadataTypes)
    const { elemID } = getChangeData(change)
    changeToDeployedIds[elemID.getFullName()] = deployedIds
    updateTypeToElemIdMapping(deployedComponentsElemIdsByType, deployedIds, getChangeData(change))
  })

  const pkgData = await pkg.getZip()
  const planHash = hashUtils.toMD5(pkgData)
  if (quickDeployParams !== undefined) {
    if (quickDeployParams.hash !== planHash) {
      return {
        appliedChanges: [],
        errors: [
          {
            message:
              'Quick deploy option is not available because the current deploy plan is different than the validated one',
            severity: 'Error',
          },
        ],
      }
    }
  }

  const sfDeployRes = await quickDeployOrDeploy(client, pkgData, checkOnly, quickDeployParams, progressReporter)

  log.debug(
    'final deploy result: %s',
    safeJsonStringify(
      {
        ...sfDeployRes,
        details: sfDeployRes.details?.map(detail => ({
          ...detail,
          retrieveResult: _.omit(detail.retrieveResult ?? {}, 'zipFile'),
          // The test result can be VERY long
          runTestResult: detail.runTestResult
            ? safeJsonStringify(detail.runTestResult, undefined, 2).slice(100)
            : undefined,
        })),
      },
      undefined,
      2,
    ),
  )

  const { errors, successfulFullNames } = processDeployResponse(
    sfDeployRes,
    pkg.getDeletionsPackageName(),
    deployedComponentsElemIdsByType,
    checkOnly ?? false,
  )
  const isSuccessfulChange = (change: Change<MetadataInstanceElement>): boolean => {
    const changeElem = getChangeData(change)
    const changeDeployedIds = changeToDeployedIds[changeElem.elemID.getFullName()]
    // TODO - this logic is not perfect, it might produce false positives when there are
    // child xml instances (because we pass in everything with a single change)
    return successfulFullNames.some(successfulId => changeDeployedIds[successfulId.type]?.has(successfulId.fullName))
  }

  const postDeployRetrieveZipContent = sfDeployRes.details?.[0]?.retrieveResult?.zipFile

  const deploymentUrl = await getDeployStatusUrl(sfDeployRes, client)
  const artifacts: Artifact[] = [
    {
      name: SalesforceArtifacts.DeployPackageXml,
      content: Buffer.from(pkg.getPackageXmlContent()),
    },
    postDeployRetrieveZipContent
      ? {
          name: SalesforceArtifacts.PostDeployRetrieveZip,
          content: Buffer.from(postDeployRetrieveZipContent, 'base64'),
        }
      : undefined,
  ].filter(isDefined)
  return {
    appliedChanges: validChanges.filter(isSuccessfulChange),
    errors: [...validationErrors, ...errors],
    extraProperties: {
      groups: isQuickDeployable(sfDeployRes)
        ? [
            {
              requestId: sfDeployRes.id,
              hash: planHash,
              url: deploymentUrl,
              artifacts,
            },
          ]
        : [{ url: deploymentUrl, artifacts }],
    },
  }
}
