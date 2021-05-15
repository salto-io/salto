/*
*                      Copyright 2021 Salto Labs Ltd.
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
import {
  InstanceElement, ElemID, ReferenceExpression, Values,
} from '@salto-io/adapter-api'
import { DependencyDirection } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { NetsuiteIndex } from '../element_indexes'
import { isNetsuiteBlock, NetsuiteBlock } from './recipe_block_types'
import { addReferencesForService, FormulaReferenceFinder, MappedReference, ReferenceFinder, createMatcher, Matcher, getBlockDependencyDirection } from './shared'

const { isDefined } = lowerdashValues

const OBJECT_REFERENCE_SEEPARATOR = '@@'
const FIELD_REFERENCE_SEPARATOR = '@'

type NetsuiteFieldMatchGroup = { field: string }
const isNetsuiteFieldMatchGroup = (val: Values): val is NetsuiteFieldMatchGroup => (
  _.isString(val.field)
)
const createFormulaFieldMatcher = (application: string): Matcher<NetsuiteFieldMatchGroup> => (
  // note: for netsuite standard fields / salesforce fields we'd need to parse the block's id
  // and (optional) object type to know which object to look for the field under - but
  // for custom fields we have the script id which is globally unique, so we can use it directly
  createMatcher(
    [new RegExp(`\\('data\\.${application}\\.(?:\\w+\\.)+custom_fields\\.f_?(?:[0-9]+_)*(?<field>\\w*)'\\)`, 'g')],
    isNetsuiteFieldMatchGroup,
  )
)

export const addNetsuiteRecipeReferences = async (
  inst: InstanceElement,
  indexedElements: NetsuiteIndex,
  appName: string,
): Promise<void> => {
  const referenceFinder: ReferenceFinder<NetsuiteBlock> = (blockValue, path) => {
    const references: MappedReference[] = []

    const { dynamicPickListSelection, input } = blockValue

    const addPotentialReference = (value: unknown, separator: string, nestedPath: ElemID): void => {
      const lowercaseSeparator = separator.toLowerCase()
      if (_.isString(value) && value.split(lowercaseSeparator).length === 2) {
        const scriptId = _.last(value.toLowerCase().split(lowercaseSeparator))
        if (scriptId !== undefined) {
          const referencedId = indexedElements[scriptId]
          if (referencedId !== undefined) {
            references.push({
              pathToOverride: nestedPath,
              location: new ReferenceExpression(path),
              direction: getBlockDependencyDirection(blockValue),
              reference: new ReferenceExpression(referencedId),
            })
          }
        }
      }
    }

    const netsuiteObject = input?.netsuite_object
    if (netsuiteObject !== undefined) {
      addPotentialReference(netsuiteObject, OBJECT_REFERENCE_SEEPARATOR, path.createNestedID('input', 'netsuite_object'))
    }
    (dynamicPickListSelection.custom_list ?? []).forEach(({ value }, idx) => {
      addPotentialReference(
        value,
        FIELD_REFERENCE_SEPARATOR,
        path.createNestedID('dynamicPickListSelection', 'custom_list', String(idx)),
      )
    })
    return references
  }

  const formulaFieldMatcher = createFormulaFieldMatcher(appName)

  const formulaReferenceFinder: FormulaReferenceFinder = (value, path) => {
    const potentialFields = formulaFieldMatcher(value).map(match => match.field)
    return potentialFields.map(fieldNameScriptId => {
      const referencedId = indexedElements[fieldNameScriptId]
      if (referencedId !== undefined) {
        return {
          location: new ReferenceExpression(path),
          // references inside formulas are always used as input
          direction: 'input' as DependencyDirection,
          reference: new ReferenceExpression(referencedId),
        }
      }
      return undefined
    }).filter(isDefined)
  }

  return addReferencesForService<NetsuiteBlock>(
    inst,
    appName,
    isNetsuiteBlock,
    referenceFinder,
    formulaReferenceFinder,
  )
}
