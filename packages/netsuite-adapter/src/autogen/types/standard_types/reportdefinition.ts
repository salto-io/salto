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
/* eslint-disable max-len */
/* eslint-disable camelcase */
import {
  BuiltinTypes,
  createRefToElmWithValue,
  CORE_ANNOTATIONS,
  ElemID,
  ObjectType,
  createRestriction,
} from '@salto-io/adapter-api'
import * as constants from '../../../constants'
import { TypeAndInnerTypes } from '../../../types/object_types'

export const reportdefinitionType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const reportdefinitionElemID = new ElemID(constants.NETSUITE, 'reportdefinition')
  const reportdefinition_accessaudienceElemID = new ElemID(constants.NETSUITE, 'reportdefinition_accessaudience')

  const reportdefinition_accessaudience = new ObjectType({
    elemID: reportdefinition_accessaudienceElemID,
    annotations: {},
    fields: {
      allcustomers: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allemployees: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allpartners: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allroles: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allvendors: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      audslctrole: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
        annotations: {},
      } /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportdefinitionElemID.name],
  })

  innerTypes.reportdefinition_accessaudience = reportdefinition_accessaudience

  const reportdefinition_audienceElemID = new ElemID(constants.NETSUITE, 'reportdefinition_audience')

  const reportdefinition_audience = new ObjectType({
    elemID: reportdefinition_audienceElemID,
    annotations: {},
    fields: {
      allcustomers: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allemployees: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allpartners: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allroles: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      allvendors: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      audslctrole: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was multi-select list */),
        annotations: {},
      } /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportdefinitionElemID.name],
  })

  innerTypes.reportdefinition_audience = reportdefinition_audience

  const reportdefinition_dependenciesElemID = new ElemID(constants.NETSUITE, 'reportdefinition_dependencies')

  const reportdefinition_dependencies = new ObjectType({
    elemID: reportdefinition_dependenciesElemID,
    annotations: {},
    fields: {
      dependency: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field only accepts references to any custom type. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportdefinitionElemID.name],
  })

  innerTypes.reportdefinition_dependencies = reportdefinition_dependencies

  const reportdefinition = new ObjectType({
    elemID: reportdefinitionElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customreport[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customreport’. */,
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      definition: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      },
      accessaudience: {
        refType: createRefToElmWithValue(reportdefinition_accessaudience),
        annotations: {},
      },
      audience: {
        refType: createRefToElmWithValue(reportdefinition_audience),
        annotations: {},
      },
      dependencies: {
        refType: createRefToElmWithValue(reportdefinition_dependencies),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, reportdefinitionElemID.name],
  })

  return { type: reportdefinition, innerTypes }
}
