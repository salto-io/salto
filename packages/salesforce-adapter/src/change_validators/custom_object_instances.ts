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
} from '@salto-io/adapter-api'
import { DescribeSObjectResult, Field } from '@salto-io/jsforce'
import { detailedCompare, GetLookupNameFunc, inspectValue } from '@salto-io/adapter-utils'
import { values, collections } from '@salto-io/lowerdash'
import { resolveValues } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'

import SalesforceClient from '../client/client'
import { apiNameSync, isInstanceOfCustomObjectChangeSync } from '../filters/utils'
import { resolveSalesforceChanges } from '../transformers/reference_mapping'

const { awu } = collections.asynciterable
const { isDefined } = values
const log = logger(module)

const describeType = async ({
  typeName,
  client,
}: {
  typeName: string
  client: SalesforceClient
}): Promise<DescribeSObjectResult | undefined> => {
  try {
    return (await client.describeSObjects([typeName])).result[0]
  } catch (e) {
    log.error('failed to describe type %s: %s', typeName, inspectValue(e))
    return undefined
  }
}

const getDescribeFieldsByType = async ({
  typesToDescribe,
  client,
}: {
  typesToDescribe: string[]
  client: SalesforceClient
}): Promise<Record<string, Record<string, Field>>> => {
  const describeFieldsByType: Record<string, Record<string, Field>> = {}
  await Promise.all(
    typesToDescribe.map(async typeToDescribe => {
      const describeResult = await describeType({ typeName: typeToDescribe, client })
      describeFieldsByType[typeToDescribe] = describeResult ? _.keyBy(describeResult.fields, field => field.name) : {}
    }),
  )
  log.trace('describeFieldsByType: %s', inspectValue(describeFieldsByType, { maxArrayLength: null }))
  return describeFieldsByType
}

const getUpdateErrorsForNonUpdateableFields = async (
  before: InstanceElement,
  after: InstanceElement,
  describeFieldsByType: Record<string, Record<string, Field>>,
): Promise<ReadonlyArray<ChangeError>> => {
  const describeFields = describeFieldsByType[apiNameSync(after.getTypeSync()) ?? ''] ?? {}
  const detailedChanges = detailedCompare(before, after, { createFieldChanges: true })
  return detailedChanges
    .filter(
      detailedChange => !describeFields[detailedChange.id.name] || !describeFields[detailedChange.id.name].updateable,
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
  describeFieldsByType: Record<string, Record<string, Field>>,
): Promise<ReadonlyArray<ChangeError>> => {
  const objectType = after.getTypeSync()
  const describeFields = describeFieldsByType[apiNameSync(objectType) ?? ''] ?? {}
  const afterResolved = await resolveValues(after, getLookupNameFunc)
  return awu(Object.values(objectType.fields))
    .filter(field => !describeFields[field.name] || !describeFields[field.name].createable)
    .map(field => {
      if (!_.isUndefined(afterResolved.value[field.name])) {
        return {
          elemID: afterResolved.elemID,
          severity: 'Warning',
          message: 'Cannot set a value to a non-creatable field',
          detailedMessage: `Cannot set a value for ${field.name} of ${afterResolved.elemID.getFullName()} because its field is defined as non-creatable.`,
        } as ChangeError
      }
      return undefined
    })
    .filter(values.isDefined)
    .toArray()
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
    const describeFieldsByType = await getDescribeFieldsByType({ typesToDescribe, client })
    const updateChangeErrors = await awu(
      (await resolveSalesforceChanges(
        customObjectInstancesChanges.filter(isModificationChange),
        getLookupNameFunc,
      )) as ModificationChange<InstanceElement>[],
    )
      .flatMap(change =>
        getUpdateErrorsForNonUpdateableFields(change.data.before, change.data.after, describeFieldsByType),
      )
      .toArray()

    const createChangeErrors = await awu(customObjectInstancesChanges)
      .filter(isAdditionChange)
      .flatMap(change =>
        getCreateErrorsForNonCreatableFields(getChangeData(change), getLookupNameFunc, describeFieldsByType),
      )
      .toArray()

    return [...updateChangeErrors, ...createChangeErrors]
  }

export default changeValidator
