import _ from 'lodash'
import { MetadataInfo } from 'jsforce'
import {
  Element, ObjectType, InstanceElement, isObjectType, Field, ReferenceExpression,
} from 'adapter-api'
import { collections } from '@salto/lowerdash'
import { logger } from '@salto/logging'
import SalesforceClient from '../client/client'
import { FilterCreator } from '../filter'
import {
  SALESFORCE_CUSTOM_SUFFIX, FIELD_ANNOTATIONS,
} from '../constants'
import {
  metadataType, apiName, createInstanceElement, isCustomObject, Types,
} from '../transformers/transformer'

const { makeArray } = collections.array

const log = logger(module)

export const STANDARD_VALUE_SET = 'StandardValueSet'
export const STANDARD_VALUE = 'standard_value'


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

export const extractFullNamesFromValueList = (values: {full_name: string}[]): string[] =>
  values.map(v => v.full_name)

const svsValuesToRef = (svsInstances: InstanceElement[]): StandartValueSetsLookup => _.fromPairs(
  svsInstances
    .filter(i => i.value[STANDARD_VALUE])
    .map(i => {
      const standardValue = makeArray(i.value[STANDARD_VALUE])
      return [
        encodeValues(extractFullNamesFromValueList(standardValue)),
        new ReferenceExpression(i.elemID.createNestedID(STANDARD_VALUE)),
      ]
    })
)

const isStandardPickList = (f: Field): boolean => {
  const apiNameResult = apiName(f)
  return apiNameResult ? (
    f.type.elemID.isEqual(Types.primitiveDataTypes.picklist.elemID)
    || f.type.elemID.isEqual(Types.primitiveDataTypes.multipicklist.elemID))
    && !apiNameResult.endsWith(SALESFORCE_CUSTOM_SUFFIX) : false
}

const calculatePicklistFieldsToUpdate = (
  custObjectFields: Record<string, Field>,
  svsValuesToName: StandartValueSetsLookup
): Record<string, Field> => _.mapValues(custObjectFields, (f: Field) => {
  if (!isStandardPickList(f) || _.isEmpty(f.annotations[FIELD_ANNOTATIONS.VALUE_SET])) {
    return f
  }

  const encodedPlVals = encodeValues(extractFullNamesFromValueList(
    f.annotations[FIELD_ANNOTATIONS.VALUE_SET]
  ))
  const foundStandardValueSet = svsValuesToName[encodedPlVals]

  if (!foundStandardValueSet) {
    return f
  }
  const newField = f.clone()
  newField.annotations[FIELD_ANNOTATIONS.VALUE_SET] = foundStandardValueSet
  return newField
})

const createStandardValueSetInstances = (
  valueSets: MetadataInfo[],
  svsMetadataType: ObjectType
): InstanceElement[] => valueSets
  .filter(vs => vs.fullName)
  .map((svs: MetadataInfo) =>
    createInstanceElement(svs, svsMetadataType))

const findStandardValueSetType = (elements: Element[]): ObjectType | undefined =>
  _.find(
    elements,
    (element: Element) => metadataType(element) === STANDARD_VALUE_SET
  ) as ObjectType | undefined

const fetchStandardValueSets = (
  standardValueSets: Set<string>,
  client: SalesforceClient
): Promise<MetadataInfo[]> =>
  client.readMetadata(STANDARD_VALUE_SET, [...standardValueSets])

const createSVSInstances = async (
  standardValueSetNames: Set<string>,
  client: SalesforceClient,
  svsMetadataType: ObjectType): Promise<InstanceElement[]> => {
  try {
    const valueSets = await fetchStandardValueSets(standardValueSetNames, client)
    return createStandardValueSetInstances(valueSets, svsMetadataType)
  } catch (e) {
    log.error('failed to fetch standard value set %o reason: %o', standardValueSetNames, e)
    return []
  }
}

const updateSVSReferences = (elements: Element[], svsInstances: InstanceElement[]): void => {
  const svsValuesToName = svsValuesToRef(svsInstances)
  const customObjectTypeElements = elements
    .filter(isObjectType)
    .filter(isCustomObject)

  customObjectTypeElements.forEach((custObjType: ObjectType) => {
    const fieldsToUpdate = calculatePicklistFieldsToUpdate(custObjType.fields, svsValuesToName)
    _.assign(custObjType, { fields: fieldsToUpdate })
  })
}


/**
* Declare the StandardValueSets filter that
* adds the fixed collection of standard value sets in SFDC
* and modify reference in fetched elements that uses them.
*/
export const makeFilter = (
  standardValueSetNames: StandardValuesSets
): FilterCreator => ({ client }) => ({
  /**
   * Upon fetch, retrieve standard value sets and
   * modify references to them in fetched elements
   *
   * @param elements the already fetched elements
   */
  onFetch: async (elements: Element[]): Promise<void> => {
    const svsMetadataType: ObjectType | undefined = findStandardValueSetType(elements)
    if (svsMetadataType !== undefined) {
      const svsInstances = await createSVSInstances(standardValueSetNames, client, svsMetadataType)
      elements.push(...svsInstances)
      updateSVSReferences(elements, svsInstances)
    } else {
      // [GF] No StandardValueSet MetadataType was found.
      // Is this considered an error?
      // Not sure about handling this case,
      // we want to at least log this for sure.
    }
  },
})


export default makeFilter(STANDARD_VALUE_SETS)
