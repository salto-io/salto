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
import { collections } from '@salto-io/lowerdash'
import { CORE_ANNOTATIONS, ElemID, Field, isObjectType, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { extendGeneratedDependencies } from '@salto-io/adapter-utils'
import { LocalFilterCreator } from '../filter'
import { isFormulaField } from '../transformers/transformer'
import { FORMULA, SALESFORCE } from '../constants'

/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const forcemula = require('forcemula')
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
const formulon = require('formulon')

const parse = forcemula
const { extract } = formulon

const { awu } = collections.asynciterable
const log = logger(module)


const getFormulaDependenciesUsingForcemula = async (formulaText: string, parentType: ObjectType): Promise<string[]> => {
  // const parentTypeName = await apiName(parentType)
  // if (!parentTypeName) {
  //   log.warn(`Unable to get type name for ${parentType.elemID.getFullName()}`)
  //   return []
  // }

  const { standardFields,
    standardObjects,
    customMetadataTypeRecords,
    customMetadataTypes,
    customFields,
    customObjects,
    customSettings } = parse({ formula: formulaText, object: parentType.elemID.typeName })

  const types = [
    ...(standardObjects ?? []),
    ...(customMetadataTypes ?? []),
    ...(customObjects ?? []),
    ...(customSettings ?? []), // TODO is this right?
  ].map(typeName => new ElemID(SALESFORCE, typeName, 'type'))
    .map(elemId => elemId.getFullName())
  const fields = [
    ...(standardFields ?? []),
    ...(customFields ?? []),
  ].map(fieldName => new ElemID(SALESFORCE, fieldName.split('.')[0], 'field', ...fieldName.split('.').slice(1)))
    .map(elemId => elemId.getFullName())
  const instances = [
    ...(customMetadataTypeRecords ?? []),
  ].map(fieldName => new ElemID(SALESFORCE, fieldName.split('.')[0], 'instance', ...fieldName.split('.').slice(1)))
    .map(elemId => elemId.getFullName())

  return [
    ...types,
    ...fields,
    ...instances,
  ]
}

const getFormulaDependenciesUsingFormulon = (formulaText: string, _parentType: ObjectType): string[] => (
  extract(formulaText)
)

const addDependenciesAnnotation = async (field: Field): Promise<void> => {
  const initialDeps = field.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] ?? []
  field.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] = initialDeps

  const formulonResults = getFormulaDependenciesUsingFormulon(field.annotations[FORMULA], field.parent)
  log.info(`FormulonResults: ${formulonResults}`)
  const forcemulaResult = await getFormulaDependenciesUsingForcemula(field.annotations[FORMULA], field.parent)
  log.info(`ForcemulaResults: ${forcemulaResult}`)
  const translatedForumulonResults = await awu(formulonResults)
    .map(x => getFormulaDependenciesUsingForcemula(x, field.parent)).toArray()
  log.info(`translatedForumulonResults: ${translatedForumulonResults}`)

  const depsAsRefExpr = forcemulaResult
    .map(dep => new ReferenceExpression(ElemID.fromFullName(dep)))
    .map(ref => ({ reference: ref }))
  // field.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES] = initialDeps.concat(depsAsRefExpr)
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
