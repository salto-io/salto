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
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
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
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is present in customtransactiontype_subliststyle_salesandpurchase.   The default value is F. */
    filterbyaccounttypeall: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the specifyaccountontransaction value is equal to T.   The default value is F. */
    filterbyaccounttype: {
      refType: createRefToElmWithValue(enums.customtransactiontype_filterbyaccounttype),
      annotations: {
      },
    }, /* Original description: This field is available when the specifyaccountontransaction value is equal to T.   This field is available when the filterbyaccounttypeall value is equal to F.   For information about possible values, see customtransactiontype_filterbyaccounttype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})

customtransactiontypeInnerTypes.push(customtransactiontype_accounting)

const customtransactiontype_links_linkElemID = new ElemID(constants.NETSUITE, 'customtransactiontype_links_link')

const customtransactiontype_links_link = new ObjectType({
  elemID: customtransactiontype_links_linkElemID,
  annotations: {
  },
  fields: {
    linkcategory: {
      refType: createRefToElmWithValue(enums.generic_centercategory),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_centercategory. */
    linktasktype: {
      refType: createRefToElmWithValue(enums.customtransactiontype_tasktype),
      annotations: {
      },
    }, /* Original description: For information about possible values, see customtransactiontype_tasktype. */
    linklabel: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
      },
    }, /* Original description: This field accepts references to the string custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})

customtransactiontypeInnerTypes.push(customtransactiontype_links_link)

const customtransactiontype_linksElemID = new ElemID(constants.NETSUITE, 'customtransactiontype_links')

const customtransactiontype_links = new ObjectType({
  elemID: customtransactiontype_linksElemID,
  annotations: {
  },
  fields: {
    link: {
      refType: createRefToElmWithValue(new ListType(customtransactiontype_links_link)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})

customtransactiontypeInnerTypes.push(customtransactiontype_links)

const customtransactiontype_permissions_permissionElemID = new ElemID(constants.NETSUITE, 'customtransactiontype_permissions_permission')

const customtransactiontype_permissions_permission = new ObjectType({
  elemID: customtransactiontype_permissions_permissionElemID,
  annotations: {
  },
  fields: {
    permittedrole: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    permittedlevel: {
      refType: createRefToElmWithValue(enums.generic_permission_level),
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
      refType: createRefToElmWithValue(new ListType(customtransactiontype_permissions_permission)),
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
      refType: createRefToElmWithValue(enums.customtransactiontype_classification_position),
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   For information about possible values, see customtransactiontype_classification_position.   The default value is 'NONE'.   If this field appears in the project, you must reference the CLASSES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CLASSES must be enabled for this field to appear in your account. */
    isclassmandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the classposition value is not equal to NONE.   This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   The default value is F.   If this field appears in the project, you must reference the CLASSES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CLASSES must be enabled for this field to appear in your account. */
    departmentposition: {
      refType: createRefToElmWithValue(enums.customtransactiontype_classification_position),
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   For information about possible values, see customtransactiontype_classification_position.   The default value is 'NONE'.   If this field appears in the project, you must reference the DEPARTMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. DEPARTMENTS must be enabled for this field to appear in your account. */
    isdepartmentmandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the departmentposition value is not equal to NONE.   This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   The default value is F.   If this field appears in the project, you must reference the DEPARTMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. DEPARTMENTS must be enabled for this field to appear in your account. */
    locationposition: {
      refType: createRefToElmWithValue(enums.customtransactiontype_classification_position),
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is not present in customtransactiontype_subliststyle_salesandpurchase.   For information about possible values, see customtransactiontype_classification_position.   The default value is 'NONE'.   If this field appears in the project, you must reference the LOCATIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. LOCATIONS must be enabled for this field to appear in your account. */
    islocationmandatory: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
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
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    description: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 480,
      },
    }, /* Original description: This field value can be up to 480 characters long.   This field accepts references to the string custom type. */
    id: {
      refType: createRefToElmWithValue(enums.customtransactiontype_statuses_id),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see customtransactiontype_statuses_id. */
    isposting: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
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
      refType: createRefToElmWithValue(new ListType(customtransactiontype_statuses_status)),
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
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^(customtransaction|customsale|custompurchase)[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 96,
      },
    }, /* Original description: This field value can be up to 96 characters long.   This field accepts references to the string custom type. */
    subliststyle: {
      refType: createRefToElmWithValue(enums.customtransactiontype_subliststyle),
      annotations: {
      },
    }, /* Original description: This field is mandatory when the transactionstyle value is not defined.   For information about possible values, see customtransactiontype_subliststyle.   The default value is 'BASIC'. */
    transactionstyle: {
      refType: createRefToElmWithValue(enums.customtransactiontype_subliststyle),
      annotations: {
      },
    }, /* Original description: For information about possible values, see customtransactiontype_subliststyle.   The default value is 'BASIC'. */
    iscredit: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: This field is available when the transactionstyle value is present in customtransactiontype_creditsupportstyles.   The default value is F. */
    isposting: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showstatus: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    isvoidable: {
      refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN),
      annotations: {
      },
    }, /* Original description: The default value is F. */
    accounting: {
      refType: createRefToElmWithValue(customtransactiontype_accounting),
      annotations: {
      },
    },
    links: {
      refType: createRefToElmWithValue(customtransactiontype_links),
      annotations: {
      },
    },
    permissions: {
      refType: createRefToElmWithValue(customtransactiontype_permissions),
      annotations: {
      },
    },
    segments: {
      refType: createRefToElmWithValue(customtransactiontype_segments),
      annotations: {
      },
    },
    statuses: {
      refType: createRefToElmWithValue(customtransactiontype_statuses),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customtransactiontypeElemID.name],
})
