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
/* eslint-disable camelcase */
import { BuiltinTypes, ElemID, ObjectType, ListType } from '@salto-io/adapter-api'
import * as constants from '../constants'

export type ConfigurationTypeName = typeof constants.CONFIG_FEATURES

export const featuresType = (): ObjectType =>
  new ObjectType({
    elemID: new ElemID(constants.NETSUITE, constants.CONFIG_FEATURES),
    fields: {
      feature: {
        refType: new ListType(
          new ObjectType({
            elemID: new ElemID(constants.NETSUITE, `${constants.CONFIG_FEATURES}_feature`),
            fields: {
              label: { refType: BuiltinTypes.STRING },
              id: { refType: BuiltinTypes.STRING },
              status: { refType: BuiltinTypes.STRING },
            },
          }),
        ),
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, constants.CONFIG_FEATURES],
    isSettings: true,
  })

export const getConfigurationTypes = (): Readonly<Record<ConfigurationTypeName, ObjectType>> => ({
  companyFeatures: featuresType(),
})
