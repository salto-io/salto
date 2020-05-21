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

export const savedcsvimportInnerTypes: ObjectType[] = []

const savedcsvimportElemID = new ElemID(constants.NETSUITE, 'savedcsvimport')
const savedcsvimport_audienceElemID = new ElemID(constants.NETSUITE, 'savedcsvimport_audience')

const savedcsvimport_audience = new ObjectType({
  elemID: savedcsvimport_audienceElemID,
  annotations: {
  },
  fields: {
    ispublic: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    globaledit: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allemployees: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allpartners: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allroles: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    roles: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})

savedcsvimportInnerTypes.push(savedcsvimport_audience)

const savedcsvimport_filemappings_filemappingElemID = new ElemID(constants.NETSUITE, 'savedcsvimport_filemappings_filemapping')

const savedcsvimport_filemappings_filemapping = new ObjectType({
  elemID: savedcsvimport_filemappings_filemappingElemID,
  annotations: {
  },
  fields: {
    file: {
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol. */
    primarykey: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    foreignkey: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})

savedcsvimportInnerTypes.push(savedcsvimport_filemappings_filemapping)

const savedcsvimport_filemappingsElemID = new ElemID(constants.NETSUITE, 'savedcsvimport_filemappings')

const savedcsvimport_filemappings = new ObjectType({
  elemID: savedcsvimport_filemappingsElemID,
  annotations: {
  },
  fields: {
    filemapping: {
      type: new ListType(savedcsvimport_filemappings_filemapping),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})

savedcsvimportInnerTypes.push(savedcsvimport_filemappings)

const savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreferenceElemID = new ElemID(constants.NETSUITE, 'savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreference')

const savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreference = new ObjectType({
  elemID: savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreferenceElemID,
  annotations: {
  },
  fields: {
    file: {
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol. */
    column: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    type: {
      type: enums.csvimport_referencetype,
      annotations: {
      },
    }, /* Original description: For information about possible values, see csvimport_referencetype. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})

savedcsvimportInnerTypes.push(savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreference)

const savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmappingElemID = new ElemID(constants.NETSUITE, 'savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping')

const savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping = new ObjectType({
  elemID: savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmappingElemID,
  annotations: {
  },
  fields: {
    field: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customsegment   customrecordcustomfield   crmcustomfield */
    value: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    },
    columnreference: {
      type: savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreference,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})

savedcsvimportInnerTypes.push(savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping)

const savedcsvimport_recordmappings_recordmapping_fieldmappingsElemID = new ElemID(constants.NETSUITE, 'savedcsvimport_recordmappings_recordmapping_fieldmappings')

const savedcsvimport_recordmappings_recordmapping_fieldmappings = new ObjectType({
  elemID: savedcsvimport_recordmappings_recordmapping_fieldmappingsElemID,
  annotations: {
  },
  fields: {
    fieldmapping: {
      type: new ListType(savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})

savedcsvimportInnerTypes.push(savedcsvimport_recordmappings_recordmapping_fieldmappings)

const savedcsvimport_recordmappings_recordmappingElemID = new ElemID(constants.NETSUITE, 'savedcsvimport_recordmappings_recordmapping')

const savedcsvimport_recordmappings_recordmapping = new ObjectType({
  elemID: savedcsvimport_recordmappings_recordmappingElemID,
  annotations: {
  },
  fields: {
    record: {
      type: BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol. */
    line: {
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    fieldmappings: {
      type: savedcsvimport_recordmappings_recordmapping_fieldmappings,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})

savedcsvimportInnerTypes.push(savedcsvimport_recordmappings_recordmapping)

const savedcsvimport_recordmappingsElemID = new ElemID(constants.NETSUITE, 'savedcsvimport_recordmappings')

const savedcsvimport_recordmappings = new ObjectType({
  elemID: savedcsvimport_recordmappingsElemID,
  annotations: {
  },
  fields: {
    recordmapping: {
      type: new ListType(savedcsvimport_recordmappings_recordmapping),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})

savedcsvimportInnerTypes.push(savedcsvimport_recordmappings)


export const savedcsvimport = new ObjectType({
  elemID: savedcsvimportElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custimport_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custimport’. */
    recordtype: {
      type: enums.csvimport_recordtypes,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see csvimport_recordtypes. */
    importname: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 50,
      },
    }, /* Original description: This field value can be up to 50 characters long. */
    datahandling: {
      type: enums.csvimport_datahandling,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see csvimport_datahandling.   The default value is 'ADD'. */
    decimaldelimiter: {
      type: enums.csvimport_decimaldelimiter,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see csvimport_decimaldelimiter. */
    columndelimiter: {
      type: enums.csvimport_columndelimiter,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see csvimport_columndelimiter. */
    entryform: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the recordtype value is present in any of the following lists or values: csvimports_entryformrecordtypes, csvimport_customrecordtype.   This field is mandatory when the recordtype value is present in csvimports_entryformrecordtypes.   This field accepts references to the entryForm custom type.   For information about other possible values, see csvimport_entryform_standard. */
    transactionform: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the recordtype value is present in any of the following lists or values: csvimports_transactionformrecordtypes, csvimport_customtransactiontype.   This field is mandatory when the recordtype value is present in csvimports_transactionformrecordtypes.   This field accepts references to the transactionForm custom type.   For information about other possible values, see csvimport_transactionform_standard. */
    customrecord: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the recordtype value is equal to CUSTOMRECORD.   This field is mandatory when the recordtype value is equal to CUSTOMRECORD.   This field accepts references to the customrecordtype custom type.   For information about other possible values, see generic_standard_recordtype. */
    customtransaction: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the recordtype value is equal to CUSTOMTRANSACTION.   This field is mandatory when the recordtype value is equal to CUSTOMTRANSACTION.   This field accepts references to the customtransactiontype custom type. */
    charencoding: {
      type: enums.csvimport_encoding,
      annotations: {
      },
    }, /* Original description: For information about possible values, see csvimport_encoding.   The default value is 'windows-1252'. */
    logsystemnotescustfields: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    overwritemissingfields: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the recordtype value is not equal to CURRENCYRATE.   The default value is F. */
    validatemandatorycustfields: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    overwritesublists: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    ignorereadonly: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the recordtype value is not equal to any of the following lists or values: CUSTOMERANDCONTACT, LEADANDCONTACT, PROSPECTANDCONTACT.   The default value is T. */
    preventduplicates: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the recordtype value is equal to any of the following lists or values: CUSTOMERANDCONTACT, LEADANDCONTACT, PROSPECTANDCONTACT, CONTACT, LEAD, PARTNER, VENDOR, CUSTOMER, PROSPECT.   The default value is F. */
    usemultithread: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    runserversuitescript: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is T. */
    multiselectdelimiter: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 1,
      },
    }, /* Original description: This field value can be up to 1 characters long.   The default value is '|'. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 499,
      },
    }, /* Original description: This field value can be up to 499 characters long. */
    audience: {
      type: savedcsvimport_audience,
      annotations: {
      },
    },
    filemappings: {
      type: savedcsvimport_filemappings,
      annotations: {
      },
    },
    recordmappings: {
      type: savedcsvimport_recordmappings,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})
