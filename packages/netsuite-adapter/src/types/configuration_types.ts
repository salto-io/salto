/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
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
