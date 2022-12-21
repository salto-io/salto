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

import { collections } from '@salto-io/lowerdash'
import { ElemID, ElemIDType, Field, isObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { isFormulaField } from '../transformers/transformer'
import { FORMULA, SALESFORCE } from '../constants'
import { FormulaIdentifierInfo, IdentifierType, parseFormulaIdentifier } from './formula_utils/parse'

/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const formulon = require('formulon')

const { extract } = formulon

const { awu } = collections.asynciterable

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
  const formulaVariables: string[] = extract(field.annotations[FORMULA])

  const IdentifiersInfo = await awu(formulaVariables)
    .flatMap(x => parseFormulaIdentifier(x, field.parent.elemID.typeName))
    .toArray()

  const references = await referencesFromIdentifiers(IdentifiersInfo)

  const depsAsRefExpr = references.map(elemId => ({ reference: new ReferenceExpression(elemId) }))

  extendGeneratedDependencies(field, depsAsRefExpr)
}

const filter: LocalFilterCreator = () => ({
  name: 'formula_deps',
  onFetch: async elements => {
    await awu(elements)
      .filter(isObjectType)
      .forEach(type => awu(Object.values(type.fields))
        .filter(isFormulaField)
        .forEach(field => addDependenciesAnnotation(field)))
  },
})

export default filter
