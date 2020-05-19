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

export const sdfinstallationscriptInnerTypes: ObjectType[] = []

const sdfinstallationscriptElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript')
const sdfinstallationscript_customplugintypes_plugintypeElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_customplugintypes_plugintype')

const sdfinstallationscript_customplugintypes_plugintype = new ObjectType({
  elemID: sdfinstallationscript_customplugintypes_plugintypeElemID,
  annotations: {
  },
  fields: [
    {
      name: 'plugintype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the plugintype custom type. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_customplugintypes_plugintype)

const sdfinstallationscript_customplugintypesElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_customplugintypes')

const sdfinstallationscript_customplugintypes = new ObjectType({
  elemID: sdfinstallationscript_customplugintypesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'plugintype',
      type: new ListType(sdfinstallationscript_customplugintypes_plugintype),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_customplugintypes)

const sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters')

const sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customfieldfilter',
      type: new ListType(sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters)

const sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses')

const sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'roleaccess',
      type: new ListType(sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses)

const sdfinstallationscript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_scriptcustomfields_scriptcustomfield')

const sdfinstallationscript_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: sdfinstallationscript_scriptcustomfields_scriptcustomfieldElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
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
      name: 'setting',
      type: enums.script_setting,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_setting. */
    {
      name: 'customfieldfilters',
      type: sdfinstallationscript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      annotations: {
      },
    },
    {
      name: 'roleaccesses',
      type: sdfinstallationscript_scriptcustomfields_scriptcustomfield_roleaccesses,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_scriptcustomfields_scriptcustomfield)

const sdfinstallationscript_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_scriptcustomfields')

const sdfinstallationscript_scriptcustomfields = new ObjectType({
  elemID: sdfinstallationscript_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptcustomfield',
      type: new ListType(sdfinstallationscript_scriptcustomfields_scriptcustomfield),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_scriptcustomfields)

const sdfinstallationscript_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_scriptdeployments_scriptdeployment')

const sdfinstallationscript_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: sdfinstallationscript_scriptdeployments_scriptdeploymentElemID,
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
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    {
      name: 'status',
      type: enums.script_status,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    {
      name: 'title',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    {
      name: 'isdeployed',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'loglevel',
      type: enums.script_loglevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_scriptdeployments_scriptdeployment)

const sdfinstallationscript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'sdfinstallationscript_scriptdeployments')

const sdfinstallationscript_scriptdeployments = new ObjectType({
  elemID: sdfinstallationscript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptdeployment',
      type: new ListType(sdfinstallationscript_scriptdeployments_scriptdeployment),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})

sdfinstallationscriptInnerTypes.push(sdfinstallationscript_scriptdeployments)


export const sdfinstallationscript = new ObjectType({
  elemID: sdfinstallationscriptElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    {
      name: 'scriptfile',
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
    {
      name: 'description',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    {
      name: 'isinactive',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'notifyadmins',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'notifyemails',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    {
      name: 'notifygroup',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    {
      name: 'notifyowner',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    {
      name: 'notifyuser',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'customplugintypes',
      type: sdfinstallationscript_customplugintypes,
      annotations: {
      },
    },
    {
      name: 'scriptcustomfields',
      type: sdfinstallationscript_scriptcustomfields,
      annotations: {
      },
    },
    {
      name: 'scriptdeployments',
      type: sdfinstallationscript_scriptdeployments,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, sdfinstallationscriptElemID.name],
})
