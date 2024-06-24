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
import _ from 'lodash'
import {
  InstanceElement,
  ElemID,
  ReferenceExpression,
  isObjectType,
  Field,
  Values,
  ObjectType,
} from '@salto-io/adapter-api'
import { DependencyDirection } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import {
  addReferencesForService,
  FormulaReferenceFinder,
  MappedReference,
  ReferenceFinder,
  createMatcher,
  Matcher,
  getBlockDependencyDirection,
} from '../reference_finders'
import { ZuoraIndex } from './element_index'
import { isZuoraBlock, ZuoraBlock } from './recipe_block_types'

const { isDefined } = lowerdashValues

type ZuoraFieldMatchGroup = { obj?: string; field: string; block: string }
const isZuoraFieldMatchGroup = (val: Values): val is ZuoraFieldMatchGroup =>
  (val.obj === undefined || _.isString(val.obj)) && _.isString(val.field) && _.isString(val.block)

const createFormulaFieldMatcher = (application: string): Matcher<ZuoraFieldMatchGroup> => {
  // example: ('data.zuora.1234abcd.Name')
  const fieldOnlyMatcher = new RegExp(`\\('data\\.${application}\\.(?<block>\\w+)\\.(?<field>\\w+)'\\)`, 'g')
  return createMatcher([fieldOnlyMatcher], isZuoraFieldMatchGroup)
}

export const addZuoraRecipeReferences = async (
  inst: InstanceElement,
  indexedElements: ZuoraIndex,
  appName: string,
): Promise<void> => {
  const objectByBlock: Record<string, string> = {}

  const getObjectDetails = (
    objectName: string,
  ):
    | {
        id: ElemID
        fields: Record<string, Readonly<Field>>
      }
    | undefined => {
    const refObjectFragments = indexedElements[new ElemID('zuora_billing', objectName).getFullName().toLowerCase()]
    if (_.isEmpty(refObjectFragments) || !refObjectFragments.every(isObjectType)) {
      return undefined
    }

    const fields: Record<string, Field> = Object.assign(
      {},
      ...(refObjectFragments as ObjectType[]).map(fragment => fragment.fields),
    )

    return {
      id: refObjectFragments[0].elemID,
      fields,
    }
  }

  const referenceFinder: ReferenceFinder<ZuoraBlock> = (blockValue, path) => {
    const { input } = blockValue
    objectByBlock[blockValue.as] = input.object
    const objectDetails = getObjectDetails(input.object)
    if (objectDetails === undefined) {
      return []
    }

    const location = new ReferenceExpression(path)
    const direction = getBlockDependencyDirection(blockValue)

    const references: MappedReference[] = [
      {
        pathToOverride: path.createNestedID('input', 'object'),
        location,
        reference: new ReferenceExpression(objectDetails.id),
        direction,
      },
    ]

    const inputFieldNames = Object.keys(_.omit(input, 'object'))
    inputFieldNames.forEach(fieldName => {
      if (objectDetails.fields[fieldName] !== undefined) {
        references.push({
          // no pathToOverride because we can't override the field keys in the current format
          location,
          direction,
          reference: new ReferenceExpression(objectDetails.fields[fieldName].elemID),
        })
      }
    })

    return references
  }

  const formulaFieldMatcher = createFormulaFieldMatcher(appName)

  const formulaReferenceFinder: FormulaReferenceFinder = (value, path) => {
    const potentialMatchGroups = formulaFieldMatcher(value)
    return potentialMatchGroups
      .map(({ block, obj, field: fieldName }) => {
        const blockObject = objectByBlock[block]
        const objName = obj ?? blockObject
        if (objName === undefined || blockObject === undefined) {
          // we check that blockObject is defined to make sure this block has the right application
          return undefined
        }

        const objectDetails = getObjectDetails(objName)
        const field = objectDetails?.fields[fieldName]
        if (field !== undefined) {
          return {
            location: new ReferenceExpression(path),
            // references inside formulas are always used as input
            direction: 'input' as DependencyDirection,
            reference: new ReferenceExpression(field.elemID),
          }
        }
        if (objectDetails !== undefined) {
          return {
            location: new ReferenceExpression(path),
            // references inside formulas are always used as input
            direction: 'input' as DependencyDirection,
            reference: new ReferenceExpression(objectDetails.id),
          }
        }
        return undefined
      })
      .filter(isDefined)
  }

  return addReferencesForService<ZuoraBlock>(inst, appName, isZuoraBlock, referenceFinder, formulaReferenceFinder)
}
