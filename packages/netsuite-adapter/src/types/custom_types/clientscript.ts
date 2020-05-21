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
  fields: {
    buttonlabel: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the string custom type. */
    buttonfunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_buttons_button)

const clientscript_buttonsElemID = new ElemID(constants.NETSUITE, 'clientscript_buttons')

const clientscript_buttons = new ObjectType({
  elemID: clientscript_buttonsElemID,
  annotations: {
  },
  fields: {
    button: {
      type: new ListType(clientscript_buttons_button),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_buttons)

const clientscript_libraries_libraryElemID = new ElemID(constants.NETSUITE, 'clientscript_libraries_library')

const clientscript_libraries_library = new ObjectType({
  elemID: clientscript_libraries_libraryElemID,
  annotations: {
  },
  fields: {
    scriptfile: {
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_libraries_library)

const clientscript_librariesElemID = new ElemID(constants.NETSUITE, 'clientscript_libraries')

const clientscript_libraries = new ObjectType({
  elemID: clientscript_librariesElemID,
  annotations: {
  },
  fields: {
    library: {
      type: new ListType(clientscript_libraries_library),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_libraries)

const clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter')

const clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilterElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter)

const clientscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters')

const clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: {
      type: new ListType(clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters)

const clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess')

const clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess)

const clientscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield_roleaccesses')

const clientscript_scriptcustomfields_scriptcustomfield_roleaccesses = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: {
      type: new ListType(clientscript_scriptcustomfields_scriptcustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield_roleaccesses)

const clientscript_scriptcustomfields_scriptcustomfieldElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields_scriptcustomfield')

const clientscript_scriptcustomfields_scriptcustomfield = new ObjectType({
  elemID: clientscript_scriptcustomfields_scriptcustomfieldElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custscript’. */
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
    setting: {
      type: enums.script_setting,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_setting. */
    customfieldfilters: {
      type: clientscript_scriptcustomfields_scriptcustomfield_customfieldfilters,
      annotations: {
      },
    },
    roleaccesses: {
      type: clientscript_scriptcustomfields_scriptcustomfield_roleaccesses,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields_scriptcustomfield)

const clientscript_scriptcustomfieldsElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptcustomfields')

const clientscript_scriptcustomfields = new ObjectType({
  elemID: clientscript_scriptcustomfieldsElemID,
  annotations: {
  },
  fields: {
    scriptcustomfield: {
      type: new ListType(clientscript_scriptcustomfields_scriptcustomfield),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptcustomfields)

const clientscript_scriptdeployments_scriptdeploymentElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptdeployments_scriptdeployment')

const clientscript_scriptdeployments_scriptdeployment = new ObjectType({
  elemID: clientscript_scriptdeployments_scriptdeploymentElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customdeploy’. */
    status: {
      type: enums.script_status,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see script_status.   The default value is 'TESTING'. */
    recordtype: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   customtransactiontype   customrecordtype   For information about other possible values, see the following lists:   scriptdeployment_recordtype   allrecord_script_deployment_recordtype */
    allemployees: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allpartners: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    allroles: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    auddepartment: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the DEPARTMENTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. DEPARTMENTS must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    audemployee: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    audgroup: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   Note Account-specific values are not supported by SDF. */
    audpartner: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    audslctrole: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    audsubsidiary: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   If this field appears in the project, you must reference the SUBSIDIARIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. SUBSIDIARIES must be enabled for this field to appear in your account.   Note Account-specific values are not supported by SDF. */
    eventtype: {
      type: enums.script_eventtype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_eventtype. */
    isdeployed: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    loglevel: {
      type: enums.script_loglevel,
      annotations: {
      },
    }, /* Original description: For information about possible values, see script_loglevel.   The default value is 'DEBUG'. */
    executioncontext: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see execution_context. */
    localizationcontext: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can filter your script to run based on the localization context of your users. For information about using localization context in NetSuite, see Record Localization Context.   This field is available when the alllocalizationcontexts value is equal to F.   You can specify multiple values by separating each value with a pipe (|) symbol.   For information about possible values, see countries. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptdeployments_scriptdeployment)

const clientscript_scriptdeploymentsElemID = new ElemID(constants.NETSUITE, 'clientscript_scriptdeployments')

const clientscript_scriptdeployments = new ObjectType({
  elemID: clientscript_scriptdeploymentsElemID,
  annotations: {
  },
  fields: {
    scriptdeployment: {
      type: new ListType(clientscript_scriptdeployments_scriptdeployment),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})

clientscriptInnerTypes.push(clientscript_scriptdeployments)


export const clientscript = new ObjectType({
  elemID: clientscriptElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'customscript_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘customscript’. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 40,
      },
    }, /* Original description: This field value can be up to 40 characters long. */
    scriptfile: {
      type: BuiltinTypes.STRING /* Original type was filereference */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field must reference a .js file. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    isinactive: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyadmins: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    notifyemails: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    notifygroup: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: Note Account-specific values are not supported by SDF. */
    notifyowner: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    notifyuser: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    fieldchangedfunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    lineinitfunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    pageinitfunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    postsourcingfunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    recalcfunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    saverecordfunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    validatedeletefunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    validatefieldfunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    validateinsertfunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    validatelinefunction: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    buttons: {
      type: clientscript_buttons,
      annotations: {
      },
    },
    libraries: {
      type: clientscript_libraries,
      annotations: {
      },
    },
    scriptcustomfields: {
      type: clientscript_scriptcustomfields,
      annotations: {
      },
    },
    scriptdeployments: {
      type: clientscript_scriptdeployments,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, clientscriptElemID.name],
})
