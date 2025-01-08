/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import {
  ChangeError,
  isAdditionOrModificationChange,
  Values,
  isEqualValues,
  ChangeDataType,
  isAdditionChange,
} from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { NetsuiteChangeValidator } from './types'
import { cloneChange } from './utils'
import {
  FIELDS_TO_OMIT_PRE_DEPLOY,
  getFieldsToOmitByType,
  getTypesForDeepTransformation,
  omitFieldsFromElements,
} from '../filters/omit_fields'
import { getElementValueOrAnnotations } from '../types'

const { isDefined } = values
const { awu } = collections.asynciterable

const getModificationChangeError = (
  clonedBefore: ChangeDataType,
  clonedAfter: ChangeDataType,
  wrappedFieldsToOmit: string,
): ChangeError => {
  if (isEqualValues(getElementValueOrAnnotations(clonedBefore), getElementValueOrAnnotations(clonedAfter))) {
    return {
      elemID: clonedAfter.elemID,
      severity: 'Error',
      message: 'This element contains an undeployable change',
      detailedMessage: `This element will be removed from deployment because it only contains changes to the undeployable fields: ${wrappedFieldsToOmit}.`,
    }
  }
  return {
    elemID: clonedAfter.elemID,
    severity: 'Warning',
    message: `This element will be deployed without the following fields: ${wrappedFieldsToOmit}`,
    detailedMessage: `This element will be deployed without the following fields: ${wrappedFieldsToOmit}, as NetSuite does not support deploying them.`,
  }
}

const getMissingKeys = (value: Values, clonedValue: Values, prefix = ''): string[] =>
  Object.keys(value).reduce((missingKeys, key) => {
    const currentKey = prefix ? `${prefix}.${key}` : key
    if (clonedValue[key] === undefined) {
      return [...missingKeys, currentKey]
    }
    if (_.isPlainObject(value[key])) {
      return [...missingKeys, ...getMissingKeys(value[key], clonedValue[key], currentKey)]
    }
    return missingKeys
  }, [] as string[])

const changeValidator: NetsuiteChangeValidator = async (changes, { elementsSource, config }) => {
  const fieldsToOmit = FIELDS_TO_OMIT_PRE_DEPLOY.concat(config.deploy?.fieldsToOmit ?? [])
  if (fieldsToOmit.length === 0) {
    return []
  }

  const typeNames = await awu(await elementsSource.list())
    .filter(elemId => elemId.idType === 'type')
    .map(elemId => elemId.name)
    .toArray()

  const fieldsToOmitByType = getFieldsToOmitByType(typeNames, fieldsToOmit)
  if (_.isEmpty(fieldsToOmitByType)) {
    return []
  }

  const typesForDeepTransformation = getTypesForDeepTransformation(typeNames, fieldsToOmit)
  return (
    await awu(changes)
      .filter(isAdditionOrModificationChange)
      .map(async change => {
        const clonedChange = cloneChange(change)
        const { after } = change.data
        const { after: clonedAfter } = clonedChange.data

        await omitFieldsFromElements([clonedAfter], fieldsToOmitByType, typesForDeepTransformation)

        const missingKeys = getMissingKeys(
          getElementValueOrAnnotations(after),
          getElementValueOrAnnotations(clonedAfter),
        )

        if (missingKeys.length === 0) {
          return undefined
        }
        const wrappedFieldsToOmit = missingKeys.map(field => `'${field}'`).join(', ')
        if (isAdditionChange(clonedChange)) {
          return {
            elemID: clonedAfter.elemID,
            severity: 'Warning',
            message: `This element will be deployed without the following fields: ${wrappedFieldsToOmit}`,
            detailedMessage: `This element will be deployed without the following fields: ${wrappedFieldsToOmit}, as NetSuite does not support deploying them.`,
          } as ChangeError
        }

        const { before: clonedBefore } = clonedChange.data
        await omitFieldsFromElements([clonedBefore], fieldsToOmitByType, typesForDeepTransformation)
        return getModificationChangeError(clonedBefore, clonedAfter, wrappedFieldsToOmit)
      })
      .toArray()
  ).filter(isDefined)
}

export default changeValidator
