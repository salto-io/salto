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
import { isObjectType, FetchOptions } from '@salto-io/adapter-api'
import { CredsLease } from '@salto-io/e2e-credentials-store'
import { MockInterface } from '@salto-io/test-utils'
import { OAuthClientCredentials } from '../src/auth'
import { credsLease, realAdapter } from './adapter'
import ZuoraAdapter from '../src/adapter'

describe('Zuora adapter E2E with real swagger and mock replies', () => {
  let adapter: ZuoraAdapter
  let credLease: CredsLease<OAuthClientCredentials>

  jest.setTimeout(10 * 1000)

  beforeAll(async () => {
    credLease = await credsLease()
    const adapterAttr = realAdapter({ credentials: credLease.value })
    adapter = adapterAttr.adapter
  })

  afterAll(async () => {
    if (credLease.return) {
      await credLease.return()
    }
  })

  describe('fetch', () => {
    describe('swagger types only', () => {
      it('should generate the right type elements on fetch', async () => {
        const mockFetchOpts: MockInterface<FetchOptions> = {
          progressReporter: { reportProgress: jest.fn() },
        }
        const { elements } = await adapter.fetch(mockFetchOpts)

        expect(elements.every(isObjectType)).toBeTruthy()
        expect(elements.map(e => e.elemID.getFullName()).sort()).toEqual(
          expect.arrayContaining([
            'zuora_billing.AccountingCodeItem',
            'zuora_billing.AccountingCodes',
            'zuora_billing.AccountingPeriod',
            'zuora_billing.AccountingPeriod_fileIds',
            'zuora_billing.AccountingPeriods',
            'zuora_billing.CalloutAuth',
            'zuora_billing.CalloutMergeFields',
            'zuora_billing.CatalogProduct',
            'zuora_billing.CreditMemoEntityPrefix',
            'zuora_billing.CustomObject',
            'zuora_billing.CustomObjectAllFieldsDefinition',
            'zuora_billing.CustomObjectAllFieldsDefinition_CreatedById',
            'zuora_billing.CustomObjectAllFieldsDefinition_CreatedDate',
            'zuora_billing.CustomObjectAllFieldsDefinition_Id',
            'zuora_billing.CustomObjectAllFieldsDefinition_UpdatedById',
            'zuora_billing.CustomObjectAllFieldsDefinition_UpdatedDate',
            'zuora_billing.CustomObjectCustomFieldDefinition',
            'zuora_billing.CustomObjectDefinition',
            'zuora_billing.CustomObjectDefinition_schema',
            'zuora_billing.CustomObjectDefinition_schema_relationships',
            'zuora_billing.CustomObjectDefinition_schema_relationships_recordConstraints',
            'zuora_billing.CustomObjectDefinition_schema_relationships_recordConstraints_create',
            'zuora_billing.CustomObjectDefinitions',
            'zuora_billing.DebitMemoEntityPrefix',
            'zuora_billing.EventTrigger',
            'zuora_billing.EventTriggers',
            'zuora_billing.EventType',
            'zuora_billing.FieldsAdditionalProperties',
            'zuora_billing.FilterRuleParameterDefinition',
            'zuora_billing.FilterRuleParameterDefinitions',
            'zuora_billing.FilterRuleParameterValues',
            'zuora_billing.GETProductDiscountApplyDetailsType',
            'zuora_billing.GETProductRatePlanChargePricingTierType',
            'zuora_billing.GETProductRatePlanChargePricingType',
            'zuora_billing.GETProductRatePlanChargeType',
            'zuora_billing.GETProductRatePlanChargeType_financeInformation',
            'zuora_billing.GetProductFeatureType',
            'zuora_billing.HostedPage',
            'zuora_billing.HostedPages',
            'zuora_billing.InvoiceEntityPrefix',
            'zuora_billing.Linkage',
            'zuora_billing.ListAllSettings',
            'zuora_billing.NotificationDefinitions',
            'zuora_billing.NotificationEmailTemplates',
            'zuora_billing.PaymentEntityPrefix',
            'zuora_billing.PaymentGatewayResponse',
            'zuora_billing.PaymentGateways',
            'zuora_billing.ProductRatePlanType',
            'zuora_billing.ProductType',
            'zuora_billing.PublicEmailTemplate',
            'zuora_billing.PublicNotificationDefinition',
            'zuora_billing.PublicNotificationDefinition_callout',
            'zuora_billing.PublicNotificationDefinition_filterRule',
            'zuora_billing.RefundEntityPrefix',
            'zuora_billing.SequenceSet',
            'zuora_billing.SequenceSets',
            'zuora_billing.SettingItemHttpOperation',
            'zuora_billing.SettingItemHttpRequestParameter',
            'zuora_billing.SettingItemWithOperationsInformation',
            'zuora_billing.StandardObject',
            'zuora_billing.Task',
            'zuora_billing.Workflow',
            'zuora_billing.WorkflowDefinitionAndVersions',
            'zuora_billing.WorkflowDefinitionAndVersions_active_version',
            'zuora_billing.WorkflowExport',
            'zuora_billing.Workflows',
            'zuora_billing.Workflows_pagination',
          ]),
        )
      })
    })
  })
})
