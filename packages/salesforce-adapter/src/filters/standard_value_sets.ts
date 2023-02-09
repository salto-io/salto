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
import { FileProperties } from 'jsforce-types'
import {
  Element,
  ObjectType,
  InstanceElement,
  Field,
  ReferenceExpression,
  isObjectType,
  isInstanceElement,
  isModificationChange,
  isFieldChange,
  getChangeData,
  Change,
  getAllChangeData,
  ModificationChange,
} from '@salto-io/adapter-api'
import { resolveTypeShallow } from '@salto-io/adapter-utils'
import { collections, promises, values as lowerdashValues } from '@salto-io/lowerdash'

import { FilterResult, RemoteFilterCreator } from '../filter'
import { FIELD_ANNOTATIONS, VALUE_SET_FIELDS } from '../constants'
import {
  metadataType, apiName, isCustomObject, Types, isCustom,
} from '../transformers/transformer'
import { extractFullNamesFromValueList, isInstanceOfType } from './utils'
import { ConfigChangeSuggestion } from '../types'
import { fetchMetadataInstances } from '../fetch'

const { mapValuesAsync } = promises.object
const { awu, keyByAsync } = collections.asynciterable
const { makeArray } = collections.array
const { isDefined } = lowerdashValues

export const STANDARD_VALUE_SET = 'StandardValueSet'
export const STANDARD_VALUE = 'standardValue'


type StandardValuesSets = Set<string>
type StandartValueSetsLookup = Record<string, ReferenceExpression>
/*
 * Standard values sets and references are specified in this API apendix:
 * https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/standardvalueset_names.htm
 */

const STANDARD_VALUE_SETS: StandardValuesSets = new Set<string>([
  'AccountContactMultiRoles',
  'AccountContactRole',
  'AccountOwnership',
  'AccountRating',
  'AccountType',
  'AddressCountryCode',
  'AddressStateCode',
  'AssetStatus',
  'CampaignMemberStatus',
  'CampaignStatus',
  'CampaignType',
  'CaseContactRole',
  'CaseOrigin',
  'CasePriority',
  'CaseReason',
  'CaseStatus',
  'CaseType',
  'ContactRole',
  'ContractContactRole',
  'ContractStatus',
  'EntitlementType',
  'EventSubject',
  'EventType',
  'FiscalYearPeriodName',
  'FiscalYearPeriodPrefix',
  'FiscalYearQuarterName',
  'FiscalYearQuarterPrefix',
  'IdeaCategory',
  'IdeaMultiCategory',
  'IdeaStatus',
  'IdeaThemeStatus',
  'Industry',
  'InvoiceStatus',
  'LeadSource',
  'LeadStatus',
  'OpportunityCompetitor',
  'OpportunityStage',
  'OpportunityType',
  'OrderStatus',
  'OrderType',
  'PartnerRole',
  'Product2Family',
  'QuestionOrigin',
  'QuickTextCategory',
  'QuickTextChannel',
  'QuoteStatus',
  'SalesTeamRole',
  'Salutation',
  'ServiceContractApprovalStatus',
  'SocialPostClassification',
  'SocialPostEngagementLevel',
  'SocialPostReviewedStatus',
  'SolutionStatus',
  'TaskPriority',
  'TaskStatus',
  'TaskSubject',
  'TaskType',
  'WorkOrderLineItemStatus',
  'WorkOrderPriority',
  'WorkOrderStatus',
])

const encodeValues = (values: string[]): string =>
  values.sort().join(';')

const svsValuesToRef = (svsInstances: InstanceElement[]): StandartValueSetsLookup => _.fromPairs(
  svsInstances
    .filter(i => i.value[STANDARD_VALUE])
    .map(i => {
      const standardValue = makeArray(i.value[STANDARD_VALUE])
      return [
        encodeValues(extractFullNamesFromValueList(standardValue)),
        new ReferenceExpression(i.elemID),
      ]
    })
)

const isStandardPickList = async (f: Field): Promise<boolean> => {
  const apiNameResult = await apiName(f)
  return apiNameResult
    ? (f.refType.elemID.isEqual(Types.primitiveDataTypes.Picklist.elemID)
      || f.refType.elemID.isEqual(Types.primitiveDataTypes.MultiselectPicklist.elemID))
      && !isCustom(apiNameResult)
    : false
}

const calculatePicklistFieldsToUpdate = async (
  custObjectFields: Record<string, Field>,
  svsValuesToName: StandartValueSetsLookup
): Promise<Record<string, Field>> => mapValuesAsync(custObjectFields, async field => {
  if (!await isStandardPickList(field)
    || _.isEmpty(field.annotations[FIELD_ANNOTATIONS.VALUE_SET])) {
    return field
  }

  const encodedPlVals = encodeValues(extractFullNamesFromValueList(
    field.annotations[FIELD_ANNOTATIONS.VALUE_SET]
  ))
  const foundStandardValueSet = svsValuesToName[encodedPlVals]

  if (!foundStandardValueSet) {
    return field
  }
  const newField = field.clone()
  delete newField.annotations[FIELD_ANNOTATIONS.VALUE_SET]
  newField.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = foundStandardValueSet
  return newField
})

const findStandardValueSetType = async (elements: Element[]): Promise<ObjectType | undefined> =>
  awu(elements).find(
    async (element: Element) => await metadataType(element) === STANDARD_VALUE_SET
  ) as Promise<ObjectType | undefined>

const updateSVSReferences = async (
  objects: ObjectType[],
  svsInstances: InstanceElement[],
): Promise<void> => {
  const svsValuesToName = svsValuesToRef(svsInstances)

  await awu(objects).forEach(async customObjType => {
    const fieldsToUpdate = await calculatePicklistFieldsToUpdate(
      customObjType.fields,
      svsValuesToName,
    )
    _.assign(customObjType, { fields: fieldsToUpdate })
  })
}

const emptyFileProperties = (fullName: string): FileProperties => ({
  fullName,
  createdById: '',
  createdByName: '',
  createdDate: '',
  fileName: '',
  id: '',
  lastModifiedById: '',
  lastModifiedByName: '',
  lastModifiedDate: '',
  type: STANDARD_VALUE_SET,
})

const toDeployableStandardPicklistFieldChange = (
  change: ModificationChange<Field>
): ModificationChange<Field> => {
  const [deployableBefore, deployableAfter] = getAllChangeData(change).map(field => field.clone())
  delete deployableBefore.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
  delete deployableAfter.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
  return {
    data: {
      before: deployableBefore,
      after: deployableAfter,
    },
    action: 'modify',
  }
}

/**
* Declare the StandardValueSets filter that
* adds the fixed collection of standard value sets in SFDC
* and modify reference in fetched elements that uses them.
*/
export const makeFilter = (
  standardValueSetNames: StandardValuesSets
): RemoteFilterCreator => ({ client, config }) => {
  let originalChanges: Record<string, Change>
  return {
    name: 'standardValueSetFilter',
    /**
     * Upon fetch, retrieve standard value sets and
     * modify references to them in fetched elements
     *
     * @param elements the already fetched elements
     */
    onFetch: async (elements: Element[]): Promise<FilterResult> => {
      const svsMetadataType: ObjectType | undefined = await findStandardValueSetType(elements)
      let configChanges: ConfigChangeSuggestion[] = []
      let fetchedSVSInstances: InstanceElement[] | undefined
      if (svsMetadataType !== undefined) {
        const svsInstances = await fetchMetadataInstances({
          client,
          fileProps: [...standardValueSetNames].map(emptyFileProperties),
          metadataType: svsMetadataType,
          metadataQuery: config.fetchProfile.metadataQuery,
          maxInstancesPerType: config.fetchProfile.maxInstancesPerType,
        })
        elements.push(...svsInstances.elements)

        configChanges = svsInstances.configChanges
        fetchedSVSInstances = svsInstances.elements
      }

      const customObjectTypeElements = await awu(elements)
        .filter(isObjectType)
        .filter(isCustomObject)
        .toArray()

      if (customObjectTypeElements.length > 0) {
        const svsInstances = fetchedSVSInstances !== undefined
          ? fetchedSVSInstances
          : await awu(await config.elementsSource.getAll())
            .filter(isInstanceElement)
            .map(async inst => {
              const clone = inst.clone()
              await resolveTypeShallow(clone, config.elementsSource)
              return clone
            })
            .filter(isInstanceOfType(STANDARD_VALUE_SET))
            .toArray()
        await updateSVSReferences(customObjectTypeElements, svsInstances)
      }

      return {
        configSuggestions: configChanges,
      }
    },
    preDeploy: async changes => {
      const standardPicklistFieldChanges = await awu(changes)
        .filter(isModificationChange)
        .filter(isFieldChange)
        .filter(change => isStandardPickList(getChangeData(change)))
        .toArray()
      originalChanges = await keyByAsync(
        standardPicklistFieldChanges,
        change => apiName(getChangeData(change))
      )
      const deployableChanges = standardPicklistFieldChanges
        .map(toDeployableStandardPicklistFieldChange)
      _.pullAll(changes, standardPicklistFieldChanges)
      changes.push(...deployableChanges)
    },
    onDeploy: async changes => {
      const appliedStandardPicklistFieldChanges = await awu(changes)
        .filter(isModificationChange)
        .filter(isFieldChange)
        .filter(change => isStandardPickList(getChangeData(change)))
        .toArray()
      const appliedApiNames = await awu(changes)
        .map(change => apiName(getChangeData(change)))
        .toArray()
      const appliedOriginalChanges = appliedApiNames
        .map(name => originalChanges[name])
        .filter(isDefined)
      _.pullAll(changes, appliedStandardPicklistFieldChanges)
      appliedOriginalChanges.forEach(change => changes.push(change))
    },
  }
}


export default makeFilter(STANDARD_VALUE_SETS)
