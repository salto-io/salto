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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const customsegmentInnerTypes: ObjectType[] = []

const customsegmentElemID = new ElemID(constants.NETSUITE, 'customsegment')
const customsegment_permissions_permissionElemID = new ElemID(constants.NETSUITE, 'customsegment_permissions_permission')

const customsegment_permissions_permission = new ObjectType({
  elemID: customsegment_permissions_permissionElemID,
  annotations: {
  },
  fields: {
    role: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    valuemgmtaccesslevel: {
      type: enums.generic_permission_level,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_permission_level.   The default value is 'NONE'. */
    recordaccesslevel: {
      type: enums.customsegment_access_search_level,
      annotations: {
      },
    }, /* Original description: For information about possible values, see customsegment_access_search_level. */
    searchaccesslevel: {
      type: enums.customsegment_access_search_level,
      annotations: {
      },
    }, /* Original description: For information about possible values, see customsegment_access_search_level. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_permissions_permission)

const customsegment_permissionsElemID = new ElemID(constants.NETSUITE, 'customsegment_permissions')

const customsegment_permissions = new ObjectType({
  elemID: customsegment_permissionsElemID,
  annotations: {
  },
  fields: {
    permission: {
      type: new ListType(customsegment_permissions_permission),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_permissions)

const customsegment_segmentapplication_crm_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_crm_applications_application')

const customsegment_segmentapplication_crm_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_crm_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: {
      type: enums.customsegment_crm_application_id,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see customsegment_crm_application_id. */
    isapplied: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_crm_applications_application)

const customsegment_segmentapplication_crm_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_crm_applications')

const customsegment_segmentapplication_crm_applications = new ObjectType({
  elemID: customsegment_segmentapplication_crm_applicationsElemID,
  annotations: {
  },
  fields: {
    application: {
      type: new ListType(customsegment_segmentapplication_crm_applications_application),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_crm_applications)

const customsegment_segmentapplication_crmElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_crm')

const customsegment_segmentapplication_crm = new ObjectType({
  elemID: customsegment_segmentapplication_crmElemID,
  annotations: {
  },
  fields: {
    sourcelist: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the crmcustomfield custom type.   For information about other possible values, see customsegment_crm_sourcelist. */
    applications: {
      type: customsegment_segmentapplication_crm_applications,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_crm)

const customsegment_segmentapplication_customrecords_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_customrecords_applications_application')

const customsegment_segmentapplication_customrecords_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_customrecords_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the customrecordtype custom type. */
    isapplied: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
    sourcelist: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the isapplied value is equal to T.   This field accepts references to the customrecordcustomfield custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_customrecords_applications_application)

const customsegment_segmentapplication_customrecords_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_customrecords_applications')

const customsegment_segmentapplication_customrecords_applications = new ObjectType({
  elemID: customsegment_segmentapplication_customrecords_applicationsElemID,
  annotations: {
  },
  fields: {
    application: {
      type: new ListType(customsegment_segmentapplication_customrecords_applications_application),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_customrecords_applications)

const customsegment_segmentapplication_customrecordsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_customrecords')

const customsegment_segmentapplication_customrecords = new ObjectType({
  elemID: customsegment_segmentapplication_customrecordsElemID,
  annotations: {
  },
  fields: {
    applications: {
      type: customsegment_segmentapplication_customrecords_applications,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_customrecords)

const customsegment_segmentapplication_entities_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_entities_applications_application')

const customsegment_segmentapplication_entities_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_entities_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: {
      type: enums.customsegment_entities_application_id,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see customsegment_entities_application_id. */
    isapplied: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_entities_applications_application)

const customsegment_segmentapplication_entities_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_entities_applications')

const customsegment_segmentapplication_entities_applications = new ObjectType({
  elemID: customsegment_segmentapplication_entities_applicationsElemID,
  annotations: {
  },
  fields: {
    application: {
      type: new ListType(customsegment_segmentapplication_entities_applications_application),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_entities_applications)

const customsegment_segmentapplication_entitiesElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_entities')

const customsegment_segmentapplication_entities = new ObjectType({
  elemID: customsegment_segmentapplication_entitiesElemID,
  annotations: {
  },
  fields: {
    sourcelist: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the entitycustomfield custom type.   For information about other possible values, see customsegment_entities_sourcelist. */
    applications: {
      type: customsegment_segmentapplication_entities_applications,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_entities)

const customsegment_segmentapplication_items_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_items_applications_application')

const customsegment_segmentapplication_items_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_items_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: {
      type: enums.customsegment_items_application_id,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see customsegment_items_application_id. */
    isapplied: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_items_applications_application)

const customsegment_segmentapplication_items_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_items_applications')

const customsegment_segmentapplication_items_applications = new ObjectType({
  elemID: customsegment_segmentapplication_items_applicationsElemID,
  annotations: {
  },
  fields: {
    application: {
      type: new ListType(customsegment_segmentapplication_items_applications_application),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_items_applications)

const customsegment_segmentapplication_itemsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_items')

const customsegment_segmentapplication_items = new ObjectType({
  elemID: customsegment_segmentapplication_itemsElemID,
  annotations: {
  },
  fields: {
    subtype: {
      type: enums.customsegment_items_subtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see customsegment_items_subtype.   The default value is 'BOTH'. */
    sourcelist: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the itemcustomfield custom type.   For information about other possible values, see customsegment_items_sourcelist. */
    applications: {
      type: customsegment_segmentapplication_items_applications,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_items)

const customsegment_segmentapplication_transactionbody_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionbody_applications_application')

const customsegment_segmentapplication_transactionbody_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_transactionbody_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the customtransactiontype custom type.   For information about other possible values, see customsegment_transactionbody_application_id. */
    isapplied: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionbody_applications_application)

const customsegment_segmentapplication_transactionbody_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionbody_applications')

const customsegment_segmentapplication_transactionbody_applications = new ObjectType({
  elemID: customsegment_segmentapplication_transactionbody_applicationsElemID,
  annotations: {
  },
  fields: {
    application: {
      type: new ListType(customsegment_segmentapplication_transactionbody_applications_application),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionbody_applications)

const customsegment_segmentapplication_transactionbodyElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionbody')

const customsegment_segmentapplication_transactionbody = new ObjectType({
  elemID: customsegment_segmentapplication_transactionbodyElemID,
  annotations: {
  },
  fields: {
    sourcelist: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the transactionbodycustomfield custom type.   For information about other possible values, see customsegment_transactionbody_sourcelist. */
    applications: {
      type: customsegment_segmentapplication_transactionbody_applications,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionbody)

const customsegment_segmentapplication_transactionline_applications_applicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionline_applications_application')

const customsegment_segmentapplication_transactionline_applications_application = new ObjectType({
  elemID: customsegment_segmentapplication_transactionline_applications_applicationElemID,
  annotations: {
  },
  fields: {
    id: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the customtransactiontype custom type.   For information about other possible values, see customsegment_transactionline_application_id. */
    isapplied: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionline_applications_application)

const customsegment_segmentapplication_transactionline_applicationsElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionline_applications')

const customsegment_segmentapplication_transactionline_applications = new ObjectType({
  elemID: customsegment_segmentapplication_transactionline_applicationsElemID,
  annotations: {
  },
  fields: {
    application: {
      type: new ListType(customsegment_segmentapplication_transactionline_applications_application),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionline_applications)

const customsegment_segmentapplication_transactionlineElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication_transactionline')

const customsegment_segmentapplication_transactionline = new ObjectType({
  elemID: customsegment_segmentapplication_transactionlineElemID,
  annotations: {
  },
  fields: {
    sourcelist: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   For information about other possible values, see customsegment_transactionline_sourcelist. */
    applications: {
      type: customsegment_segmentapplication_transactionline_applications,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication_transactionline)

const customsegment_segmentapplicationElemID = new ElemID(constants.NETSUITE, 'customsegment_segmentapplication')

const customsegment_segmentapplication = new ObjectType({
  elemID: customsegment_segmentapplicationElemID,
  annotations: {
  },
  fields: {
    crm: {
      type: customsegment_segmentapplication_crm,
      annotations: {
      },
    },
    customrecords: {
      type: customsegment_segmentapplication_customrecords,
      annotations: {
      },
    },
    entities: {
      type: customsegment_segmentapplication_entities,
      annotations: {
      },
    },
    items: {
      type: customsegment_segmentapplication_items,
      annotations: {
      },
    },
    transactionbody: {
      type: customsegment_segmentapplication_transactionbody,
      annotations: {
      },
    },
    transactionline: {
      type: customsegment_segmentapplication_transactionline,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})

customsegmentInnerTypes.push(customsegment_segmentapplication)


export const customsegment = new ObjectType({
  elemID: customsegmentElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'cseg_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 19 characters long.   The default value is ‘cseg’. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    recordtype: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the customrecordtype custom type. */
    filteredby: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the customsegment custom type.   For information about other possible values, see customsegment_parent. */
    fieldtype: {
      type: enums.customsegment_fieldtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see customsegment_fieldtype. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    help: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    hasglimpact: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    defaultselection: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the fieldtype value is not equal to MULTISELECT.   This field accepts references to the instance custom type. */
    defaultrecordaccesslevel: {
      type: enums.customsegment_access_search_level,
      annotations: {
      },
    }, /* Original description: For information about possible values, see customsegment_access_search_level. */
    defaultsearchaccesslevel: {
      type: enums.customsegment_access_search_level,
      annotations: {
      },
    }, /* Original description: For information about possible values, see customsegment_access_search_level. */
    valuesdisplayorder: {
      type: enums.customsegment_valuesdisplayorder,
      annotations: {
      },
    }, /* Original description: For information about possible values, see customsegment_valuesdisplayorder. */
    permissions: {
      type: customsegment_permissions,
      annotations: {
      },
    },
    segmentapplication: {
      type: customsegment_segmentapplication,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customsegmentElemID.name],
})
