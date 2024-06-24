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
import { InstanceElement, isInstanceElement, ReferenceExpression, ElemID, Values } from '@salto-io/adapter-api'
import { DependencyDirection } from '@salto-io/adapter-utils'
import { values as lowerdashValues } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  addReferencesForService,
  FormulaReferenceFinder,
  MappedReference,
  ReferenceFinder,
  getBlockDependencyDirection,
  createMatcher,
  Matcher,
} from '../reference_finders'
import { ZendeskIndex } from './element_index'
import { isZendeskBlock, ZendeskBlock } from './recipe_block_types'

const log = logger(module)
const { isDefined } = lowerdashValues
const ID_FIELD_REGEX = /^field_(\d+)$/ // pattern: field_<number>
const KEY_FIELD_REGEX = /^field_([^\s]+)$/ // pattern: field_<string>

const BLOCK_NAMES_BY_TYPE = {
  ticket: ['update_ticket', 'create_ticket', 'bulk_ticket_update', 'close_ticket'],
  user: ['search_user', 'update_user', 'create_user'],
  organization: ['update_organization'],
  other: [
    'create_custom_record',
    'create_relationship_record',
    'bulk_upsert',
    'delete_custom_record',
    'get_user_by_id',
    'get_orgs_by_external_ids',
    'lookup_group',
    'get_relationship_records',
    'create_upload',
    'get_custom_record',
    'get_tickets_by_external_id',
    'list_user_identities',
  ],
}

type ZendeskFieldMatchGroup = { custom?: string; field: string; block: string }

type CustomFieldsReferencesArgs = {
  indexKey: Record<string | number, Readonly<InstanceElement>>
  indexValue: Record<string | number, Record<string, Readonly<InstanceElement>>>
  regex?: RegExp
  fieldKeyConverter?: (match: string) => string | number
}

const isZendeskFieldMatchGroup = (val: Values): val is ZendeskFieldMatchGroup =>
  (val.custom === undefined || _.isString(val.custom)) && _.isString(val.field) && _.isString(val.block)

const createFormulaFieldMatcher = (application: string): Matcher<ZendeskFieldMatchGroup> => {
  // example: ('data.zendesk.1234abcd.priority')
  const ticketStandardFieldMatcher = new RegExp(`\\('data\\.${application}\\.(?<block>\\w+)\\.(?<field>\\w+)'\\)`, 'g')

  // example: ('data.zendesk.1234abcd.custom_field.field_6092682303763')
  // example: ('data.zendesk.1234abcd.organization_fields.field_age')
  // example: ('data.zendesk.1234abcd.user_field.field_userfield1')
  // example: ('data.zendesk.1234abcd.users.first.user_field.field_userfield1')
  // example: ('data.zendesk.1234abcd.get_user_by_id(requester_id>id).user_field.field_userfield1')
  // example: ('data.zendesk.1234abcd.get_organization_by_id(organization_id>id).organization_fields.field_age')
  const customFieldMatcher = new RegExp(
    `\\('data\\.${application}\\.(?<block>\\w+)\\.[^\\']*?\\.(?<custom>\\w+)_fields\\.field_(?<field>\\w+)[^\\']*?'\\)`,
    'g',
  )

  return createMatcher([ticketStandardFieldMatcher, customFieldMatcher], isZendeskFieldMatchGroup)
}

const getFieldReference = (
  index: Record<string | number, Readonly<InstanceElement>>,
  path: ElemID,
  fieldName?: string | number,
): MappedReference | undefined => {
  if (fieldName === undefined || !isInstanceElement(index[fieldName])) {
    return undefined
  }

  return {
    location: new ReferenceExpression(path),
    // references inside formulas are always used as input
    direction: 'input' as DependencyDirection,
    reference: new ReferenceExpression(index[fieldName].elemID, index[fieldName]),
  }
}

export const addZendeskRecipeReferences = async (
  inst: InstanceElement,
  indexedElements: ZendeskIndex,
  appName: string,
): Promise<void> => {
  const references: MappedReference[] = []
  const zendeskBlocks: string[] = []

  const referenceFinder: ReferenceFinder<ZendeskBlock> = (blockValue, path) => {
    const { input, name } = blockValue
    zendeskBlocks.push(blockValue.as)

    const direction = getBlockDependencyDirection(blockValue)
    const inputFieldKeys = Object.keys(input)

    const addPotentialIdReference = (valueInst: unknown, nestedPath?: ElemID): boolean => {
      if (isInstanceElement(valueInst)) {
        references.push({
          pathToOverride: nestedPath,
          location: new ReferenceExpression(path),
          direction,
          reference: new ReferenceExpression(valueInst.elemID, valueInst),
        })
        return true
      }
      return false
    }

    const addCustomFieldsReferences = ({
      indexKey,
      indexValue,
      regex = KEY_FIELD_REGEX,
      fieldKeyConverter = match => match,
    }: CustomFieldsReferencesArgs): void => {
      inputFieldKeys.forEach(field => {
        const match = field.match(regex)
        if (match === null || match.length < 2) {
          return
        }

        const fieldKey = fieldKeyConverter(match[1])
        if (
          !_.isNaN(fieldKey) &&
          addPotentialIdReference(
            indexKey[fieldKey],
            // no pathToOverride because we can't override the field keys in the current format
          )
        ) {
          const optionsByValue = indexValue[fieldKey]
          if (optionsByValue !== undefined && input[field] !== undefined) {
            addPotentialIdReference(optionsByValue[input[field]], path.createNestedID('input', field))
          }
        }
      })
    }

    if (input.macro_ids !== undefined && input.macro_ids.id !== undefined) {
      addPotentialIdReference(
        indexedElements.elementsByInternalID.macros[input.macro_ids.id],
        path.createNestedID('input', 'macro_ids', 'id'),
      )
    }

    if (input.group_id !== undefined) {
      addPotentialIdReference(
        indexedElements.elementsByInternalID.groups[input.group_id],
        path.createNestedID('input', 'group_id'),
      )
    }

    if (input.brand_id !== undefined) {
      addPotentialIdReference(
        indexedElements.elementsByInternalID.brands[input.brand_id],
        path.createNestedID('input', 'brand_id'),
      )
    }

    if (input.ticket_form_id !== undefined) {
      addPotentialIdReference(
        indexedElements.elementsByInternalID.ticketForms[input.ticket_form_id],
        path.createNestedID('input', 'ticket_form_id'),
      )
    }

    if (BLOCK_NAMES_BY_TYPE.ticket.includes(name)) {
      addCustomFieldsReferences({
        indexKey: indexedElements.elementsByInternalID.ticketFields,
        indexValue: indexedElements.ticketCustomOptionByFieldIdAndValue,
        regex: ID_FIELD_REGEX,
        fieldKeyConverter: match => Number(match),
      })
    } else if (BLOCK_NAMES_BY_TYPE.user.includes(name)) {
      addCustomFieldsReferences({
        indexKey: indexedElements.customFieldsByKey.user,
        indexValue: indexedElements.customOptionsByFieldKeyAndValue.user,
      })
    } else if (BLOCK_NAMES_BY_TYPE.organization.includes(name)) {
      addCustomFieldsReferences({
        indexKey: indexedElements.customFieldsByKey.organization,
        indexValue: indexedElements.customOptionsByFieldKeyAndValue.organization,
      })
    }

    return references
  }

  const formulaFieldMatcher = createFormulaFieldMatcher(appName)

  const formulaReferenceFinder: FormulaReferenceFinder = (value, path) => {
    const potentialMatchGroups = formulaFieldMatcher(value)
    return potentialMatchGroups
      .map(({ custom, block, field: fieldName }) => {
        if (custom !== undefined && block !== undefined && zendeskBlocks.includes(block)) {
          if (custom === 'custom') {
            // === 'ticket'. there is no ticket_fields only custom_fields
            const fieldId = Number(fieldName)
            if (!_.isNaN(fieldId)) {
              return getFieldReference(indexedElements.elementsByInternalID.ticketFields, path, fieldId)
            }
            log.debug(
              'Unknown custom_field Zehdesk Formula - %s. field_%s should looks like field_<ID (Number)>',
              value,
              custom,
            )
            return undefined
          }

          if (custom === 'user') {
            return getFieldReference(indexedElements.customFieldsByKey.user, path, fieldName)
          }

          if (custom === 'organization') {
            return getFieldReference(indexedElements.customFieldsByKey.organization, path, fieldName)
          }
          log.debug('Unknown field_%s in Zendesk Formula: %s', custom, value)
        }

        return undefined
      })
      .filter(isDefined)
  }

  return addReferencesForService<ZendeskBlock>(inst, appName, isZendeskBlock, referenceFinder, formulaReferenceFinder)
}
