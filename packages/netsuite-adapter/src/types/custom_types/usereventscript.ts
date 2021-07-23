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

export const usereventscriptInnerTypes: ObjectType[] = []

const usereventscriptElemID = new ElemID(constants.NETSUITE, 'usereventscript')
const usereventscript_customplugintypes_plugintypeElemID = new ElemID(constants.NETSUITE, 'usereventscript_customplugintypes_plugintype')

const usereventscript_customplugintypes_plugintype = new ObjectType({
  elemID: usereventscript_customplugintypes_plugintypeElemID,
  annotations: {
  },
  fields: {
    plugintype: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the plugintype custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_customplugintypes_plugintype)

const usereventscript_customplugintypesElemID = new ElemID(constants.NETSUITE, 'usereventscript_customplugintypes')

const usereventscript_customplugintypes = new ObjectType({
  elemID: usereventscript_customplugintypesElemID,
  annotations: {
  },
  fields: {
    plugintype: {
      refType: new ListType(usereventscript_customplugintypes_plugintype),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_customplugintypes)

const usereventscript_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'usereventscript_libraries_library')

const usereventscript_libraries_library = new ObjectType({
  elemID: usereventscript_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: {
      refType: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_libraries_library)

const usereventscript_librariesElemID = new ElemID(constants.NETSUITE, 'usereventscript_libraries')

const usereventscript_libraries = new ObjectType({
  elemID: usereventscript_librariesElemID,
  annotations: {
  },
  fields: {
    library: {
      refType: new ListType(usereventscript_libraries_library),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_libraries)

const usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const usereventscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters')

const usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: usereventscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: {
      refType: new ListType(usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters)

const usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const usereventscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses')

const usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: usereventscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: {
      refType: new ListType(usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses)

const usereventscript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'usereventscript_scriptcustomfields_scriptcustomfield')

const usereventscript_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: usereventscript_scriptcustomfields_scriptcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
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
    setting: {
      refType: enums.script_setting,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: {
      refType: usereventscript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      annotations: {
      },
    },
    roleaccesses: {
      refType: usereventscript_scriptcustomfields_scriptcustomfield_roleaccesses,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_scriptcustomfields_scriptcustomfield)

const usereventscript_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'usereventscript_scriptcustomfields')

const usereventscript_scriptcustomfields = new ObjectType({
  elemID: usereventscript_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: {
    scriptcustomfield: {
      refType: new ListType(usereventscript_scriptcustomfields_scriptcustomfield),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_scriptcustomfields)

const usereventscript_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'usereventscript_scriptdeployments_scriptdeployment')

const usereventscript_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: usereventscript_scriptdeployments_scriptdeploymentElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: {
      refType: enums.script_status,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    recordtype: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see the following lists:   generic_standard_recordtype   allrecord_script_deployment_recordtype */
    allemployees: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allpartners: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    allroles: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    auddepartment: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the DEPARTMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. DEPARTMENTS must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    audemployee: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    audgroup: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    audpartner: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    audslctrole: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    audsubsidiary: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the SUBSIDIARIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUBSIDIARIES must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    eventtype: {
      refType: enums.script_eventtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_eventtype. */
    isdeployed: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    loglevel: {
      refType: enums.script_loglevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    runasrole: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    alllocalizationcontexts: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    executioncontext: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    localizationcontext: {
      refType: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can filter your script to run based on the localization context of your users. For information about using localization context in NetSuite, see Record Localization Context.   This field is available when the alllocalizationcontexts value is equal to F.   You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see countries. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_scriptdeployments_scriptdeployment)

const usereventscript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'usereventscript_scriptdeployments')

export const usereventscript_scriptdeployments = new ObjectType({
  elemID: usereventscript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: {
    scriptdeployment: {
      refType: new ListType(usereventscript_scriptdeployments_scriptdeployment),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})

usereventscriptInnerTypes.push(usereventscript_scriptdeployments)


export const usereventscript = new ObjectType({
  elemID: usereventscriptElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^customscript[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 40 }),
      },
    }, /* Original description: This field value can be up to 40 characters long.   This field accepts references to the string custom type. */
    scriptfile: {
      refType: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
    description: {
      refType: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
      },
    }, /* Original description: This field value can be up to 999 characters long.   This field accepts references to the string custom type. */
    isinactive: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyadmins: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyemails: {
      refType: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ max_length: 999 }),
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    notifygroup: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    notifyuser: {
      refType: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    aftersubmitfunction: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    beforeloadfunction: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    beforesubmitfunction: {
      refType: BuiltinTypes.STRING,
      annotations: {
      },
    },
    customplugintypes: {
      refType: usereventscript_customplugintypes,
      annotations: {
      },
    },
    libraries: {
      refType: usereventscript_libraries,
      annotations: {
      },
    },
    scriptcustomfields: {
      refType: usereventscript_scriptcustomfields,
      annotations: {
      },
    },
    scriptdeployments: {
      refType: usereventscript_scriptdeployments,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, usereventscriptElemID.name],
})
