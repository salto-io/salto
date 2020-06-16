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

export const customrecordtypeInnerTypes: ObjectType[] = []

const customrecordtypeElemID = new ElemID(constants.NETSUITE, 'customrecordtype')
const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilterElemID,
  annotations: {
  },
  fields: {
    fldfilter: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    fldfilterchecked: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfiltercomparetype: {
      type: enums.generic_customfield_fldfiltercomparetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    fldfiltersel: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    fldfilterval: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    fldfilternotnull: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldfilternull: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fldcomparefield: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
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
      type: new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter),
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
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    accesslevel: {
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    searchlevel: {
      type: enums.generic_accesslevel_searchlevel,
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
      type: new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess),
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
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custrecord’. */
    fieldtype: {
      type: enums.generic_customfield_fieldtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long. */
    selectrecordtype: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    applyformatting: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    defaultchecked: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    defaultselection: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    defaultvalue: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    displaytype: {
      type: enums.generic_customfield_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    dynamicdefault: {
      type: enums.generic_customfield_dynamicdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    help: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    linktext: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    minvalue: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    maxvalue: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    storevalue: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    accesslevel: {
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    checkspelling: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    encryptatrest: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    displayheight: {
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    displaywidth: {
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    globalsearch: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    isformula: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ismandatory: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    maxlength: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    onparentdelete: {
      type: enums.generic_customfield_onparentdelete,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    searchcomparefield: {
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    searchdefault: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    searchlevel: {
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    showinlist: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    sourcefilterby: {
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    sourcefrom: {
      type: BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    sourcelist: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customrecordcustomfield custom type.   For information about other possible values, see generic_standard_field. */
    isparent: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    parentsubtab: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see generic_tab_parent. */
    subtab: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type. */
    allowquickadd: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    rolerestrict: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    customfieldfilters: {
      type: customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters,
      annotations: {
      },
    },
    roleaccesses: {
      type: customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses,
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
      type: new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield),
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
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    altname: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the includename value is equal to T.   This field is available when the enablenumbering value is equal to T.   This field is mandatory when the includename value is equal to T.   This field is mandatory when the enablenumbering value is equal to T. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the includename value is equal to T.   This field is available when the enablenumbering value is equal to F.   This field is mandatory when the includename value is equal to T.   This field is mandatory when the enablenumbering value is equal to F. */
    isinactive: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    parent: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
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
      type: new ListType(customrecordtype_instances_instance),
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
      type: enums.generic_centercategory,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_centercategory. */
    linktasktype: {
      type: enums.customrecordtype_tasktype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see customrecordtype_tasktype. */
    linklabel: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
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
      type: new ListType(customrecordtype_links_link),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_links)

const customrecordtype_permissions_permissionElemID = new ElemID(constants.NETSUITE, 'customrecordtype_permissions_permission')

const customrecordtype_permissions_permission = new ObjectType({
  elemID: customrecordtype_permissions_permissionElemID,
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
    restriction: {
      type: enums.role_restrict,
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
      type: new ListType(customrecordtype_permissions_permission),
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
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    recordsearch: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    recorddescr: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    recordtab: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type. */
    recordfield: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
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
      type: new ListType(customrecordtype_recordsublists_recordsublist),
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
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    tabtitle: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    tabparent: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
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
      type: new ListType(customrecordtype_subtabs_subtab),
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
    [constants.SCRIPT_ID_PREFIX]: 'customrecord_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customrecord’. */
    recordname: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long.   This field is available when the customsegment value is equal to   This field is mandatory when the customsegment value is equal to */
    customsegment: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customsegment custom type.   If this field appears in the project, you must reference the CUSTOMSEGMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CUSTOMSEGMENTS must be enabled for this field to appear in your account. */
    accesstype: {
      type: enums.customrecordtype_accesstype,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   For information about possible values, see customrecordtype_accesstype.   The default value is 'CUSTRECORDENTRYPERM'. */
    allowattachments: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    allowinlineediting: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allowinlinedeleting: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allowinlinedetaching: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allowmobileaccess: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    allownumberingoverride: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    allowquickadd: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    allowquicksearch: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allowuiaccess: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is T. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    enabledle: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T.   If this field appears in the project, you must reference the EXTREMELIST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXTREMELIST must be enabled for this field to appear in your account. */
    enablekeywords: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    enablemailmerge: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the MAILMERGE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MAILMERGE must be enabled for this field to appear in your account. */
    enablenametranslation: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F.   If this field appears in the project, you must reference the MULTILANGUAGE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MULTILANGUAGE must be enabled for this field to appear in your account. */
    enablenumbering: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    enableoptimisticlocking: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    enablesystemnotes: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    hierarchical: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    numberingprefix: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    numberingsuffix: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    numberingmindigits: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    numberinginit: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    icon: {
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
      },
    },
    iconbuiltin: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    iconindex: {
      type: enums.generic_custom_record_icon,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_custom_record_icon. */
    includeinsearchmenu: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    includename: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is T. */
    isinactive: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    isordered: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    showcreationdate: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showcreationdateonlist: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showid: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    showlastmodified: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showlastmodifiedonlist: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    shownotes: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    showowner: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showownerallowchange: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    showowneronlist: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    customrecordcustomfields: {
      type: customrecordtype_customrecordcustomfields,
      annotations: {
      },
    },
    instances: {
      type: customrecordtype_instances,
      annotations: {
      },
    },
    links: {
      type: customrecordtype_links,
      annotations: {
      },
    },
    permissions: {
      type: customrecordtype_permissions,
      annotations: {
      },
    },
    recordsublists: {
      type: customrecordtype_recordsublists,
      annotations: {
      },
    },
    subtabs: {
      type: customrecordtype_subtabs,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})
