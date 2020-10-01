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
import { DeployResult, Change, getChangeElement, isRemovalChange, isInstanceElement, isAdditionChange, AdditionChange, InstanceElement, ChangeDataType, isModificationChange, isInstanceChange, ModificationChange, isListType } from '@salto-io/adapter-api'
import { DeployResult as SFDeployResult } from 'jsforce'
import SalesforceClient from './client/client'
import { createDeployPackage, DeployPackage } from './transformers/xml_transformer'
import { isMetadataInstanceElement, apiName, defaultApiName, metadataType, isMetadataObjectType } from './transformers/transformer'
import { fullApiName, parentApiName, validateApiName } from './filters/utils'
import { INSTANCE_FULL_NAME_FIELD } from './constants'

const { makeArray } = collections.array
const log = logger(module)

const addDefaults = (change: AdditionChange<ChangeDataType>): void => {
  const addInstanceDefaults = (elem: InstanceElement): void => {
    if (elem.value[INSTANCE_FULL_NAME_FIELD] === undefined) {
      elem.value[INSTANCE_FULL_NAME_FIELD] = defaultApiName(elem)
    }
  }

  const elem = change.data.after
  if (isInstanceElement(elem)) {
    addInstanceDefaults(elem)
  }
  // TODO: when support for custom fields / objects is added, add their defaults as well
}

const addNestedInstanceRemovalsToPackage = (
  pkg: DeployPackage,
  nestedTypeInfo: NestedMetadataTypeInfo,
  change: ModificationChange<InstanceElement>
): void => {
  const changeElem = getChangeElement(change)

  const getNestedInstanceApiName = (name: string): string => (
    nestedTypeInfo.isNestedApiNameRelative
      ? fullApiName(apiName(changeElem), name)
      : name
  )

  nestedTypeInfo.nestedInstanceFields.forEach(fieldName => {
    const rawFieldType = changeElem.type.fields[fieldName]?.type
    // We generally expect these to be lists, handling non list types just in case of a bug
    const fieldType = isListType(rawFieldType) ? rawFieldType.innerType : rawFieldType
    if (!isMetadataObjectType(fieldType)) {
      log.error(
        'cannot deploy nested instances in %s field %s because the field type %s is not a metadata type',
        changeElem.elemID.getFullName(), fieldName, fieldType.elemID.getFullName(),
      )
      return
    }
    const nestedAfter = new Set(
      makeArray(change.data.after.value[fieldName])
        .map(item => item[INSTANCE_FULL_NAME_FIELD])
    )
    const nestedBefore = makeArray(change.data.before.value[fieldName])
      .map(item => item[INSTANCE_FULL_NAME_FIELD])

    const removedNestedInstances = nestedBefore.filter(instName => !nestedAfter.has(instName))

    removedNestedInstances
      .map(getNestedInstanceApiName)
      .forEach(nestedInstName => {
        pkg.delete(fieldType, nestedInstName)
      })
  })
}

const addChangeToPackage = (
  pkg: DeployPackage,
  change: Change,
  nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>
): void => {
  const changeElem = getChangeElement(change)
  if (isInstanceChange(change) && isMetadataInstanceElement(changeElem)) {
    if (isRemovalChange(change)) {
      pkg.delete(changeElem.type, apiName(changeElem))
    } else {
      const nestedTypeInfo = nestedMetadataTypes[metadataType(changeElem)]
      if (isModificationChange(change) && nestedTypeInfo !== undefined) {
        // The changes instance has child XML types, these need to be deleted explicitly
        // in the package if they are removed from the instance
        addNestedInstanceRemovalsToPackage(pkg, nestedTypeInfo, change)
      }
      pkg.add(changeElem)
    }
  } else {
    // TODO: support custom objects and fields
    log.error('Cannot deploy %s because it is not a metadata instance', changeElem.elemID.getFullName())
  }
}

const processDeployResponse = (
  result: SFDeployResult
): { successfulFullNames: ReadonlyArray<string>; errors: ReadonlyArray<Error> } => {
  const successfulFullNames = collections.array.makeArray(result.details)
    .flatMap(detail => collections.array.makeArray(detail.componentSuccesses))
    .map(success => success.fullName)

  const errors = collections.array.makeArray(result.details)
    .flatMap(detail => collections.array.makeArray(detail.componentFailures))
    .map(failure => new Error(
      `Failed to deploy ${failure.fullName} with error: ${failure.problem} (${failure.problemType})`
    ))
  return { successfulFullNames, errors }
}

export type NestedMetadataTypeInfo = {
  nestedInstanceFields: string[]
  isNestedApiNameRelative: boolean
}

const validateChanges = (
  changes: ReadonlyArray<Change>
): { validChanges: ReadonlyArray<Change>; errors: Error[] } => {
  const changesAndValidation = changes
    .map(change => {
      try {
        if (isModificationChange(change)) {
          validateApiName(change.data.before, change.data.after)
        }
      } catch (error) {
        return { change, error }
      }
      return { change, error: undefined }
    })

  const [invalidChanges, validChanges] = _.partition(
    changesAndValidation,
    ({ error }) => values.isDefined(error)
  )

  const errors = invalidChanges
    .map(({ change, error }) => (
      new Error(`${getChangeElement(change).elemID.getFullName()}: ${error}}`)
    ))

  return {
    validChanges: validChanges.map(({ change }) => change),
    errors,
  }
}

export const deployMetadata = async (
  client: SalesforceClient,
  changes: ReadonlyArray<Change>,
  nestedMetadataTypes: Record<string, NestedMetadataTypeInfo>
): Promise<DeployResult> => {
  const pkg = createDeployPackage()
  changes
    .filter(isAdditionChange)
    .forEach(addDefaults)

  const { validChanges, errors: preDeployErrors } = validateChanges(changes)

  validChanges.forEach(change => addChangeToPackage(pkg, change, nestedMetadataTypes))

  const pkgData = await pkg.getZip()
  const deployRes = await client.deploy(pkgData)

  const { errors, successfulFullNames } = processDeployResponse(deployRes)

  const isSuccessfulChange = (change: Change): boolean => {
    const changeElem = getChangeElement(change)
    return successfulFullNames.includes(apiName(changeElem))
      || successfulFullNames.includes(parentApiName(changeElem))
  }

  return {
    appliedChanges: validChanges.filter(isSuccessfulChange),
    errors: [...preDeployErrors, ...errors],
  }
}
