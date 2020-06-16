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
/* eslint-disable max-len */
/* eslint-disable @typescript-eslint/camelcase */
import {
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const customtransactiontypeInnerTypes: ObjectType[] = []

const customtransactiontypeElemID = new ElemID(constants.NETSUITE, 'customtransactiontype')
const customtransactiontype_accountingElemID = new ElemID(constants.NETSUITE, 'customtransactiontype_accounting')

const customtransactiontype_accounting = new ObjectType({
  elemID: customtransactiontype_accountingElemID,
  annotations: {
  },
  fields: {
    specifyaccountontransaction: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is present in customtransactiontype_subliststyle_salesandpurchase.   The default value is F. */
    filterbyaccounttypeall: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the specifyaccountontransaction value is equal to T.   The default value is F. */
    filterbyaccounttype: {
      type: enums.customtransactiontype_filterbyaccounttype,
      annotations: {
      },
    }, /* Original description: This field is available when the specifyaccountontransaction value is equal to T.   This field is available when the filterbyaccounttypeall value is equal to F.   For information about possible values, see customtransactiontype_filterbyaccounttype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})

customtransactiontypeInnerTypes.push(customtransactiontype_accounting)

const customtransactiontype_permissions_permissionElemID = new ElemID(constants.NETSUITE, 'customtransactiontype_permissions_permission')

const customtransactiontype_permissions_permission = new ObjectType({
  elemID: customtransactiontype_permissions_permissionElemID,
  annotations: {
  },
  fields: {
    permittedrole: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    permittedlevel: {
      type: enums.generic_permission_level,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_permission_level.   The default value is 'NONE'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})

customtransactiontypeInnerTypes.push(customtransactiontype_permissions_permission)

const customtransactiontype_permissionsElemID = new ElemID(constants.NETSUITE, 'customtransactiontype_permissions')

const customtransactiontype_permissions = new ObjectType({
  elemID: customtransactiontype_permissionsElemID,
  annotations: {
  },
  fields: {
    permission: {
      type: new ListType(customtransactiontype_permissions_permission),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})

customtransactiontypeInnerTypes.push(customtransactiontype_permissions)

const customtransactiontype_segmentsElemID = new ElemID(constants.NETSUITE, 'customtransactiontype_segments')

const customtransactiontype_segments = new ObjectType({
  elemID: customtransactiontype_segmentsElemID,
  annotations: {
  },
  fields: {
    classposition: {
      type: enums.customtransactiontype_classification_position,
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   For information about possible values, see customtransactiontype_classification_position.   The default value is 'NONE'.   If this field appears in the project, you must reference the CLASSES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CLASSES must be enabled for this field to appear in your account. */
    isclassmandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the classposition value is not equal to NONE.   This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   The default value is F.   If this field appears in the project, you must reference the CLASSES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CLASSES must be enabled for this field to appear in your account. */
    departmentposition: {
      type: enums.customtransactiontype_classification_position,
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   For information about possible values, see customtransactiontype_classification_position.   The default value is 'NONE'.   If this field appears in the project, you must reference the DEPARTMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. DEPARTMENTS must be enabled for this field to appear in your account. */
    isdepartmentmandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the departmentposition value is not equal to NONE.   This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   The default value is F.   If this field appears in the project, you must reference the DEPARTMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. DEPARTMENTS must be enabled for this field to appear in your account. */
    locationposition: {
      type: enums.customtransactiontype_classification_position,
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   For information about possible values, see customtransactiontype_classification_position.   The default value is 'NONE'.   If this field appears in the project, you must reference the LOCATIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. LOCATIONS must be enabled for this field to appear in your account. */
    islocationmandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the locationposition value is not equal to NONE.   This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   The default value is F.   If this field appears in the project, you must reference the LOCATIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. LOCATIONS must be enabled for this field to appear in your account. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})

customtransactiontypeInnerTypes.push(customtransactiontype_segments)

const customtransactiontype_statuses_statusElemID = new ElemID(constants.NETSUITE, 'customtransactiontype_statuses_status')

const customtransactiontype_statuses_status = new ObjectType({
  elemID: customtransactiontype_statuses_statusElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 480,
      },
    }, /* Original description: This field value can be up to 480 characters long. */
    id: {
      type: enums.customtransactiontype_statuses_id,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see customtransactiontype_statuses_id. */
    isposting: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})

customtransactiontypeInnerTypes.push(customtransactiontype_statuses_status)

const customtransactiontype_statusesElemID = new ElemID(constants.NETSUITE, 'customtransactiontype_statuses')

const customtransactiontype_statuses = new ObjectType({
  elemID: customtransactiontype_statusesElemID,
  annotations: {
  },
  fields: {
    status: {
      type: new ListType(customtransactiontype_statuses_status),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})

customtransactiontypeInnerTypes.push(customtransactiontype_statuses)


export const customtransactiontype = new ObjectType({
  elemID: customtransactiontypeElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^(customtransaction|customsale|custompurchase)[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 96,
      },
    }, /* Original description: This field value can be up to 96 characters long. */
    subliststyle: {
      type: enums.customtransactiontype_subliststyle,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the transactionstyle value is not defined.   For information about possible values, see customtransactiontype_subliststyle.   The default value is 'BASIC'. */
    transactionstyle: {
      type: enums.customtransactiontype_subliststyle,
      annotations: {
      },
    }, /* Original description: For information about possible values, see customtransactiontype_subliststyle.   The default value is 'BASIC'. */
    iscredit: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is present in customtransactiontype_creditsupportstyles.   The default value is F. */
    isposting: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showstatus: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    isvoidable: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    accounting: {
      type: customtransactiontype_accounting,
      annotations: {
      },
    },
    permissions: {
      type: customtransactiontype_permissions,
      annotations: {
      },
    },
    segments: {
      type: customtransactiontype_segments,
      annotations: {
      },
    },
    statuses: {
      type: customtransactiontype_statuses,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})
