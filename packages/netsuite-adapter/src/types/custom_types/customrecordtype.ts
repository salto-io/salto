/*
*                      Copyright 2021 Salto Labs Ltd.
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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
} from '@salto-io/adapter-api'
import * as constants from '../../constants'
import { enums } from '../enums'

export const customrecordtypeInnerTypes: ObjectType[] = []

const customrecordtypeElemID = new ElemID(constants.NETSUITE, 'customrecordtype')
const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfiltercomparetype: {
      refType: enums.generic_customfield_fldfiltercomparetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    fldfilternotnull: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfilternull: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldcomparefield: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter)

const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: {
      refType: new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters)

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: {
    role: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess)

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: {
      refType: new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses)

const customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield')

const customrecordtype_customrecordcustomfields_customrecordcustomfield = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custrecord’. */
    fieldtype: {
      refType: enums.generic_customfield_fieldtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 200 }),
      },
    }, /* Original description: This field value can be up to 200 characters long.   This field accepts references to the string custom type. */
    selectrecordtype: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    defaultchecked: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    defaultselection: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    description: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    displaytype: {
      refType: enums.generic_customfield_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: {
      refType: enums.generic_customfield_dynamicdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the string custom type. */
    linktext: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    minvalue: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    maxvalue: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    storevalue: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    accesslevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    encryptatrest: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayheight: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: {
      refType: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    globalsearch: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    isformula: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismandatory: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    maxlength: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    onparentdelete: {
      refType: enums.generic_customfield_onparentdelete,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: {
      refType: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: {
      refType: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    showinlist: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    sourcefilterby: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customrecordcustomfield custom type.   For information about other possible values, see generic_standard_field. */
    sourcefrom: {
      refType: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    sourcelist: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customrecordcustomfield custom type.   For information about other possible values, see generic_standard_field. */
    isparent: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    parentsubtab: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see generic_tab_parent. */
    subtab: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type. */
    allowquickadd: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    rolerestrict: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    customfieldfilters: {
      refType: customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters,
      annotations: {
      },
    },
    roleaccesses: {
      refType: customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield)

const customrecordtype_customrecordcustomfieldsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields')

const customrecordtype_customrecordcustomfields = new ObjectType({
  elemID: customrecordtype_customrecordcustomfieldsElemID,
  annotations: {
  },
  fields: {
    customrecordcustomfield: {
      refType: new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields)

const customrecordtype_instances_instanceElemID = new ElemID(constants.NETSUITE, 'customrecordtype_instances_instance')

const customrecordtype_instances_instance = new ObjectType({
  elemID: customrecordtype_instances_instanceElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    altname: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the includename value is equal to T.   This field is available when the enablenumbering value is equal to T.   This field is mandatory when the includename value is equal to T.   This field is mandatory when the enablenumbering value is equal to T. */
    name: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the includename value is equal to T.   This field is available when the enablenumbering value is equal to F.   This field is mandatory when the includename value is equal to T.   This field is mandatory when the enablenumbering value is equal to F. */
    isinactive: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    parent: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the hierarchical value is equal to T.   This field accepts references to the instance custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_instances_instance)

const customrecordtype_instancesElemID = new ElemID(constants.NETSUITE, 'customrecordtype_instances')

const customrecordtype_instances = new ObjectType({
  elemID: customrecordtype_instancesElemID,
  annotations: {
  },
  fields: {
    instance: {
      refType: new ListType(customrecordtype_instances_instance),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_instances)

const customrecordtype_links_linkElemID = new ElemID(constants.NETSUITE, 'customrecordtype_links_link')

const customrecordtype_links_link = new ObjectType({
  elemID: customrecordtype_links_linkElemID,
  annotations: {
  },
  fields: {
    linkcategory: {
      refType: enums.generic_centercategory,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_centercategory. */
    linktasktype: {
      refType: enums.customrecordtype_tasktype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see customrecordtype_tasktype. */
    linklabel: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the string custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_links_link)

const customrecordtype_linksElemID = new ElemID(constants.NETSUITE, 'customrecordtype_links')

const customrecordtype_links = new ObjectType({
  elemID: customrecordtype_linksElemID,
  annotations: {
  },
  fields: {
    link: {
      refType: new ListType(customrecordtype_links_link),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_links)

const customrecordtype_permissions_permissionElemID = new ElemID(constants.NETSUITE, 'customrecordtype_permissions_permission')

export const customrecordtype_permissions_permission = new ObjectType({
  elemID: customrecordtype_permissions_permissionElemID,
  annotations: {
  },
  fields: {
    permittedrole: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    permittedlevel: {
      refType: enums.generic_permission_level,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_permission_level.   The default value is 'NONE'. */
    restriction: {
      refType: enums.role_restrict,
      annotations: {
      },
    }, /* Original description: For information about possible values, see role_restrict. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_permissions_permission)

const customrecordtype_permissionsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_permissions')

const customrecordtype_permissions = new ObjectType({
  elemID: customrecordtype_permissionsElemID,
  annotations: {
  },
  fields: {
    permission: {
      refType: new ListType(customrecordtype_permissions_permission),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_permissions)

const customrecordtype_recordsublists_recordsublistElemID = new ElemID(constants.NETSUITE, 'customrecordtype_recordsublists_recordsublist')

const customrecordtype_recordsublists_recordsublist = new ObjectType({
  elemID: customrecordtype_recordsublists_recordsublistElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    recordsearch: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    recorddescr: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    recordtab: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type. */
    recordfield: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customrecordcustomfield custom type.   For information about other possible values, see generic_standard_field. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_recordsublists_recordsublist)

const customrecordtype_recordsublistsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_recordsublists')

const customrecordtype_recordsublists = new ObjectType({
  elemID: customrecordtype_recordsublistsElemID,
  annotations: {
  },
  fields: {
    recordsublist: {
      refType: new ListType(customrecordtype_recordsublists_recordsublist),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_recordsublists)

const customrecordtype_subtabs_subtabElemID = new ElemID(constants.NETSUITE, 'customrecordtype_subtabs_subtab')

const customrecordtype_subtabs_subtab = new ObjectType({
  elemID: customrecordtype_subtabs_subtabElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    tabtitle: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    tabparent: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_subtabs_subtab)

const customrecordtype_subtabsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_subtabs')

const customrecordtype_subtabs = new ObjectType({
  elemID: customrecordtype_subtabsElemID,
  annotations: {
  },
  fields: {
    subtab: {
      refType: new ListType(customrecordtype_subtabs_subtab),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_subtabs)


export const customrecordtype = new ObjectType({
  elemID: customrecordtypeElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customrecord[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customrecord’. */
    recordname: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 40 }),
      },
    }, /* Original description: This field value can be up to 40 characters long.   This field is available when the customsegment value is equal to   This field is mandatory when the customsegment value is equal to   This field accepts references to the string custom type. */
    customsegment: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customsegment custom type.   If this field appears in the project, you must reference the CUSTOMSEGMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CUSTOMSEGMENTS must be enabled for this field to appear in your account. */
    accesstype: {
      refType: enums.customrecordtype_accesstype,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   For information about possible values, see customrecordtype_accesstype.   The default value is 'CUSTRECORDENTRYPERM'. */
    allowattachments: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    allowinlineediting: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allowinlinedeleting: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allowinlinedetaching: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allowmobileaccess: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    allownumberingoverride: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    allowquickadd: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    allowquicksearch: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allowuiaccess: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is T. */
    description: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    enabledle: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T.   If this field appears in the project, you must reference the EXTREMELIST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXTREMELIST must be enabled for this field to appear in your account. */
    enablekeywords: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    enablemailmerge: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the MAILMERGE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MAILMERGE must be enabled for this field to appear in your account. */
    enablenametranslation: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F.   If this field appears in the project, you must reference the MULTILANGUAGE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MULTILANGUAGE must be enabled for this field to appear in your account. */
    enablenumbering: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    enableoptimisticlocking: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    enablesystemnotes: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    hierarchical: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    numberingprefix: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    numberingsuffix: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    numberingmindigits: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    numberinginit: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    icon: {
      refType: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
      },
    },
    iconbuiltin: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    iconindex: {
      refType: enums.generic_custom_record_icon,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_custom_record_icon. */
    includeinsearchmenu: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    includename: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is T. */
    isinactive: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    isordered: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    showcreationdate: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showcreationdateonlist: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showid: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    showlastmodified: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showlastmodifiedonlist: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    shownotes: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showowner: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showownerallowchange: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showowneronlist: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    customrecordcustomfields: {
      refType: customrecordtype_customrecordcustomfields,
      annotations: {
      },
    },
    instances: {
      refType: customrecordtype_instances,
      annotations: {
      },
    },
    links: {
      refType: customrecordtype_links,
      annotations: {
      },
    },
    permissions: {
      refType: customrecordtype_permissions,
      annotations: {
      },
    },
    recordsublists: {
      refType: customrecordtype_recordsublists,
      annotations: {
      },
    },
    subtabs: {
      refType: customrecordtype_subtabs,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})
