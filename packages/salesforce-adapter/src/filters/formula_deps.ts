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

import _ from 'lodash'
import { logger } from '@salto-io/logging'
import { ElemID, ElemIDType, Field, isObjectType, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { isFormulaField } from '../transformers/transformer'
import { FORMULA, SALESFORCE } from '../constants'
import { FormulaIdentifierInfo, IdentifierType, parseFormulaIdentifier } from './formula_utils/parse'

/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const formulon = require('formulon')

const { extract } = formulon

const log = logger(module)

const identifierTypeToElemIdType = (identifierType: IdentifierType): ElemIDType => (
  ({
    [IdentifierType.STANDARD_OBJECT.name]: 'type',
    [IdentifierType.CUSTOM_METADATA_TYPE.name]: 'type',
    [IdentifierType.CUSTOM_OBJECT.name]: 'type',
    [IdentifierType.CUSTOM_SETTING.name]: 'type', // TODO is this right?
    [IdentifierType.STANDARD_FIELD.name]: 'field',
    [IdentifierType.CUSTOM_FIELD.name]: 'field',
    // [IdentifierType.CUSTOM_METADATA_TYPE_RECORD.name]: 'instance', //see comment in referencesFromIdentifiers
  } as const)[identifierType.name]
)

const referencesFromIdentifiers = async (typeInfos: FormulaIdentifierInfo[]): Promise<ElemID[]> => (
  // TODO CUSTOM_METADATA_TYPE_RECORD entries have these weird .by_class/.by_handler suffixes that I don't know how to
  // handle, and the actual field refs already exist in CUSTOM_METADATA_TYPE and CUSTOM_FIELD.
  // see https://github.com/pgonzaleznetwork/forcemula#custom-metadata-types
  typeInfos
    .filter(({ type }) => (type !== IdentifierType.CUSTOM_METADATA_TYPE_RECORD))
    .map(({ type, instance }) => (
      new ElemID(SALESFORCE,
        instance.split('.')[0],
        identifierTypeToElemIdType(type),
        ...instance.split('.').slice(1))
    ))
)

const addDependenciesAnnotation = async (field: Field, referrableNames: Set<string>): Promise<void> => {
  const isValidReference = (elemId: ElemID): boolean => (
    referrableNames.has(elemId.getFullName())
  )

  const logInvalidReferences = (
    invalidReferences: ElemID[],
    formula: string,
    identifiersInfo: FormulaIdentifierInfo[][]
  ): void => {
    invalidReferences.forEach(refElemId => {
      log.error(`Created an invalid reference from a formula identifier. This reference will be discarded.
        Field: ${field.elemID.getFullName()}
        Formula: ${formula}
        Identifiers: ${identifiersInfo.flat().map(info => info.instance).join(', ')}
        Reference: ${refElemId.getFullName()}`)
    })
  }

  const formula = field.annotations[FORMULA]
  if (formula === undefined) {
    log.error(`Field ${field.elemID.getFullName()} is a formula field with no formula?`)
    return
  }

  log.debug(`Extracting formula refs from ${field.elemID.getFullName()}`)

  try {
    const formulaIdentifiers: string[] = log.time(
      () => (extract(formula)),
      `Parse formula '${formula.slice(0, 15)}'`
    )

    const identifiersInfo = await log.time(
      () => Promise.all(
        formulaIdentifiers.map(async identifier => parseFormulaIdentifier(identifier, field.parent.elemID.typeName))
      ),
      'Convert formula identifiers to references'
    )

    // We check the # of refs before we filter bad refs out because otherwise the # of refs will be affected by the
    // filtering.
    const references = (await referencesFromIdentifiers(identifiersInfo.flat()))

    if (references.length < identifiersInfo.length) {
      log.warn(`Some formula identifiers were not converted to references.
      Field: ${field.elemID.getFullName()}
      Formula: ${formula}
      Identifiers: ${identifiersInfo.flat().map(info => info.instance).join(', ')}
      References: ${references.map(ref => ref.getFullName()).join(', ')}`)
    }

    const [validReferences, invalidReferences] = _.partition(references, isValidReference)
    logInvalidReferences(invalidReferences, formula, identifiersInfo)

    const depsAsRefExpr = validReferences.map(elemId => ({ reference: new ReferenceExpression(elemId) }))

    extendGeneratedDependencies(field, depsAsRefExpr)
  } catch (e) {
    log.warn(`Failed to extract references from formula ${formula}: ${e}`)
  }
}

const allReferrableNames = (type: ObjectType): string[] => [
  type.elemID.getFullName(),
  ...Object.values(type.fields).map(field => field.elemID.getFullName()),
]

/**
 * Extract references from formulas
 * Formulas appear in the field definitions of types and may refer to fields in their parent type or in another type.
 * This filter parses formulas, identifies such references and adds them to the _generated_references annotation of the
 * formula field.
 * Note: Currently (pending a fix to SALTO-3176) we only look at formula fields in custom objects.
 * Note: Because formulas are part of the type's definition we assume they can only refer to other types/fields and to
 *       instances
 */
const filter: LocalFilterCreator = () => ({
  name: 'formula_deps',
  onFetch: async elements => {
    const objectTypes = elements.filter(isObjectType)
    const referrableNames = new Set(objectTypes.flatMap(type => allReferrableNames(type)))
    const formulaFields = objectTypes.flatMap(type => Object.values(type.fields)).filter(isFormulaField)
    await Promise.all(formulaFields.map(field => addDependenciesAnnotation(field, referrableNames)))
  },
})

export default filter
