/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, ElemID, ObjectType, Values } from '@salto-io/adapter-api'
import {
  CUSTOM_RECORD_TYPE,
  EMAIL_TEMPLATE,
  ENTITY_CUSTOM_FIELD,
  FILE,
  FOLDER,
  METADATA_TYPE,
  NETSUITE,
  PATH,
  ROLE,
  SCRIPT_ID,
  SOAP,
  SOURCE,
  TRANSACTION_COLUMN_CUSTOM_FIELD,
  WORKFLOW,
} from '../src/constants'

const CUSTOM_RECORD_SCRIPT_ID = 'customrecord_slt_e2e_test'

export const mockDefaultValues: Record<string, Values> = {
  [ENTITY_CUSTOM_FIELD]: {
    [SCRIPT_ID]: 'custentity_slt_e2e_test',
    accesslevel: '2',
    appliestocontact: true,
    appliestocustomer: false,
    appliestoemployee: true,
    appliestogroup: false,
    appliestoothername: false,
    appliestopartner: false,
    appliestopricelist: false,
    appliestoprojecttemplate: false,
    appliestostatement: false,
    appliestovendor: false,
    appliestowebsite: false,
    applyformatting: false,
    availableexternally: false,
    checkspelling: true,
    defaultchecked: false,
    defaultvalue: 'None',
    description: 'e2e test entitycustomfield description',
    displaytype: 'NORMAL',
    encryptatrest: false,
    fieldtype: 'CHECKBOX',
    globalsearch: false,
    isformula: false,
    ismandatory: false,
    isparent: false,
    label: 'TestEntityCustomField',
    searchlevel: '2',
    showhierarchy: false,
    showinlist: false,
    storevalue: true,
  },
  [ROLE]: {
    [SCRIPT_ID]: 'customrole_slt_e2e_test',
    centertype: 'BASIC',
    employeerestriction: 'NONE',
    issalesrole: false,
    issupportrole: false,
    iswebserviceonlyrole: false,
    name: 'TestRole',
    restrictbydevice: false,
    restricttimeandexpenses: false,
    permissions: {
      permission: [
        {
          permkey: 'LIST_FILECABINET',
          permlevel: 'FULL',
        },
      ],
    },
  },
  [CUSTOM_RECORD_TYPE]: {
    annotations: {
      [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
      [SOURCE]: SOAP,
      [SCRIPT_ID]: CUSTOM_RECORD_SCRIPT_ID,
      accesstype: 'CUSTRECORDENTRYPERM',
      allowattachments: true,
      allowinlinedeleting: false,
      allowinlinedetaching: true,
      allowinlineediting: false,
      allowmobileaccess: true,
      allownumberingoverride: false,
      allowquickadd: false,
      allowquicksearch: false,
      allowuiaccess: true,
      description: 'e2e test customrecordtype description',
      enabledle: true,
      enablekeywords: true,
      enablemailmerge: false,
      enablenametranslation: false,
      enablenumbering: false,
      enableoptimisticlocking: true,
      enablesystemnotes: true,
      hierarchical: true,
      iconbuiltin: false,
      includeinsearchmenu: true,
      includename: true,
      isinactive: false,
      isordered: false,
      recordname: 'custom record name',
      showcreationdate: false,
      showcreationdateonlist: false,
      showid: false,
      showlastmodified: false,
      showlastmodifiedonlist: false,
      shownotes: true,
      showowner: false,
      showownerallowchange: false,
      showowneronlist: false,
    },
    fields: {
      scriptid: { refType: BuiltinTypes.SERVICE_ID },
      internalId: { refType: BuiltinTypes.STRING },
      custom_custrecord_field1: {
        refType: BuiltinTypes.STRING,
        annotations: {
          scriptid: 'custrecord_field1',
          accesslevel: '2',
          allowquickadd: false,
          applyformatting: false,
          checkspelling: false,
          defaultchecked: false,
          description: 'field 1 description',
          displaytype: 'NORMAL',
          encryptatrest: false,
          fieldtype: 'TEXT',
          globalsearch: false,
          isformula: false,
          ismandatory: false,
          isparent: false,
          label: 'Field 1',
          rolerestrict: false,
          searchlevel: '1',
          showinlist: false,
          storevalue: true,
        },
      },
      custom_custrecord_field2: {
        refType: BuiltinTypes.NUMBER,
        annotations: {
          scriptid: 'custrecord_field2',
          accesslevel: '2',
          allowquickadd: false,
          applyformatting: true,
          checkspelling: false,
          defaultchecked: false,
          description: 'field 2 description',
          displaytype: 'NORMAL',
          encryptatrest: false,
          fieldtype: 'PERCENT',
          globalsearch: false,
          isformula: false,
          ismandatory: false,
          isparent: false,
          label: 'Field 2',
          rolerestrict: false,
          searchlevel: '2',
          showinlist: false,
          storevalue: true,
        },
      },
      custom_custrecord_account: {
        refType: new ObjectType({ elemID: new ElemID(NETSUITE, 'account') }),
        annotations: {
          scriptid: 'custrecord_account',
          accesslevel: '2',
          allowquickadd: false,
          applyformatting: false,
          checkspelling: false,
          defaultchecked: false,
          displaytype: 'NORMAL',
          encryptatrest: false,
          fieldtype: 'SELECT',
          globalsearch: false,
          isformula: false,
          ismandatory: false,
          isparent: false,
          label: 'Related Account',
          onparentdelete: 'NO_ACTION',
          rolerestrict: false,
          searchlevel: '2',
          selectrecordtype: '-112',
          showinlist: false,
          storevalue: true,
        },
      },
    },
  },
  [WORKFLOW]: {
    [SCRIPT_ID]: 'customworkflow_slt_e2e_test',
    description: 'e2e test workflow description',
    initcontexts:
      'ACTION|BANKCONNECTIVITY|BANKSTATEMENTPARSER|BUNDLEINSTALLATION|CLIENT|CSVIMPORT|CUSTOMGLLINES|CUSTOMMASSUPDATE|DEBUGGER|EMAILCAPTURE|FICONNECTIVITY|MAPREDUCE|OFFLINECLIENT|OTHER|PAYMENTPOSTBACK|PAYMENTGATEWAY|PLATFORMEXTENSION|PORTLET|PROMOTIONS|CONSOLRATEADJUSTOR|RESTWEBSERVICES|RESTLET|ADVANCEDREVREC|SCHEDULED|SDFINSTALLATION|SHIPPINGPARTNERS|WEBSERVICES|SUITELET|TAXCALCULATION|USEREVENT|USERINTERFACE|WORKFLOW',
    initeventtypes: 'APPROVE|CANCEL',
    initoncreate: true,
    initonvieworupdate: false,
    inittriggertype: 'BEFORESUBMIT',
    isinactive: false,
    islogenabled: false,
    keephistory: 'ONLYWHENTESTING',
    name: 'workflow name',
    recordtypes: 'CASHREFUND',
    releasestatus: 'NOTINITIATING',
    runasadmin: true,
    initcondition: {
      type: 'VISUAL_BUILDER',
    },
    workflowcustomfields: {
      workflowcustomfield: [
        {
          scriptid: 'custworkflow_field1',
          applyformatting: false,
          defaultchecked: false,
          displaytype: 'NORMAL',
          fieldtype: 'SELECT',
          label: 'Approver',
          selectrecordtype: '-4',
          storevalue: true,
        },
        {
          scriptid: 'custworkflow_field2',
          applyformatting: false,
          defaultchecked: false,
          displaytype: 'NORMAL',
          fieldtype: 'SELECT',
          label: 'Created By',
          selectrecordtype: '-4',
          storevalue: true,
        },
      ],
    },
    workflowstates: {
      workflowstate: [
        {
          scriptid: 'workflowstate_state1',
          donotexitworkflow: false,
          name: 'Initiation',
          positionx: 133,
          positiony: 113,
          workflowactions: [
            {
              triggertype: 'ONENTRY',
              setfieldvalueaction: [
                {
                  scriptid: 'workflowaction_action1',
                  contexttypes:
                    'ACTION|BANKCONNECTIVITY|BANKSTATEMENTPARSER|BUNDLEINSTALLATION|CLIENT|CSVIMPORT|CUSTOMGLLINES|CUSTOMMASSUPDATE|DEBUGGER|EMAILCAPTURE|FICONNECTIVITY|MAPREDUCE|OFFLINECLIENT|OTHER|PAYMENTPOSTBACK|PAYMENTGATEWAY|PLATFORMEXTENSION|PORTLET|PROMOTIONS|CONSOLRATEADJUSTOR|RESTWEBSERVICES|RESTLET|ADVANCEDREVREC|SCHEDULED|SDFINSTALLATION|SHIPPINGPARTNERS|WEBSERVICES|SUITELET|TAXCALCULATION|USEREVENT|USERINTERFACE|WORKFLOW',
                  field: 'STDBODYAPPROVED',
                  isinactive: false,
                  schedulemode: 'DELAY',
                  valuechecked: false,
                  valuetype: 'STATIC',
                  initcondition: {
                    type: 'VISUAL_BUILDER',
                  },
                },
              ],
            },
          ],
          workflowtransitions: {
            workflowtransition: [
              {
                scriptid: 'workflowtransition_transition1',
                contexttypes:
                  'ACTION|BANKCONNECTIVITY|BANKSTATEMENTPARSER|BUNDLEINSTALLATION|CLIENT|CSVIMPORT|CUSTOMGLLINES|CUSTOMMASSUPDATE|DEBUGGER|EMAILCAPTURE|FICONNECTIVITY|MAPREDUCE|OFFLINECLIENT|OTHER|PAYMENTPOSTBACK|PAYMENTGATEWAY|PLATFORMEXTENSION|PORTLET|PROMOTIONS|CONSOLRATEADJUSTOR|RESTWEBSERVICES|RESTLET|ADVANCEDREVREC|SCHEDULED|SDFINSTALLATION|SHIPPINGPARTNERS|WEBSERVICES|SUITELET|TAXCALCULATION|USEREVENT|USERINTERFACE|WORKFLOW',
                tostate:
                  'change me to reference => netsuite.workflow.instance.customworkflow_slt_e2e_test.workflowstates.workflowstate.1.scriptid',
                triggertype: 'BEFORESUBMIT',
                initcondition: {
                  type: 'VISUAL_BUILDER',
                },
              },
            ],
          },
        },
        {
          scriptid: 'workflowstate_state2',
          donotexitworkflow: true,
          name: 'Approved',
          positionx: 133,
          positiony: 293,
          workflowactions: [
            {
              triggertype: 'ONENTRY',
              setfieldvalueaction: [
                {
                  scriptid: 'workflowaction_action2',
                  contexttypes:
                    'ACTION|BANKCONNECTIVITY|BANKSTATEMENTPARSER|BUNDLEINSTALLATION|CLIENT|CSVIMPORT|CUSTOMGLLINES|CUSTOMMASSUPDATE|DEBUGGER|EMAILCAPTURE|FICONNECTIVITY|MAPREDUCE|OFFLINECLIENT|OTHER|PAYMENTPOSTBACK|PAYMENTGATEWAY|PLATFORMEXTENSION|PORTLET|PROMOTIONS|CONSOLRATEADJUSTOR|RESTWEBSERVICES|RESTLET|ADVANCEDREVREC|SCHEDULED|SDFINSTALLATION|SHIPPINGPARTNERS|WEBSERVICES|SUITELET|TAXCALCULATION|USEREVENT|USERINTERFACE|WORKFLOW',
                  field: 'STDBODYAPPROVED',
                  isinactive: false,
                  schedulemode: 'DELAY',
                  valuechecked: true,
                  valuetype: 'STATIC',
                  initcondition: {
                    type: 'VISUAL_BUILDER',
                  },
                },
              ],
            },
            {
              triggertype: 'BEFORELOAD',
              lockrecordaction: [
                {
                  scriptid: 'workflowaction_action3',
                  contexttypes:
                    'ACTION|BANKCONNECTIVITY|BANKSTATEMENTPARSER|BUNDLEINSTALLATION|CLIENT|CSVIMPORT|CUSTOMGLLINES|CUSTOMMASSUPDATE|DEBUGGER|EMAILCAPTURE|FICONNECTIVITY|MAPREDUCE|OFFLINECLIENT|OTHER|PAYMENTPOSTBACK|PAYMENTGATEWAY|PLATFORMEXTENSION|PORTLET|PROMOTIONS|CONSOLRATEADJUSTOR|RESTWEBSERVICES|RESTLET|ADVANCEDREVREC|SCHEDULED|SDFINSTALLATION|SHIPPINGPARTNERS|WEBSERVICES|SUITELET|TAXCALCULATION|USEREVENT|USERINTERFACE|WORKFLOW',
                  isinactive: false,
                  initcondition: {
                    formula: '"User Role" NOT IN ("Role1")',
                    type: 'VISUAL_BUILDER',
                    parameters: {
                      parameter: [
                        {
                          name: 'User Role',
                          value: 'STDUSERROLE',
                        },
                        {
                          name: 'Role1',
                          selectrecordtype: '-118',
                          value: 'ADMINISTRATOR',
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    },
  },
  [TRANSACTION_COLUMN_CUSTOM_FIELD]: {
    [SCRIPT_ID]: 'custcol_slt_e2e_test',
    accesslevel: '1',
    applyformatting: false,
    colexpense: false,
    colexpensereport: false,
    colgrouponinvoices: false,
    colinventoryadjustment: false,
    colitemfulfillment: false,
    colitemfulfillmentorder: 'F',
    colitemreceipt: false,
    colitemreceiptorder: 'F',
    coljournal: false,
    colkititem: false,
    colopportunity: false,
    colpackingslip: false,
    colpickingticket: false,
    colprintflag: false,
    colpurchase: false,
    colreturnform: false,
    colsale: true,
    colstore: false,
    colstorehidden: false,
    colstorewithgroups: false,
    coltime: false,
    coltransferorder: false,
    defaultchecked: false,
    description: 'e2e test transactioncolumncustomfield description',
    displaytype: 'NORMAL',
    encryptatrest: false,
    fieldtype: 'CHECKBOX',
    isformula: false,
    ismandatory: false,
    label: 'transactioncolumncustomfield label',
    searchlevel: '2',
    showhierarchy: false,
    sourcefrom: 'change me to reference to entitycustomfield!!',
    sourcelist: 'STDBODYENTITY',
    storevalue: true,
  },
  [EMAIL_TEMPLATE]: {
    [SCRIPT_ID]: 'custemailtmpl_slt_e2e_test',
    addcompanyaddress: false,
    addunsubscribelink: false,
    isinactive: false,
    isprivate: false,
    name: 'email template name',
    recordtype: 'TRANSACTION',
    subject: 'email subject',
    usesmedia: false,
    content: 'Email Template Content',
  },
  [FOLDER]: {
    [PATH]: '/SuiteScripts/InnerFolder',
    bundleable: true,
    description: 'e2e test folder description',
    isinactive: false,
    isprivate: false,
  },
  [FILE]: {
    [PATH]: '/SuiteScripts/InnerFolder/e2eTest.js',
    availablewithoutlogin: false,
    bundleable: true,
    description: 'e2e test file description',
    generateurltimestamp: false,
    hideinbundle: false,
    isinactive: false,
    content: 'File Content',
  },
}
