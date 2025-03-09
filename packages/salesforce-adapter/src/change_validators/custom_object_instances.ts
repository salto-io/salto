/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  ChangeValidator,
  getChangeData,
  isModificationChange,
  InstanceElement,
  ChangeError,
  isAdditionChange,
  ModificationChange,
  isRemovalChange,
  RemovalChange,
} from '@salto-io/adapter-api'
import { DescribeSObjectResult } from '@salto-io/jsforce'
import { detailedCompare, GetLookupNameFunc } from '@salto-io/adapter-utils'
import { values, collections } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'

import SalesforceClient from '../client/client'
import { apiNameSync, isInstanceOfCustomObjectChangeSync } from '../filters/utils'
import { resolveSalesforceChanges } from '../transformers/reference_mapping'

const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)

const describeTypes = async ({
  typesToDescribe,
  client,
}: {
  typesToDescribe: string[]
  client: SalesforceClient
}): Promise<Map<string, DescribeSObjectResult>> => {
  const describeResultByType: Map<string, DescribeSObjectResult> = new Map()
  await Promise.all(
    typesToDescribe.map(async typeToDescribe => {
      try {
        describeResultByType.set(typeToDescribe, (await client.describeSObjects([typeToDescribe])).result[0])
      } catch (e) {
        log.error('Failed to describe type %s: %s', typeToDescribe, e)
      }
    }),
  )
  return describeResultByType
}

const getUpdateErrorsForNonUpdateableFields = async (
  before: InstanceElement,
  after: InstanceElement,
  describeResultByType: Map<string, DescribeSObjectResult>,
): Promise<ReadonlyArray<ChangeError>> => {
  const typeName = apiNameSync(before.getTypeSync()) ?? ''
  const describeResult = describeResultByType.get(typeName)
  if (!describeResult || !describeResult.updateable) {
    return [
      {
        elemID: before.elemID,
        severity: 'Warning',
        message: 'Cannot modify records of type',
        detailedMessage: `The deploying user lacks the permissions to modify records of type ${typeName}`,
      },
    ]
  }
  const fieldsDescribeByName = _.keyBy(describeResult.fields, field => field.name)
  const detailedChanges = detailedCompare(before, after, { createFieldChanges: true })
  return detailedChanges
    .filter(
      detailedChange =>
        !fieldsDescribeByName[detailedChange.id.name] || !fieldsDescribeByName[detailedChange.id.name].updateable,
    )
    .map(
      detailedChange =>
        ({
          elemID: before.elemID,
          severity: 'Warning',
          message: 'Cannot modify the value of a non-updatable field',
          detailedMessage: `Cannot modify ${detailedChange.id.name}’s value of ${before.elemID.getFullName()} because its field is defined as non-updateable.`,
        }) as ChangeError,
    )
    .filter(values.isDefined)
}

const getCreateErrorsForNonCreatableFields = async (
  after: InstanceElement,
  getLookupNameFunc: GetLookupNameFunc,
  describeResultByType: Map<string, DescribeSObjectResult>,
): Promise<ReadonlyArray<ChangeError>> => {
  const objectType = after.getTypeSync()
  const typeName = apiNameSync(objectType) ?? ''
  const describeResult = describeResultByType.get(typeName)
  if (!describeResult || !describeResult.createable) {
    return [
      {
        elemID: after.elemID,
        severity: 'Warning',
        message: 'Cannot create records of type',
        detailedMessage: `The deploying user lacks the permissions to create records of type ${typeName}`,
      },
    ]
  }
  const fieldsDescribeByName = _.keyBy(describeResult.fields, field => field.name)
  const afterResolved = await resolveValues(after, getLookupNameFunc)
  return awu(Object.values(objectType.fields))
    .filter(
      field =>
        (!fieldsDescribeByName[field.name] || !fieldsDescribeByName[field.name].createable) &&
        isDefined(afterResolved.value[field.name]),
    )
    .map(
      field =>
        ({
          elemID: afterResolved.elemID,
          severity: 'Warning',
          message: 'Cannot set a value to a non-creatable field',
          detailedMessage: `Cannot set a value for ${field.name} of ${afterResolved.elemID.getFullName()} because its field is defined as non-creatable.`,
        }) as ChangeError,
    )
    .filter(values.isDefined)
    .toArray()
}

const createDeleteChangeError = ({
  change,
  describeResultByType,
}: {
  change: RemovalChange<InstanceElement>
  describeResultByType: Map<string, DescribeSObjectResult>
}): ChangeError | undefined => {
  const typeName = apiNameSync(getChangeData(change).getTypeSync()) ?? ''
  const describeResult = describeResultByType.get(typeName)
  return describeResult && describeResult.deletable
    ? undefined
    : {
        elemID: getChangeData(change).elemID,
        severity: 'Warning',
        message: 'Cannot delete records of type',
        detailedMessage: `The deploying user lacks the permissions to delete records of type ${typeName}`,
      }
}

const changeValidator =
  (getLookupNameFunc: GetLookupNameFunc, client: SalesforceClient): ChangeValidator =>
  async changes => {
    const customObjectInstancesChanges = changes.filter(isInstanceOfCustomObjectChangeSync)
    if (customObjectInstancesChanges.length === 0) {
      return []
    }
    const typesToDescribe = _.uniq(
      customObjectInstancesChanges
        .map(getChangeData)
        .map(instance => apiNameSync(instance.getTypeSync()))
        .filter(isDefined),
    )
    const describeResultByType = await describeTypes({ typesToDescribe, client })
    const updateChangeErrors = await awu(
      (await resolveSalesforceChanges(
        customObjectInstancesChanges.filter(isModificationChange),
        getLookupNameFunc,
      )) as ModificationChange<InstanceElement>[],
    )
      .flatMap(change =>
        getUpdateErrorsForNonUpdateableFields(change.data.before, change.data.after, describeResultByType),
      )
      .toArray()

    const createChangeErrors = await awu(customObjectInstancesChanges)
      .filter(isAdditionChange)
      .flatMap(change =>
        getCreateErrorsForNonCreatableFields(getChangeData(change), getLookupNameFunc, describeResultByType),
      )
      .toArray()

    const deleteChangeErrors = customObjectInstancesChanges
      .filter(isRemovalChange)
      .map(change => createDeleteChangeError({ change, describeResultByType }))
      .filter(isDefined)

    return updateChangeErrors.concat(createChangeErrors).concat(deleteChangeErrors)
  }

export default changeValidator
