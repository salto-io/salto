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

import { BuiltinTypes, CORE_ANNOTATIONS, createRestriction, ElemID, ListType, ObjectType } from '@salto-io/adapter-api'
import { SALESFORCE, SUBTYPES_PATH, TYPES_PATH, IS_ATTRIBUTE, METADATA_TYPE } from '../constants'

const subTypesPath = [SALESFORCE, TYPES_PATH, SUBTYPES_PATH]

const lightningComponentBundleObjectType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleObject'),
  fields: {
    object: { refType: BuiltinTypes.STRING },
  },
  annotations: {
    [METADATA_TYPE]: 'LightningComponentBundleObject',
  },
  path: [...subTypesPath, 'LightningComponentBundleObject'],
})

const lightningComponentBundlePropertyType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleProperty'),
  fields: {
    datasource: {
      // SALTO-861: retrieved as string delimited by ',' but is a list
      refType: BuiltinTypes.STRING,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    default: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    description: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    label: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    max: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    min: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    name: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [IS_ATTRIBUTE]: true,
      },
    },
    placeholder: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    required: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    role: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    type: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['Boolean', 'Integer', 'String', 'Color', 'Date', 'DateTime'],
          // eslint-disable-next-line camelcase
          enforce_value: false,
        }),
      },
    },
  },
  annotations: {
    [METADATA_TYPE]: 'LightningComponentBundleProperty',
  },
  path: [...subTypesPath, 'LightningComponentBundleProperty'],
})

const lightningComponentBundleSupportedFormFactorType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleSupportedFormFactor'),
  fields: {
    type: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['Small', 'Large'] }),
        [IS_ATTRIBUTE]: true,
      },
    },
  },
  annotations: {
    [METADATA_TYPE]: 'LightningComponentBundleSupportedFormFactor',
  },
  path: [...subTypesPath, 'LightningComponentBundleSupportedFormFactor'],
})

const lightningComponentBundleSupportedFormFactorsType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleSupportedFormFactors'),
  fields: {
    supportedFormFactor: {
      refType: new ListType(lightningComponentBundleSupportedFormFactorType),
    },
  },
  annotations: {
    [METADATA_TYPE]: 'LightningComponentBundleSupportedFormFactors',
  },
  path: [...subTypesPath, 'LightningComponentBundleSupportedFormFactors'],
})

const lightningComponentBundleTargetConfigType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleTargetConfig'),
  fields: {
    targets: {
      // SALTO-861: retrieved as string delimited by ',' but is a list
      refType: BuiltinTypes.STRING,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    configurationEditor: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    objects: {
      refType: new ListType(lightningComponentBundleObjectType),
    },
    property: {
      refType: lightningComponentBundlePropertyType,
    },
    supportedFormFactors: {
      refType: lightningComponentBundleSupportedFormFactorsType,
    },
  },
  annotations: {
    [METADATA_TYPE]: 'LightningComponentBundleTargetConfig',
  },
  path: [...subTypesPath, 'LightningComponentBundleTargetConfig'],
})

export const allMissingSubTypes = [
  new ObjectType({
    // taken from https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_configuration_tags
    elemID: new ElemID(SALESFORCE, 'TargetConfigs'),
    fields: {
      targetConfig: {
        refType: new ListType(lightningComponentBundleTargetConfigType),
      },
    },
    annotations: {
      [METADATA_TYPE]: 'TargetConfigs',
    },
    path: [...subTypesPath, 'TargetConfigs'],
  }),
  lightningComponentBundleTargetConfigType,
  lightningComponentBundleObjectType,
  lightningComponentBundlePropertyType,
  lightningComponentBundleSupportedFormFactorsType,
  lightningComponentBundleSupportedFormFactorType,
]

export const ORGANIZATION_OBJECT_TYPE = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'Organization'),
  fields: {
    fullName: {
      refType: BuiltinTypes.STRING,
    },
    DefaultAccountAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultCalendarAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultCampaignAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultCaseAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultContactAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultLeadAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultOpportunityAccess: {
      refType: BuiltinTypes.STRING,
    },
    DefaultPricebookAccess: {
      refType: BuiltinTypes.STRING,
    },
  },
  annotations: {
    // [CORE_ANNOTATIONS.HIDDEN]: true,
    [CORE_ANNOTATIONS.UPDATABLE]: false,
  },
  isSettings: true,
  path: [...subTypesPath, 'Organization'],
})
