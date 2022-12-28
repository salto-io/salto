/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { ElemID, ElemIDType, Field, isObjectType, ReferenceExpression } from '@salto-io/adapter-api'
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
    [IdentifierType.CUSTOM_METADATA_TYPE_RECORD.name]: 'instance',
  } as const)[identifierType.name]
)

const referencesFromIdentifiers = async (typeInfos: FormulaIdentifierInfo[]): Promise<ElemID[]> => (
  typeInfos.map(({ type, instance }) => (
    new ElemID(SALESFORCE,
      instance.split('.')[0],
      identifierTypeToElemIdType(type),
      ...instance.split('.').slice(1))
  ))
)

const addDependenciesAnnotation = async (field: Field): Promise<void> => {
  const formula = field.annotations[FORMULA]
  try {
    const formulaVariables: string[] = log.time(
      () => (extract(formula)),
      `Parse formula '${formula.slice(0, 15)}'`
    )

    const identifiersInfo = await log.time(
      () => Promise.all(
        formulaVariables.map(async x => parseFormulaIdentifier(x, field.parent.elemID.typeName))
      ),
      'Convert formula identifiers to references'
    )

    const references = await referencesFromIdentifiers(identifiersInfo.flat())

    if (references.length < identifiersInfo.length) {
      log.warn(`Some formula identifiers were not converted to references.
      Formula: ${formula}
      Identifiers: ${identifiersInfo.flat().map(info => info.instance).join(', ')}
      References: ${references.map(ref => ref.getFullName()).join(', ')}`)
    }

    const depsAsRefExpr = references.map(elemId => ({ reference: new ReferenceExpression(elemId) }))

    extendGeneratedDependencies(field, depsAsRefExpr)
  } catch (e) {
    log.warn(`Failed to extract references from formula ${formula}: ${e}`)
  }
}

const filter: LocalFilterCreator = () => ({
  name: 'formula_deps',
  onFetch: async elements => {
    const formulaFields = await Promise.all(
      elements.filter(isObjectType).map(async t => Object.values(t.fields).filter(isFormulaField))
    )
    await Promise.all(formulaFields.flat().map(field => addDependenciesAnnotation(field)))
  },
})

export default filter
