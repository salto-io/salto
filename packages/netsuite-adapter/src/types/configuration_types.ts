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
import { BuiltinTypes, ElemID, ObjectType, ListType } from '@salto-io/adapter-api'
import * as constants from '../constants'

type FeatureTypeName = typeof constants.CONFIG_FEATURES
  | typeof constants.CONFIG_FEATURES_INNER_FEATURE

export const featuresType = (): Record<FeatureTypeName, ObjectType> => {
  const featuresElemID = new ElemID(constants.NETSUITE, constants.CONFIG_FEATURES)
  const features_featureElemID = new ElemID(constants.NETSUITE, `${constants.CONFIG_FEATURES}_feature`)
  const companyFeatures_feature = new ObjectType({
    elemID: features_featureElemID,
    fields: {
      label: { refType: BuiltinTypes.STRING },
      id: { refType: BuiltinTypes.STRING },
      status: { refType: BuiltinTypes.STRING },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, featuresElemID.name],
  })
  const companyFeatures = new ObjectType({
    elemID: featuresElemID,
    fields: {
      feature: {
        refType: new ListType(companyFeatures_feature),
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, featuresElemID.name],
    isSettings: true,
  })
  return { companyFeatures, companyFeatures_feature }
}

export const getConfigurationTypes = (): Readonly<Record<string, ObjectType>> => ({
  ...featuresType(),
})
