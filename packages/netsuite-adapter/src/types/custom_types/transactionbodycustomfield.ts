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

export const transactionbodycustomfieldInnerTypes: ObjectType[] = []

const transactionbodycustomfieldElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield')
const transactionbodycustomfield_customfieldfilters_customfieldfilterElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield_customfieldfilters_customfieldfilter')

const transactionbodycustomfield_customfieldfilters_customfieldfilter = new ObjectType({
  elemID: transactionbodycustomfield_customfieldfilters_customfieldfilterElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})

transactionbodycustomfieldInnerTypes.push(transactionbodycustomfield_customfieldfilters_customfieldfilter)

const transactionbodycustomfield_customfieldfiltersElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield_customfieldfilters')

const transactionbodycustomfield_customfieldfilters = new ObjectType({
  elemID: transactionbodycustomfield_customfieldfiltersElemID,
  annotations: {
  },
  fields: {
    customfieldfilter: {
      type: new ListType(transactionbodycustomfield_customfieldfilters_customfieldfilter),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})

transactionbodycustomfieldInnerTypes.push(transactionbodycustomfield_customfieldfilters)

const transactionbodycustomfield_roleaccesses_roleaccessElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield_roleaccesses_roleaccess')

const transactionbodycustomfield_roleaccesses_roleaccess = new ObjectType({
  elemID: transactionbodycustomfield_roleaccesses_roleaccessElemID,
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
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})

transactionbodycustomfieldInnerTypes.push(transactionbodycustomfield_roleaccesses_roleaccess)

const transactionbodycustomfield_roleaccessesElemID = new ElemID(constants.NETSUITE, 'transactionbodycustomfield_roleaccesses')

const transactionbodycustomfield_roleaccesses = new ObjectType({
  elemID: transactionbodycustomfield_roleaccessesElemID,
  annotations: {
  },
  fields: {
    roleaccess: {
      type: new ListType(transactionbodycustomfield_roleaccesses_roleaccess),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})

transactionbodycustomfieldInnerTypes.push(transactionbodycustomfield_roleaccesses)


export const transactionbodycustomfield = new ObjectType({
  elemID: transactionbodycustomfieldElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custbody_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 38 characters long.   The default value is ‘custbody’. */
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
    showhierarchy: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
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
    }, /* Original description: This field accepts references to the transactionbodycustomfield custom type.   For information about other possible values, see generic_standard_field. */
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
    }, /* Original description: This field accepts references to the subtab custom type.   For information about other possible values, see generic_body_tab. */
    bodyassemblybuild: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ASSEMBLIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ASSEMBLIES must be enabled for this field to appear in your account. */
    bodybom: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the WORKORDERS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WORKORDERS must be enabled for this field to appear in your account. */
    bodycustomerpayment: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the RECEIVABLES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. RECEIVABLES must be enabled for this field to appear in your account. */
    bodydeposit: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    bodydepositapplication: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    bodyexpensereport: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the EXPREPORTS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. EXPREPORTS must be enabled for this field to appear in your account. */
    bodyinventoryadjustment: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the INVENTORY feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. INVENTORY must be enabled for this field to appear in your account. */
    bodyfulfillmentrequest: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the FULFILLMENTREQUEST feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. FULFILLMENTREQUEST must be enabled for this field to appear in your account. */
    bodystorepickup: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the STOREPICKUP feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. STOREPICKUP must be enabled for this field to appear in your account. */
    bodyitemfulfillment: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodyitemfulfillmentorder: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodyitemreceipt: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ADVRECEIVING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVRECEIVING must be enabled for this field to appear in your account. */
    bodyitemreceiptorder: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ADVRECEIVING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ADVRECEIVING must be enabled for this field to appear in your account. */
    bodyjournal: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodyperiodendjournal: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the PERIODENDJOURNALENTRIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PERIODENDJOURNALENTRIES must be enabled for this field to appear in your account. */
    bodyopportunity: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the OPPORTUNITIES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. OPPORTUNITIES must be enabled for this field to appear in your account. */
    bodyothertransaction: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    bodypaycheck: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the PAYCHECKJOURNAL feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PAYCHECKJOURNAL must be enabled for this field to appear in your account. */
    bodypickingticket: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    bodyprintflag: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    bodyprintpackingslip: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodyprintstatement: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodypurchase: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    bodysale: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    bodystore: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the WEBSTORE feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. WEBSTORE must be enabled for this field to appear in your account. */
    bodytransferorder: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the MULTILOCINVT feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. MULTILOCINVT must be enabled for this field to appear in your account. */
    bodyvendorpayment: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the PAYABLES feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. PAYABLES must be enabled for this field to appear in your account. */
    bodybtegata: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the ACCOUNTING feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. ACCOUNTING must be enabled for this field to appear in your account. */
    fldsizelabel: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    bodycustomtransactions: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the customtransactiontype custom type.   If this field appears in the project, you must reference the CUSTOMTRANSACTIONS feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CUSTOMTRANSACTIONS must be enabled for this field to appear in your account. */
    customfieldfilters: {
      type: transactionbodycustomfield_customfieldfilters,
      annotations: {
      },
    },
    roleaccesses: {
      type: transactionbodycustomfield_roleaccesses,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, transactionbodycustomfieldElemID.name],
})
