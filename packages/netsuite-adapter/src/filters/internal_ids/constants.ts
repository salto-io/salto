/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

export const TABLE_NAME_TO_ID_PARAMETER_MAP: Record<string, 'id' | 'internalid'> = {
  allparserplugin: 'id',
  bundleinstallationscript: 'id',
  bundleinstallationscriptdeployment: 'id',
  clientscript: 'id',
  clientscriptdeployment: 'id',
  consolidatedrateadjustorplugin: 'id',
  customglplugin: 'id',
  customsegment: 'internalid',
  customlist: 'internalid',
  customrecordtype: 'internalid',
  customrecordactionscript: 'id',
  datasetbuilderplugin: 'id',
  customtransactiontype: 'id',
  emailcaptureplugin: 'id',
  emailtemplate: 'id',
  ficonnectivityplugin: 'id',
  fiparserplugin: 'id',
  mapreducescriptdeployment: 'id',
  mapreducescript: 'id',
  massupdatescript: 'id',
  massupdatescriptdeployment: 'id',
  paymentgatewayplugin: 'id',
  platformextensionplugin: 'id',
  plugintypeimpl: 'id',
  plugintype: 'id',
  portlet: 'id',
  portletdeployment: 'id',
  promotionsplugin: 'id',
  recordactionscriptdeployment: 'id',
  restlet: 'id',
  restletdeployment: 'id',
  role: 'id',
  scheduledscript: 'id',
  scheduledscriptdeployment: 'id',
  script: 'id',
  scriptdeployment: 'id',
  shippingpartnersplugin: 'id',
  sublist: 'id',
  suitelet: 'id',
  suiteletdeployment: 'id',
  taxcalculationplugin: 'id',
  testplugin: 'id',
  usereventscript: 'id',
  usereventscriptdeployment: 'id',
  usrsavedsearch: 'internalid',
  webapp: 'id',
  workflowactionscript: 'id',
  workbookbuilderplugin: 'id',
  workflowactionscriptdeployment: 'id',
  customfield: 'internalid',
}

export const RECORD_ID_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  items: {
    anyOf: [
      {
        allOf: [
          {
            properties: {
              scriptid: {
                type: 'string',
              },
            },
            required: ['scriptid'],
            type: 'object',
          },
          {
            properties: {
              id: {
                type: 'string',
              },
            },
            required: ['id'],
            type: 'object',
          },
        ],
      },
      {
        allOf: [
          {
            properties: {
              scriptid: {
                type: 'string',
              },
            },
            required: ['scriptid'],
            type: 'object',
          },
          {
            properties: {
              internalid: {
                type: 'string',
              },
            },
            required: ['internalid'],
            type: 'object',
          },
        ],
      },
    ],
  },
  type: 'array',
}

export const SAVED_SEARCH_RESULTS_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  items: {
    properties: {
      id: {
        type: 'string',
      },
      internalid: {
        items: [
          {
            properties: {
              value: {
                type: 'string',
              },
            },
            required: ['value'],
            type: 'object',
          },
        ],
        maxItems: 1,
        minItems: 1,
        type: 'array',
      },
    },
    required: ['id', 'internalid'],
    type: 'object',
  },
  type: 'array',
}
