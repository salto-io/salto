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
import { ElemID, ElemIDType, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { naclCase } from '@salto-io/adapter-utils'
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

export const referencesFromIdentifiers = async (typeInfos: FormulaIdentifierInfo[]): Promise<ElemID[]> =>
  typeInfos.map(
    identifierInfo =>
      new ElemID(
        SALESFORCE,
        naclCase(identifierTypeToElementType(identifierInfo)),
        identifierTypeToElemIdType(identifierInfo),
        ...identifierTypeToElementName(identifierInfo).map(naclCase),
      ),
  )

const isValidReference = async (elemId: ElemID, allElements: ReadOnlyElementsSource): Promise<boolean> => {
  if (elemId.idType === 'type' || elemId.idType === 'instance') {
    return (await allElements.get(elemId)) !== undefined
  }

  // field
  const typeElemId = new ElemID(elemId.adapter, elemId.typeName)
  const typeElement = await allElements.get(typeElemId)
  return typeElement !== undefined && typeElement.fields[elemId.name] !== undefined
}

export const referenceValidity = async (
  refElemId: ElemID,
  selfElemId: ElemID,
  allElements: ReadOnlyElementsSource,
): Promise<'valid' | 'omitted' | 'invalid'> => {
  const isSelfReference = (elemId: ElemID): boolean => elemId.isEqual(selfElemId)

  if (isSelfReference(refElemId)) {
    return 'omitted'
  }
  return (await isValidReference(refElemId, allElements)) ? 'valid' : 'invalid'
}

export const logInvalidReferences = (
  refOrigin: ElemID,
  invalidReferences: ElemID[],
  formula: string,
  identifiersInfo: FormulaIdentifierInfo[][],
): void => {
  if (invalidReferences.length > 0) {
    log.debug(
      'When parsing the formula %o in %o, one or more of the identifiers %o was parsed to an invalid reference: ',
      formula,
      refOrigin.getFullName(),
      identifiersInfo.flat().map(info => info.instance),
    )
  }
  invalidReferences.forEach(refElemId => {
    log.debug(`Invalid reference: ${refElemId.getFullName()}`)
  })
}
