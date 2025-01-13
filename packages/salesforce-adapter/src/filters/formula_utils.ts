/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Element, ElemID, ElemIDType, isObjectType } from '@salto-io/adapter-api'
import { inspectValue, naclCase } from '@salto-io/adapter-utils'
import { FormulaIdentifierInfo, IdentifierType } from '@salto-io/salesforce-formula-parser'
import { logger } from '@salto-io/logging'
import { CUSTOM_METADATA_SUFFIX, SALESFORCE } from '../constants'

const log = logger(module)

const identifierTypeToElementName = (identifierInfo: FormulaIdentifierInfo): string[] => {
  if (identifierInfo.type === 'customLabel') {
    return [identifierInfo.instance]
  }
  if (identifierInfo.type === 'customMetadataTypeRecord') {
    const [typeName, instanceName] = identifierInfo.instance.split('.')
    return [`${typeName.slice(0, -1 * CUSTOM_METADATA_SUFFIX.length)}.${instanceName}`]
  }
  return identifierInfo.instance.split('.').slice(1)
}

const identifierTypeToElementType = (identifierInfo: FormulaIdentifierInfo): string => {
  if (identifierInfo.type === 'customLabel') {
    return 'CustomLabel'
  }

  return identifierInfo.instance.split('.')[0]
}

const identifierTypeToElemIdType = (identifierInfo: FormulaIdentifierInfo): ElemIDType =>
  (
    ({
      standardObject: 'type',
      customMetadataType: 'type',
      customObject: 'type',
      customSetting: 'type',
      standardField: 'field',
      customField: 'field',
      customMetadataTypeRecord: 'instance',
      customLabel: 'instance',
    }) as Record<IdentifierType, ElemIDType>
  )[identifierInfo.type]

export const referencesFromIdentifiers = (typeInfos: FormulaIdentifierInfo[]): ElemID[] =>
  typeInfos.map(
    identifierInfo =>
      new ElemID(
        SALESFORCE,
        naclCase(identifierTypeToElementType(identifierInfo)),
        identifierTypeToElemIdType(identifierInfo),
        ...identifierTypeToElementName(identifierInfo).map(naclCase),
      ),
  )

const isValidReference = (elemId: ElemID, potentialReferenceTargets: Map<string, Element>): boolean => {
  if (elemId.idType === 'type' || elemId.idType === 'instance') {
    return potentialReferenceTargets.has(elemId.getFullName())
  }

  // field
  const typeElemId = new ElemID(elemId.adapter, elemId.typeName)
  const typeElement = potentialReferenceTargets.get(typeElemId.getFullName())
  if (typeElement === undefined) {
    // the reference is to a type that does not exist in the workspace, probably because we didn't fetch it
    return false
  }
  if (!isObjectType(typeElement)) {
    log.warn('ElemID typeName does not refer to a type: %s', elemId.getFullName())
    return false
  }
  return typeElement.fields[elemId.name] !== undefined
}

export const referenceValidity = (
  refElemId: ElemID,
  selfElemId: ElemID,
  potentialReferenceTargets: Map<string, Element>,
): 'valid' | 'omitted' | 'invalid' => {
  const isSelfReference = (elemId: ElemID): boolean => elemId.isEqual(selfElemId)

  if (isSelfReference(refElemId)) {
    return 'omitted'
  }
  return isValidReference(refElemId, potentialReferenceTargets) ? 'valid' : 'invalid'
}

export const logInvalidReferences = (
  refOrigin: ElemID,
  invalidReferences: ElemID[],
  formula: string,
  identifiersInfo: FormulaIdentifierInfo[],
): void => {
  if (invalidReferences.length > 0) {
    log.debug(
      'When parsing the formula %s in %s, one or more of the identifiers %s was parsed to an invalid reference: ',
      formula,
      refOrigin.getFullName(),
      inspectValue(identifiersInfo.map(info => info.instance)),
    )
  }
  invalidReferences.forEach(refElemId => {
    log.debug(`Invalid reference: ${refElemId.getFullName()}`)
  })
}
