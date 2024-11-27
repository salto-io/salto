/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { FileProperties } from '@salto-io/jsforce-types'
import {
  Element,
  ObjectType,
  InstanceElement,
  Field,
  ReferenceExpression,
  isObjectType,
  isAdditionOrModificationChange,
  isField,
  getAllChangeData,
  isObjectTypeChange,
  isFieldChange,
  Change,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { collections, types } from '@salto-io/lowerdash'

import { FilterResult, FilterCreator } from '../filter'
import { FIELD_ANNOTATIONS, VALUE_SET_FIELDS } from '../constants'
import { metadataType, isCustomObject, Types, isCustom } from '../transformers/transformer'
import { apiNameSync, extractFullNamesFromValueList, isInstanceOfTypeSync } from './utils'
import { ConfigChangeSuggestion } from '../types'
import { fetchMetadataInstances } from '../fetch'

const { awu } = collections.asynciterable
const { makeArray } = collections.array

export const STANDARD_VALUE_SET = 'StandardValueSet'
export const STANDARD_VALUE = 'standardValue'

type StandardValuesSets = Set<string>
type StandardValueSetsLookup = Record<string, ReferenceExpression>
/*
 * Standard values sets and references are specified in this API appendix:
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

const encodeValues = (values: string[]): string => values.sort().join(';')

const svsValuesToRef = (svsInstances: InstanceElement[]): StandardValueSetsLookup =>
  _.fromPairs(
    svsInstances
      .filter(i => i.value[STANDARD_VALUE])
      .map(i => {
        const standardValue = makeArray(i.value[STANDARD_VALUE])
        return [encodeValues(extractFullNamesFromValueList(standardValue)), new ReferenceExpression(i.elemID, i)]
      }),
  )

const isStandardPickList = (field: Field): boolean => {
  const apiNameResult = apiNameSync(field)
  return apiNameResult
    ? (field.refType.elemID.isEqual(Types.primitiveDataTypes.Picklist.elemID) ||
        field.refType.elemID.isEqual(Types.primitiveDataTypes.MultiselectPicklist.elemID)) &&
        !isCustom(apiNameResult)
    : false
}

const calculatePicklistFieldsToUpdate = (
  customObjectFields: Record<string, Field>,
  svsValuesToName: StandardValueSetsLookup,
): Record<string, Field> =>
  _.mapValues(customObjectFields, field => {
    if (!isStandardPickList(field) || _.isEmpty(field.annotations[FIELD_ANNOTATIONS.VALUE_SET])) {
      return field
    }

    const encodedPlVals = encodeValues(extractFullNamesFromValueList(field.annotations[FIELD_ANNOTATIONS.VALUE_SET]))
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
  awu(elements).find(async (element: Element) => (await metadataType(element)) === STANDARD_VALUE_SET) as Promise<
    ObjectType | undefined
  >

const updateSVSReferences = async (
  objects: ObjectType[],
  svsInstances: types.NonEmptyArray<InstanceElement>,
): Promise<void> => {
  const svsValuesToName = svsValuesToRef(svsInstances)

  objects.forEach(customObjType => {
    const fieldsToUpdate = calculatePicklistFieldsToUpdate(customObjType.fields, svsValuesToName)
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

const getAllStandardPicklistFields = (changes: Change[]): Field[] =>
  changes
    .filter(isAdditionOrModificationChange)
    .filter(change => isObjectTypeChange(change) || isFieldChange(change))
    .flatMap(getAllChangeData)
    .flatMap(elem => (isObjectType(elem) ? Object.values(elem.fields) : elem))
    .filter(isField)
    .filter(isStandardPickList)

/**
 * Declare the StandardValueSets filter that
 * adds the fixed collection of standard value sets in SFDC
 * and modify reference in fetched elements that uses them.
 */
export const makeFilter =
  (standardValueSetNames: StandardValuesSets): FilterCreator =>
  ({ client, config }) => {
    const fieldToRemovedValueSetName = new Map<string, string>()
    return {
      name: 'standardValueSetFilter',
      /**
       * Upon fetch, retrieve standard value sets and
       * modify references to them in fetched elements
       *
       * @param elements the already fetched elements
       */
      onFetch: async (elements: Element[]): Promise<FilterResult> => {
        if (client === undefined) {
          return {}
        }

        const svsMetadataType: ObjectType | undefined = await findStandardValueSetType(elements)
        let configChanges: ConfigChangeSuggestion[] = []
        let fetchedSVSInstances: InstanceElement[] = []
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

        const customObjectTypeElements = await awu(elements).filter(isObjectType).filter(isCustomObject).toArray()

        if (customObjectTypeElements.length > 0) {
          const svsInstances = !config.fetchProfile.metadataQuery.isPartialFetch()
            ? fetchedSVSInstances
            : await awu(await buildElementsSourceFromElements(elements, [config.elementsSource]).getAll())
                .filter(isInstanceOfTypeSync(STANDARD_VALUE_SET))
                .toArray()
          if (types.isNonEmptyArray(svsInstances)) {
            await updateSVSReferences(customObjectTypeElements, svsInstances)
          }
        }

        return {
          configSuggestions: configChanges,
        }
      },
      preDeploy: async changes => {
        getAllStandardPicklistFields(changes).forEach(field => {
          const svsName = field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
          if (svsName !== undefined) {
            fieldToRemovedValueSetName.set(field.elemID.getFullName(), svsName)
            delete field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME]
          }
        })
      },
      onDeploy: async changes => {
        if (fieldToRemovedValueSetName.size === 0) {
          return
        }

        getAllStandardPicklistFields(changes).forEach(field => {
          const svsName = fieldToRemovedValueSetName.get(field.elemID.getFullName())
          if (svsName !== undefined) {
            field.annotations[VALUE_SET_FIELDS.VALUE_SET_NAME] = svsName
          }
        })
      },
    }
  }

export default makeFilter(STANDARD_VALUE_SETS)
