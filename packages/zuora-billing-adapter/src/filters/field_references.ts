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
import { Element } from '@salto-io/adapter-api'
import { references as referenceUtils } from '@salto-io/adapter-components'
import { WORKFLOW_DETAILED_TYPE, TASK_TYPE, SETTINGS_TYPE_PREFIX } from '../constants'
import { FilterCreator } from '../filter'

type ZuoraReferenceSerializationStrategyName = 'currencyCode' | 'segmentName'
const ZuoraReferenceSerializationStrategyLookup: Record<
  ZuoraReferenceSerializationStrategyName | referenceUtils.ReferenceSerializationStrategyName,
  referenceUtils.ReferenceSerializationStrategy
> = {
  ...referenceUtils.ReferenceSerializationStrategyLookup,
  currencyCode: {
    serialize: ({ ref }) => ref.value.value.currencyCode,
    lookup: val => val,
    lookupIndexName: 'currencyCode',
  },
  segmentName: {
    serialize: ({ ref }) => ref.value.value.segmentName,
    lookup: val => val,
    lookupIndexName: 'segmentName',
  },
}

type ZuoraFieldReferenceDefinition = referenceUtils.FieldReferenceDefinition<never> & {
  zuoraSerializationStrategy?: ZuoraReferenceSerializationStrategyName
}

class ZuoraFieldReferenceResolver extends referenceUtils.FieldReferenceResolver<never> {
  constructor(def: ZuoraFieldReferenceDefinition) {
    super({ src: def.src })
    this.serializationStrategy = ZuoraReferenceSerializationStrategyLookup[
      def.zuoraSerializationStrategy ?? def.serializationStrategy ?? 'fullValue'
    ]
    this.target = def.target
      ? { ...def.target, lookup: this.serializationStrategy.lookup }
      : undefined
  }
}

const fieldNameToTypeMappingDefs: ZuoraFieldReferenceDefinition[] = [
  {
    src: { field: 'source_workflow_id', parentTypes: ['Linkage'] },
    serializationStrategy: 'id',
    target: { type: WORKFLOW_DETAILED_TYPE },
  },
  {
    src: { field: 'target_task_id', parentTypes: ['Linkage'] },
    serializationStrategy: 'id',
    target: { type: TASK_TYPE },
  },
  {
    src: { field: 'source_task_id', parentTypes: ['Linkage'] },
    serializationStrategy: 'id',
    target: { type: TASK_TYPE },
  },
  {
    src: { field: 'profileId', parentTypes: [`${SETTINGS_TYPE_PREFIX}Notification`] },
    serializationStrategy: 'id',
    target: { type: `${SETTINGS_TYPE_PREFIX}CommunicationProfile` },
  },
  {
    src: { field: 'communicationProfileId', parentTypes: ['PublicNotificationDefinition'] },
    serializationStrategy: 'id',
    target: { type: `${SETTINGS_TYPE_PREFIX}CommunicationProfile` },
  },
  {
    src: { field: 'emailTemplateName', parentTypes: [`${SETTINGS_TYPE_PREFIX}Notification`] },
    serializationStrategy: 'name',
    target: { type: 'PublicEmailTemplate' },
  },
  {
    src: { field: 'emailTemplateId', parentTypes: ['PublicNotificationDefinition'] },
    serializationStrategy: 'id',
    target: { type: 'PublicEmailTemplate' },
  },
  {
    src: { field: 'revenueRecognitionRuleName', parentTypes: ['GETProductRatePlanChargeType'] },
    serializationStrategy: 'name',
    target: { type: `${SETTINGS_TYPE_PREFIX}RevenueRecognitionRule` },
  },
  {
    src: { field: 'uom', parentTypes: ['GETProductRatePlanChargeType'] },
    serializationStrategy: 'name',
    target: { type: `${SETTINGS_TYPE_PREFIX}UnitOfMeasure` },
  },
  {
    src: { field: 'taxCode', parentTypes: ['GETProductRatePlanChargeType'] },
    serializationStrategy: 'name',
    target: { type: `${SETTINGS_TYPE_PREFIX}TaxCode` },
  },
  {
    src: { field: 'discountClass', parentTypes: ['GETProductRatePlanChargeType'] },
    serializationStrategy: 'name',
    target: { type: `${SETTINGS_TYPE_PREFIX}DiscountSetting` },
  },
  {
    src: { field: 'appliedProductRatePlanId', parentTypes: ['GETProductDiscountApplyDetailsType'] },
    serializationStrategy: 'id',
    target: { type: 'ProductRatePlanType' },
  },
  {
    src: { field: 'appliedProductRatePlanChargeId', parentTypes: ['GETProductDiscountApplyDetailsType'] },
    serializationStrategy: 'id',
    target: { type: 'GETProductRatePlanChargeType' },
  },
  {
    src: { field: 'id', parentTypes: ['PaymentGatewayResponse', `${SETTINGS_TYPE_PREFIX}GatewayResponse`] },
    serializationStrategy: 'id',
    target: { type: `${SETTINGS_TYPE_PREFIX}Gateway` },
  },
  {
    src: { field: 'taxEngineId', parentTypes: [`${SETTINGS_TYPE_PREFIX}TaxCode`, `${SETTINGS_TYPE_PREFIX}TaxCompany`] },
    serializationStrategy: 'id',
    target: { type: `${SETTINGS_TYPE_PREFIX}TaxEngine` },
  },
  {
    src: { field: 'taxCompanyId', parentTypes: [`${SETTINGS_TYPE_PREFIX}TaxCode`] },
    serializationStrategy: 'id',
    target: { type: `${SETTINGS_TYPE_PREFIX}TaxCompany` },
  },
  {
    src: { field: 'pageId', parentTypes: ['HostedPage'] },
    serializationStrategy: 'id',
    target: { type: `${SETTINGS_TYPE_PREFIX}HostedPaymentPage` },
  },
  {
    src: { field: 'currency', parentTypes: ['GETProductRatePlanChargePricingType'] },
    zuoraSerializationStrategy: 'currencyCode',
    target: { type: `${SETTINGS_TYPE_PREFIX}Currency` },
  },
  {
    src: { field: 'homeCurrencyCode', parentTypes: [`${SETTINGS_TYPE_PREFIX}FxCurrency`] },
    zuoraSerializationStrategy: 'currencyCode',
    target: { type: `${SETTINGS_TYPE_PREFIX}Currency` },
  },
  {
    src: { field: 'segmentName', parentTypes: [`${SETTINGS_TYPE_PREFIX}RuleDetail`] },
    zuoraSerializationStrategy: 'segmentName',
    target: { type: `${SETTINGS_TYPE_PREFIX}Segment` },
  },

  // the following are future references - target objects aren't supported on the api yet
  {
    src: { field: 'entityId', parentTypes: [`${SETTINGS_TYPE_PREFIX}Role`] },
    serializationStrategy: 'id',
    target: { type: `${SETTINGS_TYPE_PREFIX}EntityNode` },
  },
]

/**
 * Convert field values into references, based on predefined rules.
 *
 */
const filter: FilterCreator = () => ({
  name: 'fieldReferencesFilter',
  onFetch: async (elements: Element[]) => {
    await referenceUtils.addReferences({
      elements,
      defs: fieldNameToTypeMappingDefs,
      fieldsToGroupBy: ['id', 'name', 'currencyCode', 'segmentName'],
      fieldReferenceResolverCreator: defs => new ZuoraFieldReferenceResolver(defs),
    })
  },
})

export default filter
