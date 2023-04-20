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
import { extract as extractFormulaIdentifiers } from 'formulon'
import { logger } from '@salto-io/logging'
import { collections, values } from '@salto-io/lowerdash'
import { ElemID, ElemIDType, Field, isObjectType, ReadOnlyElementsSource, ReferenceExpression } from '@salto-io/adapter-api'
import { extendGeneratedDependencies, naclCase } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { isFormulaField } from '../transformers/transformer'
import { CUSTOM_METADATA_SUFFIX, FORMULA, SALESFORCE } from '../constants'
import { FormulaIdentifierInfo, IdentifierType, parseFormulaIdentifier } from './formula_utils/parse'
import { buildElementsSourceForFetch, extractFlatCustomObjectFields, safeApiName } from './utils'


const log = logger(module)
const { awu, groupByAsync } = collections.asynciterable
const { isDefined } = values

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

const identifierTypeToElemIdType = (identifierInfo: FormulaIdentifierInfo): ElemIDType => (
  ({
    standardObject: 'type',
    customMetadataType: 'type',
    customObject: 'type',
    customSetting: 'type',
    standardField: 'field',
    customField: 'field',
    customMetadataTypeRecord: 'instance',
    customLabel: 'instance',
  } as Record<IdentifierType, ElemIDType>)[identifierInfo.type]
)

const referencesFromIdentifiers = async (typeInfos: FormulaIdentifierInfo[]): Promise<ElemID[]> => (
  typeInfos
    .map(identifierInfo => (
      new ElemID(SALESFORCE,
        naclCase(identifierTypeToElementType(identifierInfo)),
        identifierTypeToElemIdType(identifierInfo),
        ...identifierTypeToElementName(identifierInfo).map(naclCase))
    ))
)

const addDependenciesAnnotation = async (field: Field, allElements: ReadOnlyElementsSource): Promise<void> => {
  const isValidReference = async (elemId: ElemID): Promise<boolean> => {
    if (elemId.idType === 'field') {
      const typeElemId = new ElemID(elemId.adapter, elemId.typeName)
      const typeElement = await allElements.get(typeElemId)
      return (typeElement !== undefined) && (typeElement.fields[elemId.name] !== undefined)
    }

    // 'type' or 'instance'
    return await allElements.get(elemId) !== undefined
  }

  const isSelfReference = (elemId: ElemID): boolean => (
    elemId.isEqual(field.parent.elemID)
  )

  const referenceValidity = async (elemId: ElemID): Promise<'valid' | 'omitted' | 'invalid'> => {
    if (isSelfReference(elemId)) {
      return 'omitted'
    }
    return (await isValidReference(elemId)) ? 'valid' : 'invalid'
  }

  const logInvalidReferences = (
    invalidReferences: ElemID[],
    formula: string,
    identifiersInfo: FormulaIdentifierInfo[][]
  ): void => {
    if (invalidReferences.length > 0) {
      log.info('When parsing the formula %o in field %o, one or more of the identifiers %o was parsed to an invalid reference: ',
        formula,
        field.elemID.getFullName(),
        identifiersInfo.flat().map(info => info.instance))
    }
    invalidReferences.forEach(refElemId => {
      log.info(`Invalid reference: ${refElemId.getFullName()}`)
    })
  }

  const formula = field.annotations[FORMULA]
  if (formula === undefined) {
    log.debug(`Field ${field.elemID.getFullName()} is a formula field with no formula?`)
    return
  }

  try {
    const formulaIdentifiers: string[] = log.time(
      () => (extractFormulaIdentifiers(formula)),
      `Parse formula '${formula.slice(0, 15)}'`
    )

    const identifiersInfo = (await log.time(
      () => Promise.all(
        formulaIdentifiers
          .map(async identifier => {
            const apiName = await safeApiName(field.parent)
            if (apiName === undefined) {
              return undefined
            }
            return parseFormulaIdentifier(identifier, apiName)
          })
      ),
      'Convert formula identifiers to references'
    ))
      .filter(isDefined)

    const references = (await referencesFromIdentifiers(identifiersInfo.flat()))

    const referencesWithValidity = await groupByAsync(references, referenceValidity)

    logInvalidReferences(referencesWithValidity.invalid ?? [], formula, identifiersInfo)

    const depsAsRefExpr = (referencesWithValidity.valid ?? [])
      .map(elemId => ({ reference: new ReferenceExpression(elemId) }))

    extendGeneratedDependencies(field, depsAsRefExpr)
  } catch (e) {
    log.warn(`Failed to extract references from formula ${formula}: ${e}`)
  }
}

/**
 * Extract references from formulas
 * Formulas appear in the field definitions of types and may refer to fields in their parent type or in another type.
 * This filter parses formulas, identifies such references and adds them to the _generated_references annotation of the
 * formula field.
 * Note: Currently (pending a fix to SALTO-3176) we only look at formula fields in custom objects.
 */
const filter: LocalFilterCreator = ({ config }) => ({
  name: 'formula_deps',
  onFetch: async fetchedElements => {
    if (config.fetchProfile.isFeatureEnabled('skipParsingFormulas')) {
      log.info('Formula parsing is disabled. Skipping formula_deps filter.')
      return
    }
    const fetchedObjectTypes = fetchedElements.filter(isObjectType)
    const fetchedFormulaFields = await awu(fetchedObjectTypes)
      .flatMap(extractFlatCustomObjectFields) // Get the types + their fields
      .filter(isFormulaField)
      .toArray()
    const allElements = buildElementsSourceForFetch(fetchedElements, config)
    await Promise.all(fetchedFormulaFields.map(field => addDependenciesAnnotation(field, allElements)))
  },
})

export default filter
