/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { SALESFORCE, SUBTYPES_PATH, TYPES_PATH, IS_ATTRIBUTE, METADATA_TYPE } from '../constants'

const subTypesPath = [SALESFORCE, TYPES_PATH, SUBTYPES_PATH]

const lightningComponentBundleObjectType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleObject'),
  fields: {
    object: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
  },
  path: [...subTypesPath, 'LightningComponentBundleObject'],
})

const lightningComponentBundlePropertyType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleProperty'),
  fields: {
    datasource: {
      // SALTO-861: retrieved as string delimited by ',' but is a list
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    default: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    description: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    label: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    max: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    min: {
      refType: createRefToElmWithValue(BuiltinTypes.NUMBER),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [IS_ATTRIBUTE]: true,
      },
    },
    placeholder: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    required: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    role: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    type: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
          values: ['Boolean', 'Integer', 'String', 'Color', 'Date', 'DateTime'],
          // eslint-disable-next-line @typescript-eslint/camelcase
          enforce_value: false,
        }),
      },
    },
  },
  path: [...subTypesPath, 'LightningComponentBundleProperty'],
})

const lightningComponentBundleSupportedFormFactorType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleSupportedFormFactor'),
  fields: {
    type: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ values: ['Small', 'Large'] }),
        [IS_ATTRIBUTE]: true,
      },
    },
  },
  path: [...subTypesPath, 'LightningComponentBundleSupportedFormFactor'],
})

const lightningComponentBundleSupportedFormFactorsType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleSupportedFormFactors'),
  fields: {
    supportedFormFactor: {
      refType: createRefToElmWithValue(
        new ListType(lightningComponentBundleSupportedFormFactorType)
      ),
    },
  },
  path: [...subTypesPath, 'LightningComponentBundleSupportedFormFactors'],
})

const lightningComponentBundleTargetConfigType = new ObjectType({
  elemID: new ElemID(SALESFORCE, 'LightningComponentBundleTargetConfig'),
  fields: {
    targets: {
      // SALTO-861: retrieved as string delimited by ',' but is a list
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    configurationEditor: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [IS_ATTRIBUTE]: true,
      },
    },
    objects: {
      refType: createRefToElmWithValue(new ListType(lightningComponentBundleObjectType)),
    },
    property: {
      refType: createRefToElmWithValue(lightningComponentBundlePropertyType),
    },
    supportedFormFactors: {
      refType: createRefToElmWithValue(lightningComponentBundleSupportedFormFactorsType),
    },
  },
  path: [...subTypesPath, 'LightningComponentBundleTargetConfig'],
})

export const allMissingSubTypes = [
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'BusinessHoursEntry'),
    fields: {
      timeZoneId: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      name: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      default: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      mondayStartTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      mondayEndTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      tuesdayStartTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      tuesdayEndTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      wednesdayStartTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      wednesdayEndTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      thursdayStartTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      thursdayEndTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      fridayStartTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      fridayEndTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      saturdayStartTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      saturdayEndTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      sundayStartTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      sundayEndTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    },
    annotations: {
      [METADATA_TYPE]: 'BusinessHoursEntry',
    },
    path: [...subTypesPath, 'BusinessHoursEntry'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'Holidays'),
    fields: {
      name: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      description: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      activityDate: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      recurrenceStartDate: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      recurrenceEndDate: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      startTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      endTime: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      recurrenceType: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      recurrenceInterval: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      recurrenceDayOfWeek: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      recurrenceDayOfMonth: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      recurrenceInstance: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      recurrenceMonthOfYear: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      businessHours: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    },
    annotations: {
      [METADATA_TYPE]: 'Holidays',
    },
    path: [...subTypesPath, 'Holidays'],
  }),
  new ObjectType({
    elemID: new ElemID(SALESFORCE, 'OrganizationSettingsDetail'),
    fields: {
      settingName: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      settingValue: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
    },
    path: [...subTypesPath, 'OrganizationSettingsDetail'],
  }),
  new ObjectType({
    // taken from https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_configuration_tags
    elemID: new ElemID(SALESFORCE, 'TargetConfigs'),
    fields: {
      targetConfig: {
        refType: createRefToElmWithValue(new ListType(lightningComponentBundleTargetConfigType)),
      },
    },
    path: [...subTypesPath, 'TargetConfigs'],
  }),
  lightningComponentBundleTargetConfigType,
  lightningComponentBundleObjectType,
  lightningComponentBundlePropertyType,
  lightningComponentBundleSupportedFormFactorsType,
  lightningComponentBundleSupportedFormFactorType,
]
