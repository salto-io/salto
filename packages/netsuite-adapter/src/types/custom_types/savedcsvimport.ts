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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, ObjectType, ListType,
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
    ispublic: new Field(
      savedcsvimport_audienceElemID,
      'ispublic',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    globaledit: new Field(
      savedcsvimport_audienceElemID,
      'globaledit',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allemployees: new Field(
      savedcsvimport_audienceElemID,
      'allemployees',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allpartners: new Field(
      savedcsvimport_audienceElemID,
      'allpartners',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allroles: new Field(
      savedcsvimport_audienceElemID,
      'allroles',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    roles: new Field(
      savedcsvimport_audienceElemID,
      'roles',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
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
    file: new Field(
      savedcsvimport_filemappings_filemappingElemID,
      'file',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol. */
    primarykey: new Field(
      savedcsvimport_filemappings_filemappingElemID,
      'primarykey',
      BuiltinTypes.STRING,
      {
      },
    ),
    foreignkey: new Field(
      savedcsvimport_filemappings_filemappingElemID,
      'foreignkey',
      BuiltinTypes.STRING,
      {
      },
    ),
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
    filemapping: new Field(
      savedcsvimport_filemappingsElemID,
      'filemapping',
      new ListType(savedcsvimport_filemappings_filemapping),
      {
      },
    ),
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
    file: new Field(
      savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreferenceElemID,
      'file',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol. */
    column: new Field(
      savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreferenceElemID,
      'column',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ),
    type: new Field(
      savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreferenceElemID,
      'type',
      enums.csvimport_referencetype,
      {
      },
    ), /* Original description: For information about possible values, see csvimport_referencetype. */
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
    field: new Field(
      savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmappingElemID,
      'field',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the following custom types:   transactioncolumncustomfield   transactionbodycustomfield   othercustomfield   itemoptioncustomfield   itemnumbercustomfield   itemcustomfield   entitycustomfield   customsegment   customrecordcustomfield   crmcustomfield */
    value: new Field(
      savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmappingElemID,
      'value',
      BuiltinTypes.STRING,
      {
      },
    ),
    columnreference: new Field(
      savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmappingElemID,
      'columnreference',
      savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping_columnreference,
      {
      },
    ),
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
    fieldmapping: new Field(
      savedcsvimport_recordmappings_recordmapping_fieldmappingsElemID,
      'fieldmapping',
      new ListType(savedcsvimport_recordmappings_recordmapping_fieldmappings_fieldmapping),
      {
      },
    ),
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
    record: new Field(
      savedcsvimport_recordmappings_recordmappingElemID,
      'record',
      BuiltinTypes.STRING /* Original type was join   Join field types must be set to a colon-delimited list of values. */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol. */
    line: new Field(
      savedcsvimport_recordmappings_recordmappingElemID,
      'line',
      BuiltinTypes.NUMBER,
      {
      },
    ),
    fieldmappings: new Field(
      savedcsvimport_recordmappings_recordmappingElemID,
      'fieldmappings',
      savedcsvimport_recordmappings_recordmapping_fieldmappings,
      {
      },
    ),
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
    recordmapping: new Field(
      savedcsvimport_recordmappingsElemID,
      'recordmapping',
      new ListType(savedcsvimport_recordmappings_recordmapping),
      {
      },
    ),
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
    scriptid: new Field(
      savedcsvimportElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long.   The default value is ‘custimport’. */
    recordtype: new Field(
      savedcsvimportElemID,
      'recordtype',
      enums.csvimport_recordtypes,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see csvimport_recordtypes. */
    importname: new Field(
      savedcsvimportElemID,
      'importname',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 50,
      },
    ), /* Original description: This field value can be up to 50 characters long. */
    datahandling: new Field(
      savedcsvimportElemID,
      'datahandling',
      enums.csvimport_datahandling,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see csvimport_datahandling.   The default value is 'ADD'. */
    decimaldelimiter: new Field(
      savedcsvimportElemID,
      'decimaldelimiter',
      enums.csvimport_decimaldelimiter,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see csvimport_decimaldelimiter. */
    columndelimiter: new Field(
      savedcsvimportElemID,
      'columndelimiter',
      enums.csvimport_columndelimiter,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: For information about possible values, see csvimport_columndelimiter. */
    entryform: new Field(
      savedcsvimportElemID,
      'entryform',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the recordtype value is present in any of the following lists or values: csvimports_entryformrecordtypes, csvimport_customrecordtype.   This field is mandatory when the recordtype value is present in csvimports_entryformrecordtypes.   This field accepts references to the entryForm custom type.   For information about other possible values, see csvimport_entryform_standard. */
    transactionform: new Field(
      savedcsvimportElemID,
      'transactionform',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the recordtype value is present in any of the following lists or values: csvimports_transactionformrecordtypes, csvimport_customtransactiontype.   This field is mandatory when the recordtype value is present in csvimports_transactionformrecordtypes.   This field accepts references to the transactionForm custom type.   For information about other possible values, see csvimport_transactionform_standard. */
    customrecord: new Field(
      savedcsvimportElemID,
      'customrecord',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the recordtype value is equal to CUSTOMRECORD.   This field is mandatory when the recordtype value is equal to CUSTOMRECORD.   This field accepts references to the customrecordtype custom type.   For information about other possible values, see generic_standard_recordtype. */
    customtransaction: new Field(
      savedcsvimportElemID,
      'customtransaction',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
      },
    ), /* Original description: This field is available when the recordtype value is equal to CUSTOMTRANSACTION.   This field is mandatory when the recordtype value is equal to CUSTOMTRANSACTION.   This field accepts references to the customtransactiontype custom type. */
    charencoding: new Field(
      savedcsvimportElemID,
      'charencoding',
      enums.csvimport_encoding,
      {
      },
    ), /* Original description: For information about possible values, see csvimport_encoding.   The default value is 'windows-1252'. */
    logsystemnotescustfields: new Field(
      savedcsvimportElemID,
      'logsystemnotescustfields',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    overwritemissingfields: new Field(
      savedcsvimportElemID,
      'overwritemissingfields',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the recordtype value is not equal to CURRENCYRATE.   The default value is F. */
    validatemandatorycustfields: new Field(
      savedcsvimportElemID,
      'validatemandatorycustfields',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    overwritesublists: new Field(
      savedcsvimportElemID,
      'overwritesublists',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    ignorereadonly: new Field(
      savedcsvimportElemID,
      'ignorereadonly',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the recordtype value is not equal to any of the following lists or values: CUSTOMERANDCONTACT, LEADANDCONTACT, PROSPECTANDCONTACT.   The default value is T. */
    preventduplicates: new Field(
      savedcsvimportElemID,
      'preventduplicates',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: This field is available when the recordtype value is equal to any of the following lists or values: CUSTOMERANDCONTACT, LEADANDCONTACT, PROSPECTANDCONTACT, CONTACT, LEAD, PARTNER, VENDOR, CUSTOMER, PROSPECT.   The default value is F. */
    usemultithread: new Field(
      savedcsvimportElemID,
      'usemultithread',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    runserversuitescript: new Field(
      savedcsvimportElemID,
      'runserversuitescript',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
    multiselectdelimiter: new Field(
      savedcsvimportElemID,
      'multiselectdelimiter',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 1,
      },
    ), /* Original description: This field value can be up to 1 characters long.   The default value is '|'. */
    description: new Field(
      savedcsvimportElemID,
      'description',
      BuiltinTypes.STRING,
      {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 499,
      },
    ), /* Original description: This field value can be up to 499 characters long. */
    audience: new Field(
      savedcsvimportElemID,
      'audience',
      savedcsvimport_audience,
      {
      },
    ),
    filemappings: new Field(
      savedcsvimportElemID,
      'filemappings',
      savedcsvimport_filemappings,
      {
      },
    ),
    recordmappings: new Field(
      savedcsvimportElemID,
      'recordmappings',
      savedcsvimport_recordmappings,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, savedcsvimportElemID.name],
})
