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
import { Element, isInstanceElement, isReferenceExpression, isField, ReadOnlyElementsSource } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { getParents } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections, multiIndex } from '@salto-io/lowerdash'
import { apiName, metadataType } from '../transformers/transformer'
import { LocalFilterCreator } from '../filter'
import { generateReferenceResolverFinder, ReferenceContextStrategyName, FieldReferenceDefinition, getLookUpName, fieldNameToTypeMappingDefs, defaultFieldNameToTypeMappingDefs } from '../transformers/reference_mapping'
import {
  WORKFLOW_ACTION_ALERT_METADATA_TYPE, WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
  WORKFLOW_FLOW_ACTION_METADATA_TYPE, WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE,
  WORKFLOW_TASK_METADATA_TYPE, CPQ_LOOKUP_OBJECT_NAME, CPQ_RULE_LOOKUP_OBJECT_FIELD,
  QUICK_ACTION_METADATA_TYPE, GROUP_METADATA_TYPE, ROLE_METADATA_TYPE, FLOW_METADATA_TYPE,
} from '../constants'
import { buildElementsSourceForFetch, extractFlatCustomObjectFields, hasApiName } from './utils'

const { awu } = collections.asynciterable
const log = logger(module)
const { flatMapAsync } = collections.asynciterable
const { neighborContextGetter, replaceReferenceValues } = referenceUtils

const workflowActionMapper: referenceUtils.ContextValueMapperFunc = (val: string) => {
  const typeMapping: Record<string, string> = {
    Alert: WORKFLOW_ACTION_ALERT_METADATA_TYPE,
    FieldUpdate: WORKFLOW_FIELD_UPDATE_METADATA_TYPE,
    FlowAction: WORKFLOW_FLOW_ACTION_METADATA_TYPE,
    OutboundMessage: WORKFLOW_OUTBOUND_MESSAGE_METADATA_TYPE,
    Task: WORKFLOW_TASK_METADATA_TYPE,
  }
  return typeMapping[val]
}

const flowActionCallMapper: referenceUtils.ContextValueMapperFunc = (val: string) => {
  const typeMapping: Record<string, string> = {
    apex: 'ApexClass',
    emailAlert: WORKFLOW_ACTION_ALERT_METADATA_TYPE,
    quickAction: QUICK_ACTION_METADATA_TYPE,
    flow: FLOW_METADATA_TYPE,
  }
  return typeMapping[val]
}

const shareToMapper: referenceUtils.ContextValueMapperFunc = (val: string) => {
  const typeMapping: Record<string, string> = {
    Role: ROLE_METADATA_TYPE,
    Group: GROUP_METADATA_TYPE,
    RoleAndSubordinates: ROLE_METADATA_TYPE,
  }
  return typeMapping[val]
}

const neighborContextFunc = (args: {
  contextFieldName: string
  levelsUp?: number
  contextValueMapper?: referenceUtils.ContextValueMapperFunc
}): referenceUtils.ContextFunc => neighborContextGetter({ ...args, getLookUpName })

const contextStrategyLookup: Record<
  ReferenceContextStrategyName, referenceUtils.ContextFunc
> = {
  instanceParent: async ({ instance, elemByElemID }) => {
    const parentRef = getParents(instance)[0]
    const parent = isReferenceExpression(parentRef)
      ? elemByElemID.get(parentRef.elemID.getFullName())
      : undefined
    return parent !== undefined ? apiName(parent) : undefined
  },
  neighborTypeLookup: neighborContextFunc({ contextFieldName: 'type' }),
  neighborTypeWorkflow: neighborContextFunc({ contextFieldName: 'type', contextValueMapper: workflowActionMapper }),
  neighborActionTypeFlowLookup: neighborContextFunc({ contextFieldName: 'actionType', contextValueMapper: flowActionCallMapper }),
  neighborActionTypeLookup: neighborContextFunc({ contextFieldName: 'actionType' }),
  neighborCPQLookup: neighborContextFunc({ contextFieldName: CPQ_LOOKUP_OBJECT_NAME }),
  neighborCPQRuleLookup: neighborContextFunc({ contextFieldName: CPQ_RULE_LOOKUP_OBJECT_FIELD }),
  neighborLookupValueTypeLookup: neighborContextFunc({ contextFieldName: 'lookupValueType' }),
  neighborObjectLookup: neighborContextFunc({ contextFieldName: 'object' }),
  parentObjectLookup: neighborContextFunc({ contextFieldName: 'object', levelsUp: 1 }),
  parentInputObjectLookup: neighborContextFunc({ contextFieldName: 'inputObject', levelsUp: 1 }),
  parentOutputObjectLookup: neighborContextFunc({ contextFieldName: 'outputObject', levelsUp: 1 }),
  neighborPicklistObjectLookup: neighborContextFunc({ contextFieldName: 'picklistObject' }),
  neighborSharedToTypeLookup: neighborContextFunc({ contextFieldName: 'sharedToType', contextValueMapper: shareToMapper }),
  neighborTableLookup: neighborContextFunc({ contextFieldName: 'table' }),
  neighborCaseOwnerTypeLookup: neighborContextFunc({ contextFieldName: 'caseOwnerType' }),
  neighborAssignedToTypeLookup: neighborContextFunc({ contextFieldName: 'assignedToType' }),
  neighborRelatedEntityTypeLookup: neighborContextFunc({ contextFieldName: 'relatedEntityType' }),

}


export const addReferences = async (
  elements: Element[],
  referenceElements: ReadOnlyElementsSource,
  defs?: FieldReferenceDefinition[]
): Promise<void> => {
  const resolverFinder = generateReferenceResolverFinder(defs)

  const elementsWithFields = flatMapAsync(
    await referenceElements.getAll(),
    extractFlatCustomObjectFields,
  )
  // TODO - when transformValues becomes async the first index can be to elemID and not the whole
  // element and we can use the element source directly instead of creating the second index
  const { elemLookup, elemByElemID } = await multiIndex.buildMultiIndex<Element>()
    .addIndex({
      name: 'elemLookup',
      filter: hasApiName,
      key: async elem => [await metadataType(elem), await apiName(elem)],
    })
    .addIndex({
      name: 'elemByElemID',
      filter: elem => !isField(elem),
      key: elem => [elem.elemID.getFullName()],
    })
    .process(elementsWithFields)

  const fieldsWithResolvedReferences = new Set<string>()
  await awu(elements)
    .filter(isInstanceElement)
    .forEach(async instance => {
      instance.value = await replaceReferenceValues({
        instance,
        resolverFinder,
        elemLookupMaps: { elemLookup },
        fieldsWithResolvedReferences,
        elemByElemID,
        contextStrategyLookup,
      })
    })
  log.debug('added references in the following fields: %s', [...fieldsWithResolvedReferences])
}

/**
 * Convert field values into references, based on predefined rules.
 *
 */
const filter: LocalFilterCreator = ({ config }) => ({
  name: 'fieldReferencesFilter',
  onFetch: async elements => {
    const refDef = config.enumFieldPermissions
      ? defaultFieldNameToTypeMappingDefs
      : fieldNameToTypeMappingDefs
    await addReferences(
      elements,
      buildElementsSourceForFetch(elements, config),
      refDef,
    )
  },
})

export default filter
