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
  InstanceElement, ElemID, ReferenceExpression,
  isObjectType, ObjectType, Field, Values,
} from '@salto-io/adapter-api'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { SalesforceIndex } from '../element_indexes'
import { isSalesforceBlock, SalesforceBlock } from './recipe_block_types'
import { addReferencesForService, FormulaReferenceFinder, MappedReference, ReferenceFinder, createMatcher, Matcher } from './shared'

const { isDefined } = lowerdashValues

const SALESFORCE_LABEL_ANNOTATION = 'label'

type SalesforceFieldMatchGroup = { obj?: string; field: string; block: string }
const isSalesforceFieldMatchGroup = (val: Values): val is SalesforceFieldMatchGroup => (
  (val.obj === undefined || _.isString(val.obj))
  && _.isString(val.field)
  && _.isString(val.block)
)

const createFormulaFieldMatcher = (application: string): Matcher<SalesforceFieldMatchGroup> => {
  // example: ('data.salesforce.1234abcd.Account.first.Name')
  const objectAndFieldMatcher = new RegExp(`\\('data\\.${application}\\.(?<block>\\w+)\\.(?!sobject\\.)(?<obj>\\w+)\\.(?:\\w+)\\.(?<field>\\w+)'\\)`, 'g')
  // example: ('data.salesforce.1234abcd.sobject.Account.Name')
  const relatedObjectAndFieldMatcher = new RegExp(`\\('data\\.${application}\\.(?<block>\\w+)\\.sobject\\.(?<obj>\\w+)\\.(?<field>\\w+)'\\)`, 'g')
  // example: ('data.salesforce.1234abcd.sobject.Name')
  const sobjectFieldMatcher = new RegExp(`\\('data\\.${application}\\.(?<block>\\w+)\\.sobject\\.(?<field>\\w+)'\\)`, 'g')
  // example: ('data.salesforce.1234abcd.Name')
  const fieldOnlyMatcher = new RegExp(`\\('data\\.${application}\\.(?<block>\\w+)\\.(?<field>\\w+)'\\)`, 'g')
  return createMatcher(
    [objectAndFieldMatcher, relatedObjectAndFieldMatcher, sobjectFieldMatcher, fieldOnlyMatcher],
    isSalesforceFieldMatchGroup,
  )
}

const fieldListRelatedObjectAndFieldMatcher = createMatcher(
  // example: Account$Account ID.Id
  [new RegExp('^(?<obj>\\w+)\\$([^.]+)\\.(?<field>\\w+)$', 'g')],
  (val: Values): val is { obj: string; field: string } => (
    _.isString(val.obj) && _.isString(val.field)
  ),
)

export const addSalesforceRecipeReferences = (
  inst: InstanceElement,
  indexedElements: SalesforceIndex,
  appName: string,
): void => {
  const sobjectByBlock: Record<string, string> = {}

  const getObjectDetails = (objectName: string): {
    id: ElemID
    fields: Record<string, Readonly<Field>>
    label?: string
   } | undefined => {
    const refObjectFragments = (
      indexedElements.CustomObject?.[objectName] ?? indexedElements[objectName]?.[objectName]
    )
    if (!_.isEmpty(refObjectFragments) && refObjectFragments.every(isObjectType)) {
      const fields: Record<string, Field> = Object.assign(
        {},
        ...(refObjectFragments as ObjectType[]).map(fragment => fragment.fields),
      )
      const label = refObjectFragments.map(
        ref => ref.annotations[SALESFORCE_LABEL_ANNOTATION]
      ).find(_.isString)
      return {
        id: refObjectFragments[0].elemID,
        fields,
        label,
      }
    }
    return undefined
  }

  const referenceFinder: ReferenceFinder<SalesforceBlock> = (blockValue, path) => {
    const { dynamicPickListSelection, input } = blockValue
    sobjectByBlock[blockValue.as] = input.sobject_name
    const objectDetails = getObjectDetails(input.sobject_name)
    if (objectDetails === undefined) {
      return []
    }

    const references: MappedReference[] = [{
      srcPath: path.createNestedID('input', 'sobject_name'),
      ref: new ReferenceExpression(objectDetails.id),
    }]

    const inputFieldNames = Object.keys(_.omit(input, 'sobject_name'))
    inputFieldNames.forEach(fieldName => {
      if (objectDetails.fields[fieldName] !== undefined) {
        references.push(
          {
            // no srcPath because we can't override the field keys in the current format
            srcPath: undefined,
            ref: new ReferenceExpression(objectDetails.fields[fieldName].elemID),
          },
        )
      }
    })

    // dynamicPickListSelection uses the label, not the api name
    if (dynamicPickListSelection.sobject_name === objectDetails.label) {
      references.push({
        srcPath: path.createNestedID('dynamicPickListSelection', 'sobject_name'),
        ref: new ReferenceExpression(objectDetails.id),
      })

      if (dynamicPickListSelection.field_list !== undefined) {
        const potentialFields: string[] = (dynamicPickListSelection.field_list).map(
          (f: { value: string }) => f.value
        )
        potentialFields.forEach((fieldName, idx) => {
          const relatedObjectCheck = fieldListRelatedObjectAndFieldMatcher(fieldName)[0]
          if (relatedObjectCheck !== undefined) {
            const { obj, field } = relatedObjectCheck
            const relatedObjectDetails = getObjectDetails(obj)
            if (relatedObjectDetails === undefined) {
              return
            }
            if (relatedObjectDetails.fields[field] !== undefined) {
              references.push(
                {
                  srcPath: path.createNestedID('dynamicPickListSelection', 'field_list', String(idx)),
                  ref: new ReferenceExpression(relatedObjectDetails.fields[field].elemID),
                },
              )
              references.push(
                {
                  srcPath: undefined,
                  ref: new ReferenceExpression(relatedObjectDetails.id),
                },
              )
            }
          } else if (objectDetails.fields[fieldName] !== undefined) {
            references.push(
              {
                srcPath: path.createNestedID('dynamicPickListSelection', 'field_list', String(idx)),
                ref: new ReferenceExpression(objectDetails.fields[fieldName].elemID),
              },
            )
          }
        })
      }
      if (dynamicPickListSelection.table_list !== undefined) {
        const potentialReferencedTypes: string[] = (dynamicPickListSelection.table_list).map(
          (f: { value: string }) => f.value
        )
        potentialReferencedTypes.forEach((typeName, idx) => {
          const refObjectDetails = getObjectDetails(typeName)
          if (refObjectDetails !== undefined) {
            references.push(
              {
                srcPath: path.createNestedID('dynamicPickListSelection', 'table_list', String(idx)),
                ref: new ReferenceExpression(refObjectDetails.id),
              },
            )
          }
        })
      }
    }
    return references
  }

  const formulaFieldMatcher = createFormulaFieldMatcher(appName)

  const formulaReferenceFinder: FormulaReferenceFinder = value => {
    const potentialMatchGroups = formulaFieldMatcher(value)
    return potentialMatchGroups.map(({ block, obj, field }) => {
      const blockSObject = sobjectByBlock[block]
      const objName = obj ?? blockSObject
      if (objName === undefined || blockSObject === undefined) {
        // we check that blockSObject is defined to make sure this block has the right application
        return undefined
      }

      const objectDetails = getObjectDetails(objName)
      if (field !== undefined && objectDetails?.fields[field] !== undefined) {
        return {
          srcPath: undefined,
          ref: new ReferenceExpression(objectDetails.fields[field].elemID),
        }
      }
      if (objectDetails !== undefined) {
        return {
          srcPath: undefined,
          ref: new ReferenceExpression(objectDetails.id),
        }
      }
      return undefined
    }).filter(isDefined)
  }

  return addReferencesForService<SalesforceBlock>(
    inst,
    appName,
    isSalesforceBlock,
    referenceFinder,
    formulaReferenceFinder,
  )
}
