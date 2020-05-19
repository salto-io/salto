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

export const clientscriptInnerTypes: ObjectType[] = []

const clientscriptElemID = new ElemID(constants.NETSUITE, 'clientscript')
const clientscript_buttons_buttonElemID = new ElemID(constants.NETSUITE, 'clientscript_buttons_button')

const clientscript_buttons_button = new ObjectType({
  elemID: clientscript_buttons_buttonElemID,
  annotations: {
  },
  fields: [
    {
      name: 'buttonlabel',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    {
      name: 'buttonfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_buttons_button)

const clientscript_buttonsElemID = new ElemID(constants.NETSUITE, 'clientscript_buttons')

const clientscript_buttons = new ObjectType({
  elemID: clientscript_buttonsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'button',
      type: new ListType(clientscript_buttons_button),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_buttons)

const clientscript_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'clientscript_libraries_library')

const clientscript_libraries_library = new ObjectType({
  elemID: clientscript_libraries_libraryElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptfile',
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_libraries_library)

const clientscript_librariesElemID = new ElemID(constants.NETSUITE, 'clientscript_libraries')

const clientscript_libraries = new ObjectType({
  elemID: clientscript_librariesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'library',
      type: new ListType(clientscript_libraries_library),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_libraries)

const clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const clientscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters')

const clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: [
    {
      name: 'customfieldfilter',
      type: new ListType(clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters)

const clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const clientscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield_roleaccesses')

const clientscript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'roleaccess',
      type: new ListType(clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield_roleaccesses)

const clientscript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield')

const clientscript_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfieldElemID,
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
      type: clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      annotations: {
      },
    },
    {
      name: 'roleaccesses',
      type: clientscript_scriptcustomfields_scriptcustomfield_roleaccesses,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield)

const clientscript_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields')

const clientscript_scriptcustomfields = new ObjectType({
  elemID: clientscript_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptcustomfield',
      type: new ListType(clientscript_scriptcustomfields_scriptcustomfield),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields)

const clientscript_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptdeployments_scriptdeployment')

const clientscript_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: clientscript_scriptdeployments_scriptdeploymentElemID,
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
      name: 'recordtype',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see the following lists:   scriptdeployment_recordtype   allrecord_script_deployment_recordtype */
    {
      name: 'allemployees',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'allpartners',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    {
      name: 'allroles',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'auddepartment',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the DEPARTMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. DEPARTMENTS must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    {
      name: 'audemployee',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    {
      name: 'audgroup',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    {
      name: 'audpartner',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    {
      name: 'audslctrole',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    {
      name: 'audsubsidiary',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the SUBSIDIARIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUBSIDIARIES must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    {
      name: 'eventtype',
      type: enums.script_eventtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_eventtype. */
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
    {
      name: 'executioncontext',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    {
      name: 'localizationcontext',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can filter your script to run based on the localization context of your users. For information about using localization context in NetSuite, see Record Localization Context.   This field is available when the alllocalizationcontexts value is equal to F.   You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see countries. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptdeployments_scriptdeployment)

const clientscript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptdeployments')

const clientscript_scriptdeployments = new ObjectType({
  elemID: clientscript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'scriptdeployment',
      type: new ListType(clientscript_scriptdeployments_scriptdeployment),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptdeployments)


export const clientscript = new ObjectType({
  elemID: clientscriptElemID,
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
      name: 'fieldchangedfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'lineinitfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'pageinitfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'postsourcingfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'recalcfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'saverecordfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'validatedeletefunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'validatefieldfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'validateinsertfunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'validatelinefunction',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    {
      name: 'buttons',
      type: clientscript_buttons,
      annotations: {
      },
    },
    {
      name: 'libraries',
      type: clientscript_libraries,
      annotations: {
      },
    },
    {
      name: 'scriptcustomfields',
      type: clientscript_scriptcustomfields,
      annotations: {
      },
    },
    {
      name: 'scriptdeployments',
      type: clientscript_scriptdeployments,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})
