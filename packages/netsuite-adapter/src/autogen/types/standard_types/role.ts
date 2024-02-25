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
  ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../../constants'
import { TypeAndInnerTypes } from '../../../types/object_types'
import { enums } from '../enums'

export const roleType = (): TypeAndInnerTypes => {
  const innerTypes: Record<string, ObjectType> = {}

  const roleElemID = new ElemID(constants.NETSUITE, 'role')
  const role_permissions_permissionElemID = new ElemID(constants.NETSUITE, 'role_permissions_permission')

  const role_permissions_permission = new ObjectType({
    elemID: role_permissions_permissionElemID,
    annotations: {},
    fields: {
      permkey: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field accepts references to the following custom types:   customtransactiontype   customsegment   customrecordtype   For information about other possible values, see generic_permission. */,
      permlevel: {
        refType: createRefToElmWithValue(enums.generic_permission_level),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: For information about possible values, see generic_permission_level. */,
      restriction: {
        refType: createRefToElmWithValue(enums.role_restrict),
        annotations: {},
      } /* Original description: For information about possible values, see role_restrict. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, roleElemID.name],
  })

  innerTypes.role_permissions_permission = role_permissions_permission

  const role_permissionsElemID = new ElemID(constants.NETSUITE, 'role_permissions')

  const role_permissions = new ObjectType({
    elemID: role_permissionsElemID,
    annotations: {},
    fields: {
      permission: {
        refType: createRefToElmWithValue(new ListType(role_permissions_permission)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, roleElemID.name],
  })

  innerTypes.role_permissions = role_permissions

  const role_recordrestrictions_recordrestrictionElemID = new ElemID(
    constants.NETSUITE,
    'role_recordrestrictions_recordrestriction',
  )

  const role_recordrestrictions_recordrestriction = new ObjectType({
    elemID: role_recordrestrictions_recordrestrictionElemID,
    annotations: {},
    fields: {
      segment: {
        refType: createRefToElmWithValue(enums.role_restrictionsegment),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: For information about possible values, see role_restrictionsegment. */,
      restriction: {
        refType: createRefToElmWithValue(enums.role_restrictions),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: For information about possible values, see role_restrictions. */,
      viewingallowed: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: This field is available when the restriction value is not equal to DEFAULTTOOWN.   The default value is F. */,
      itemsrestricted: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: This field is available when the restriction value is not equal to DEFAULTTOOWN.   The default value is F. */,
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, roleElemID.name],
  })

  innerTypes.role_recordrestrictions_recordrestriction = role_recordrestrictions_recordrestriction

  const role_recordrestrictionsElemID = new ElemID(constants.NETSUITE, 'role_recordrestrictions')

  const role_recordrestrictions = new ObjectType({
    elemID: role_recordrestrictionsElemID,
    annotations: {},
    fields: {
      recordrestriction: {
        refType: createRefToElmWithValue(new ListType(role_recordrestrictions_recordrestriction)),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, roleElemID.name],
  })

  innerTypes.role_recordrestrictions = role_recordrestrictions

  const role = new ObjectType({
    elemID: roleElemID,
    annotations: {},
    fields: {
      scriptid: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [constants.IS_ATTRIBUTE]: true,
          [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customrole[0-9a-z_]+' }),
        },
      } /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customrole’. */,
      centertype: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field accepts references to the center custom type.   For information about other possible values, see role_centertype. */,
      name: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
        },
      } /* Original description: This field accepts references to the string custom type. */,
      tfaduration: {
        refType: createRefToElmWithValue(enums.tfaduration),
        annotations: {},
      } /* Original description: This field is mandatory when the tfarequired value is not equal to OFF.   For information about possible values, see tfaduration.   The default value is '0'. */,
      coreadminpermission: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: For more information about the Core Administration Permission feature, see Core Administration Permissions.   The default value is F. */,
      employeerestriction: {
        refType: createRefToElmWithValue(enums.role_fullrestrictions),
        annotations: {},
      } /* Original description: For information about possible values, see role_fullrestrictions. */,
      employeeviewingallowed: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: This field is available when the employeerestriction value is not equal to any of the following lists or values: DEFAULTTOOWN, NONE.   The default value is F. */,
      ispartnerrole: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      issalesrole: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      issupportrole: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      issuerole: {
        refType: createRefToElmWithValue(BuiltinTypes.STRING),
        annotations: {},
      } /* Original description: If this field appears in the project, you must reference the ISSUEDB feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ISSUEDB must be enabled for this field to appear in your account. */,
      restricttimeandexpenses: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      employeeselectionunrestricted: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      isinactive: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      subsidiaryviewingallowed: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F.   If this field appears in the project, you must reference the SUBSIDIARIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUBSIDIARIES must be enabled for this field to appear in your account. */,
      subsidiaryoption: {
        refType: createRefToElmWithValue(enums.rolesubsidiaryoption),
        annotations: {},
      } /* Original description: For information about possible values, see rolesubsidiaryoption.   The default value is 'ALL'.   If this field appears in the project, you must reference the SUBSIDIARIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUBSIDIARIES must be enabled for this field to appear in your account. */,
      accountingbooksoption: {
        refType: createRefToElmWithValue(enums.roleaccountingbooksoption),
        annotations: {},
      } /* Original description: For information about possible values, see roleaccountingbooksoption.   The default value is 'PRIMARY'.   If this field appears in the project, you must reference the MULTIBOOK feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MULTIBOOK must be enabled for this field to appear in your account. */,
      issinglesignononly: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      iswebserviceonlyrole: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F.   If this field appears in the project, you must reference the WEBSERVICES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WEBSERVICES must be enabled for this field to appear in your account. */,
      restrictbydevice: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F. */,
      restrictip: {
        refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
        annotations: {},
      } /* Original description: The default value is F.   If this field appears in the project, you must reference the IPADDRESSRULES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. IPADDRESSRULES must be enabled for this field to appear in your account. */,
      tfarequired: {
        refType: createRefToElmWithValue(enums.tfarequired),
        annotations: {},
      } /* Original description: For information about possible values, see tfarequired.   The default value is 'OFF'. */,
      permissions: {
        refType: createRefToElmWithValue(role_permissions),
        annotations: {},
      },
      recordrestrictions: {
        refType: createRefToElmWithValue(role_recordrestrictions),
        annotations: {},
      },
    },
    path: [constants.NETSUITE, constants.TYPES_PATH, roleElemID.name],
  })

  return { type: role, innerTypes }
}
