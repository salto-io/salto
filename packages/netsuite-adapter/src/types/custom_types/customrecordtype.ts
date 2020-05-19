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
  fields: [
    {
      name: 'fldfilter',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
    {
      name: 'fldfilterchecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fldfiltercomparetype',
      type: enums.generic_customfield_fldfiltercomparetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_fldfiltercomparetype.   The default value is 'EQ'. */
    {
      name: 'fldfiltersel',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'fldfilterval',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'fldfilternotnull',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fldfilternull',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'fldcomparefield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customrecordcustomfield   crmcustomfield   For information about other possible values, see generic_standard_field. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter)

const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customfieldfilter',
      type: new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters)

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccessElemID,
  annotations: {
  },
  fields: [
    {
      name: 'role',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    {
      name: 'accesslevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
    {
      name: 'searchlevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '0'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess)

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses')

const customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'roleaccess',
      type: new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses)

const customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields_customrecordcustomfield')

const customrecordtype_customrecordcustomfields_customrecordcustomfield = new ObjectType({
  elemID: customrecordtype_customrecordcustomfields_customrecordcustomfieldElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custrecord’. */
    {
      name: 'fieldtype',
      type: enums.generic_customfield_fieldtype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_customfield_fieldtype.   The default value is 'TEXT'. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long. */
    {
      name: 'selectrecordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is mandatory when the fieldtype value is equal to any of the following lists or values: SELECT, MULTISELECT.   This field accepts references to the following custom types:   customrecordtype   customlist   For information about other possible values, see generic_customfield_selectrecordtype. */
    {
      name: 'applyformatting',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'defaultchecked',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'defaultselection',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   scriptdeployment   workflowactionscript   workflowstatecustomfield   workflowcustomfield   workflow   scriptdeployment   usereventscript   transactioncolumncustomfield   transactionbodycustomfield   transactionForm   scriptdeployment   suitelet   scriptdeployment   scheduledscript   savedsearch   role   scriptdeployment   restlet   scriptdeployment   portlet   othercustomfield   scriptdeployment   massupdatescript   scriptdeployment   mapreducescript   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entryForm   entitycustomfield   statuses   customtransactiontype   instance   customrecordcustomfield   customrecordtype   customvalue   crmcustomfield   scriptdeployment   clientscript   scriptdeployment   bundleinstallationscript   advancedpdftemplate   addressForm */
    {
      name: 'defaultvalue',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'description',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'displaytype',
      type: enums.generic_customfield_displaytype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_displaytype.   The default value is 'NORMAL'. */
    {
      name: 'dynamicdefault',
      type: enums.generic_customfield_dynamicdefault,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_dynamicdefault. */
    {
      name: 'help',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'linktext',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'minvalue',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'maxvalue',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'storevalue',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'accesslevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    {
      name: 'checkspelling',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'encryptatrest',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'displayheight',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    {
      name: 'displaywidth',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    }, /* Original description: This field value must be greater than or equal to 0. */
    {
      name: 'globalsearch',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'isformula',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'ismandatory',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'maxlength',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'onparentdelete',
      type: enums.generic_customfield_onparentdelete,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_customfield_onparentdelete. */
    {
      name: 'searchcomparefield',
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'searchdefault',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'searchlevel',
      type: enums.generic_accesslevel_searchlevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_accesslevel_searchlevel.   The default value is '2'. */
    {
      name: 'showinlist',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'sourcefilterby',
      type: enums.generic_standard_field,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'sourcefrom',
      type: BuiltinTypes.STRING /* Original type was enums.generic_standard_field but it can also be reference */,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_standard_field. */
    {
      name: 'sourcelist',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customrecordcustomfield custom type.   For information about other possible values, see generic_standard_field. */
    {
      name: 'isparent',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'parentsubtab',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the following custom types:   subtab   subtab   For information about other possible values, see generic_tab_parent. */
    {
      name: 'subtab',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type. */
    {
      name: 'allowquickadd',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'rolerestrict',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'customfieldfilters',
      type: customrecordtype_customrecordcustomfields_customrecordcustomfield_customfieldfilters,
      annotations: {
      },
    },
    {
      name: 'roleaccesses',
      type: customrecordtype_customrecordcustomfields_customrecordcustomfield_roleaccesses,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields_customrecordcustomfield)

const customrecordtype_customrecordcustomfieldsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_customrecordcustomfields')

const customrecordtype_customrecordcustomfields = new ObjectType({
  elemID: customrecordtype_customrecordcustomfieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customrecordcustomfield',
      type: new ListType(customrecordtype_customrecordcustomfields_customrecordcustomfield),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_customrecordcustomfields)

const customrecordtype_instances_instanceElemID = new ElemID(constants.NETSUITE, 'customrecordtype_instances_instance')

const customrecordtype_instances_instance = new ObjectType({
  elemID: customrecordtype_instances_instanceElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    {
      name: 'altname',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the includename value is equal to T.   This field is available when the enablenumbering value is equal to T.   This field is mandatory when the includename value is equal to T.   This field is mandatory when the enablenumbering value is equal to T. */
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the includename value is equal to T.   This field is available when the enablenumbering value is equal to F.   This field is mandatory when the includename value is equal to T.   This field is mandatory when the enablenumbering value is equal to F. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'parent',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the hierarchical value is equal to T.   This field accepts references to the instance custom type. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_instances_instance)

const customrecordtype_instancesElemID = new ElemID(constants.NETSUITE, 'customrecordtype_instances')

const customrecordtype_instances = new ObjectType({
  elemID: customrecordtype_instancesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'instance',
      type: new ListType(customrecordtype_instances_instance),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_instances)

const customrecordtype_links_linkElemID = new ElemID(constants.NETSUITE, 'customrecordtype_links_link')

const customrecordtype_links_link = new ObjectType({
  elemID: customrecordtype_links_linkElemID,
  annotations: {
  },
  fields: [
    {
      name: 'linkcategory',
      type: enums.generic_centercategory,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_centercategory. */
    {
      name: 'linktasktype',
      type: enums.customrecordtype_tasktype,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see customrecordtype_tasktype. */
    {
      name: 'linklabel',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_links_link)

const customrecordtype_linksElemID = new ElemID(constants.NETSUITE, 'customrecordtype_links')

const customrecordtype_links = new ObjectType({
  elemID: customrecordtype_linksElemID,
  annotations: {
  },
  fields: [
    {
      name: 'link',
      type: new ListType(customrecordtype_links_link),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_links)

const customrecordtype_permissions_permissionElemID = new ElemID(constants.NETSUITE, 'customrecordtype_permissions_permission')

const customrecordtype_permissions_permission = new ObjectType({
  elemID: customrecordtype_permissions_permissionElemID,
  annotations: {
  },
  fields: [
    {
      name: 'permittedrole',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see customrecordtype_permittedrole. */
    {
      name: 'permittedlevel',
      type: enums.generic_permission_level,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see generic_permission_level.   The default value is 'NONE'. */
    {
      name: 'restriction',
      type: enums.role_restrict,
      annotations: {
      },
    }, /* Original description: For information about possible values, see role_restrict. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_permissions_permission)

const customrecordtype_permissionsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_permissions')

const customrecordtype_permissions = new ObjectType({
  elemID: customrecordtype_permissionsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'permission',
      type: new ListType(customrecordtype_permissions_permission),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_permissions)

const customrecordtype_recordsublists_recordsublistElemID = new ElemID(constants.NETSUITE, 'customrecordtype_recordsublists_recordsublist')

const customrecordtype_recordsublists_recordsublist = new ObjectType({
  elemID: customrecordtype_recordsublists_recordsublistElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    {
      name: 'recordsearch',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the savedsearch custom type. */
    {
      name: 'recorddescr',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'recordtab',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type. */
    {
      name: 'recordfield',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customrecordcustomfield custom type.   For information about other possible values, see generic_standard_field. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_recordsublists_recordsublist)

const customrecordtype_recordsublistsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_recordsublists')

const customrecordtype_recordsublists = new ObjectType({
  elemID: customrecordtype_recordsublistsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'recordsublist',
      type: new ListType(customrecordtype_recordsublists_recordsublist),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_recordsublists)

const customrecordtype_subtabs_subtabElemID = new ElemID(constants.NETSUITE, 'customrecordtype_subtabs_subtab')

const customrecordtype_subtabs_subtab = new ObjectType({
  elemID: customrecordtype_subtabs_subtabElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long. */
    {
      name: 'tabtitle',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'tabparent',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the subtab custom type. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_subtabs_subtab)

const customrecordtype_subtabsElemID = new ElemID(constants.NETSUITE, 'customrecordtype_subtabs')

const customrecordtype_subtabs = new ObjectType({
  elemID: customrecordtype_subtabsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'subtab',
      type: new ListType(customrecordtype_subtabs_subtab),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})

customrecordtypeInnerTypes.push(customrecordtype_subtabs)


export const customrecordtype = new ObjectType({
  elemID: customrecordtypeElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customrecord_',
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customrecord’. */
    {
      name: 'recordname',
      type: BuiltinTypes.STRING,
      annotations: {
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long.   This field is available when the customsegment value is equal to   This field is mandatory when the customsegment value is equal to */
    {
      name: 'customsegment',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the customsegment custom type.   If this field appears in the project, you must reference the CUSTOMSEGMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CUSTOMSEGMENTS must be enabled for this field to appear in your account. */
    {
      name: 'accesstype',
      type: enums.customrecordtype_accesstype,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   For information about possible values, see customrecordtype_accesstype.   The default value is 'CUSTRECORDENTRYPERM'. */
    {
      name: 'allowattachments',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'allowinlineediting',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'allowinlinedeleting',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'allowinlinedetaching',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'allowmobileaccess',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    {
      name: 'allownumberingoverride',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    {
      name: 'allowquickadd',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'allowquicksearch',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'allowuiaccess',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is T. */
    {
      name: 'description',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    {
      name: 'enabledle',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T.   If this field appears in the project, you must reference the EXTREMELIST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXTREMELIST must be enabled for this field to appear in your account. */
    {
      name: 'enablekeywords',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'enablemailmerge',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the MAILMERGE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MAILMERGE must be enabled for this field to appear in your account. */
    {
      name: 'enablenametranslation',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F.   If this field appears in the project, you must reference the MULTILANGUAGE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MULTILANGUAGE must be enabled for this field to appear in your account. */
    {
      name: 'enablenumbering',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    {
      name: 'enableoptimisticlocking',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'enablesystemnotes',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'hierarchical',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    {
      name: 'numberingprefix',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    {
      name: 'numberingsuffix',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    {
      name: 'numberingmindigits',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    {
      name: 'numberinginit',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to */
    {
      name: 'icon',
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
      },
    },
    {
      name: 'iconbuiltin',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'iconindex',
      type: enums.generic_custom_record_icon,
      annotations: {
      },
    }, /* Original description: For information about possible values, see generic_custom_record_icon. */
    {
      name: 'includeinsearchmenu',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'includename',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is T. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    {
      name: 'isordered',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    {
      name: 'showcreationdate',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showcreationdateonlist',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showid',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the customsegment value is equal to   The default value is F. */
    {
      name: 'showlastmodified',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showlastmodifiedonlist',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'shownotes',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'showowner',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showownerallowchange',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'showowneronlist',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'customrecordcustomfields',
      type: customrecordtype_customrecordcustomfields,
      annotations: {
      },
    },
    {
      name: 'instances',
      type: customrecordtype_instances,
      annotations: {
      },
    },
    {
      name: 'links',
      type: customrecordtype_links,
      annotations: {
      },
    },
    {
      name: 'permissions',
      type: customrecordtype_permissions,
      annotations: {
      },
    },
    {
      name: 'recordsublists',
      type: customrecordtype_recordsublists,
      annotations: {
      },
    },
    {
      name: 'subtabs',
      type: customrecordtype_subtabs,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, customrecordtypeElemID.name],
})
