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

import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import {
  Element,
  ElemID,
  ElemIDType,
  Field,
  InstanceElement,
  isObjectType,
  ReadOnlyElementsSource,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { extendGeneratedDependencies, naclCase } from '@salto-io/adapter-utils'
import {
  FormulaIdentifierInfo,
  IdentifierType,
  parseFormulaIdentifier,
  extractFormulaIdentifiers,
} from '@salto-io/salesforce-formula-parser'
import { LocalFilterCreator } from '../filter'
import { isFormulaField } from '../transformers/transformer'
import { CUSTOM_METADATA_SUFFIX, FORMULA, SALESFORCE } from '../constants'
import {
  buildElementsSourceForFetch,
  ensureSafeFilterFetch,
  extractFlatCustomObjectFields,
  isInstanceOfTypeSync,
} from './utils'

const log = logger(module)
const { awu, groupByAsync } = collections.asynciterable

const referenceFieldsWithFormulaIdentifiers: Record<string, string> = {
  FlowCondition: 'leftValueReference',
  FlowTestCondition: 'leftValueReference',
  FlowTestParameter: 'leftValueReference',
}

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

const referencesFromIdentifiers = async (typeInfos: FormulaIdentifierInfo[]): Promise<ElemID[]> =>
  typeInfos.map(
    identifierInfo =>
      new ElemID(
        SALESFORCE,
        naclCase(identifierTypeToElementType(identifierInfo)),
        identifierTypeToElemIdType(identifierInfo),
        ...identifierTypeToElementName(identifierInfo).map(naclCase),
      ),
  )

const isValidReference = async (
  elemId: ElemID,
  allElements: ReadOnlyElementsSource,
): Promise<boolean> => {
  if (elemId.idType === 'type' || elemId.idType === 'instance') {
    return (await allElements.get(elemId)) !== undefined
  }

  // field
  const typeElemId = new ElemID(elemId.adapter, elemId.typeName)
  const typeElement = await allElements.get(typeElemId)
  return (
    typeElement !== undefined && typeElement.fields[elemId.name] !== undefined
  )
}

const referenceValidity = async (
  refElemId: ElemID,
  selfElemId: ElemID,
  allElements: ReadOnlyElementsSource,
): Promise<'valid' | 'omitted' | 'invalid'> => {
  const isSelfReference = (elemId: ElemID): boolean =>
    elemId.isEqual(selfElemId)

  if (isSelfReference(refElemId)) {
    return 'omitted'
  }
  return (await isValidReference(refElemId, allElements)) ? 'valid' : 'invalid'
}

const logInvalidReferences = (
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
      identifiersInfo.flat().map((info) => info.instance),
    )
  }
  invalidReferences.forEach((refElemId) => {
    log.debug(`Invalid reference: ${refElemId.getFullName()}`)
  })
}

const addDependenciesAnnotation = async (
  field: Field,
  allElements: ReadOnlyElementsSource,
): Promise<void> => {
  const formula = field.annotations[FORMULA]
  if (formula === undefined) {
    log.error(`Field ${field.elemID.getFullName()} is a formula field with no formula?`)
    return
  }

  log.debug(`Extracting formula refs from ${field.elemID.getFullName()}`)

  try {
    const formulaIdentifiers: string[] = log.timeDebug(
      () => extractFormulaIdentifiers(formula),
      `Parse formula '${formula.slice(0, 15)}'`,
    )

    const identifiersInfo = await log.timeDebug(
      () =>
        Promise.all(
          formulaIdentifiers.map(async identifier => parseFormulaIdentifier(identifier, field.parent.elemID.typeName)),
        ),
      'Convert formula identifiers to references',
    )

    // We check the # of refs before we filter bad refs out because otherwise the # of refs will be affected by the
    // filtering.
    const references = await referencesFromIdentifiers(identifiersInfo.flat())

    if (references.length < identifiersInfo.length) {
      log.warn(`Some formula identifiers were not converted to references.
      Field: ${field.elemID.getFullName()}
      Formula: ${formula}
      Identifiers: ${identifiersInfo
        .flat()
        .map(info => info.instance)
        .join(', ')}
      References: ${references.map(ref => ref.getFullName()).join(', ')}`)
    }

    const referencesWithValidity = await groupByAsync(references, (refElemId) =>
      referenceValidity(refElemId, field.parent.elemID, allElements),
    )

    logInvalidReferences(
      field.elemID,
      referencesWithValidity.invalid ?? [],
      formula,
      identifiersInfo,
    )

    const depsAsRefExpr = (referencesWithValidity.valid ?? []).map(elemId => ({
      reference: new ReferenceExpression(elemId),
    }))

    extendGeneratedDependencies(field, depsAsRefExpr)
  } catch (e) {
    log.warn(`Failed to extract references from formula ${formula}: ${e}`)
  }
}

const addDependenciesToFormulaFields = async (
  fetchedElements: Element[],
  allElements: ReadOnlyElementsSource,
): Promise<void> => {
  const fetchedObjectTypes = fetchedElements.filter(isObjectType)
  const fetchedFormulaFields = await awu(fetchedObjectTypes)
    .flatMap(extractFlatCustomObjectFields) // Get the types + their fields
    .filter(isFormulaField)
    .toArray()
  await Promise.all(
    fetchedFormulaFields.map((field) =>
      addDependenciesAnnotation(field, allElements),
    ),
  )
}

const transformFieldsToReferences = async (
  fetchedElements: Element[],
  allElements: ReadOnlyElementsSource,
): Promise<void> => {
  const transformInstanceFieldToReference = async (
    instance: InstanceElement,
  ): Promise<void> => {
    const fieldName =
      referenceFieldsWithFormulaIdentifiers[instance.elemID.typeName]
    const identifierInfo = parseFormulaIdentifier(
      instance.value[fieldName],
      instance.elemID.getFullName(),
    )
    const referenceElemIds = await referencesFromIdentifiers(identifierInfo)

    const referencesWithValidity = await groupByAsync(
      referenceElemIds,
      (refElemId) => referenceValidity(refElemId, instance.elemID, allElements),
    )

    logInvalidReferences(
      instance.elemID,
      referencesWithValidity.invalid ?? [],
      instance.value[fieldName],
      [identifierInfo],
    )

    if (!referencesWithValidity.valid) {
      return
    }

    instance.value[fieldName] = new ReferenceExpression(
      referencesWithValidity.valid[0],
    )
  }

  const fetchedInstances = fetchedElements.filter(
    isInstanceOfTypeSync(...Object.keys(referenceFieldsWithFormulaIdentifiers)),
  )
  fetchedInstances.forEach(transformInstanceFieldToReference)
}

const FILTER_NAME = 'formulaDeps'
/**
 * Extract references from formulas
 * Formulas appear in the field definitions of types and may refer to fields in their parent type or in another type.
 * This filter parses formulas, identifies such references and adds them to the _generated_references annotation of the
 * formula field.
 * Note: Currently (pending a fix to SALTO-3176) we only look at formula fields in custom objects.
 */
const filter: LocalFilterCreator = ({ config }) => ({
  name: FILTER_NAME,
  onFetch: ensureSafeFilterFetch({
    warningMessage: 'Error while parsing formulas',
    config,
    filterName: FILTER_NAME,
    fetchFilterFunc: async (fetchedElements) => {
      const allElements = buildElementsSourceForFetch(fetchedElements, config)
      await addDependenciesToFormulaFields(fetchedElements, allElements)
      await transformFieldsToReferences(fetchedElements, allElements)
    },
  }),
})

export default filter
