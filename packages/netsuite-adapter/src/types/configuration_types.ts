/*
*                      Copyright 2022 Salto Labs Ltd.
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
/* eslint-disable camelcase */
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRefToElmWithValue, MapType, createRestriction } from '@salto-io/adapter-api'
import * as constants from '../constants'

export const featuresType = (): Record<string, ObjectType> => {
  const featuresElemID = new ElemID(constants.NETSUITE, 'accountFeatures')
  const features_featureElemID = new ElemID(constants.NETSUITE, 'accountFeatures_feature')
  const accountFeatures_feature = new ObjectType({
    elemID: features_featureElemID,
    annotations: {
    },
    fields: {
      label: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
        },
      },
      id: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      status: {
        refType: BuiltinTypes.STRING,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({
            values: constants.ACCOUNT_FEATURES_VALID_STATUS_VALUES,
          }),
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, featuresElemID.name],
  })
  const accountFeatures = new ObjectType({
    elemID: featuresElemID,
    annotations: {
    },
    fields: {
      features: {
        refType: createRefToElmWithValue(new MapType(accountFeatures_feature)),
        annotations: {
        },
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, featuresElemID.name],
    isSettings: true,
  })
  return { accountFeatures, accountFeatures_feature }
}

export const getConfigurationTypes = (): Readonly<Record<string, ObjectType>> => ({
  ...featuresType(),
})
