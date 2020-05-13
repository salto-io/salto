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

export const centertabInnerTypes: ObjectType[] = []

const centertabElemID = new ElemID(constants.NETSUITE, 'centertab')
const centertab_portlets_portletElemID = new ElemID(constants.NETSUITE, 'centertab_portlets_portlet')

const centertab_portlets_portlet = new ObjectType({
  elemID: centertab_portlets_portletElemID,
  annotations: {
  },
  fields: {
    scriptid: new Field(
      centertab_portlets_portletElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 40 characters long. */
    portlet: new Field(
      centertab_portlets_portletElemID,
      'portlet',
      enums.generic_portlet,
      {
      },
    ), /* Original description: For information about possible values, see generic_portlet. */
    portletcolumn: new Field(
      centertab_portlets_portletElemID,
      'portletcolumn',
      enums.generic_portletcolumn,
      {
      },
    ), /* Original description: For information about possible values, see generic_portletcolumn. */
    isportletshown: new Field(
      centertab_portlets_portletElemID,
      'isportletshown',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is T. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, centertabElemID.name],
})

centertabInnerTypes.push(centertab_portlets_portlet)

const centertab_portletsElemID = new ElemID(constants.NETSUITE, 'centertab_portlets')

const centertab_portlets = new ObjectType({
  elemID: centertab_portletsElemID,
  annotations: {
  },
  fields: {
    portlet: new Field(
      centertab_portletsElemID,
      'portlet',
      new ListType(centertab_portlets_portlet),
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, centertabElemID.name],
})

centertabInnerTypes.push(centertab_portlets)


export const centertab = new ObjectType({
  elemID: centertabElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custcentertab_',
  },
  fields: {
    scriptid: new Field(
      centertabElemID,
      'scriptid',
      BuiltinTypes.SERVICE_ID,
      {
        [constants.IS_ATTRIBUTE]: true,
      },
    ), /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custcentertab’. */
    label: new Field(
      centertabElemID,
      'label',
      BuiltinTypes.STRING,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
      },
    ),
    center: new Field(
      centertabElemID,
      'center',
      BuiltinTypes.STRING /* Original type was single-select list */,
      {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    ), /* Original description: This field accepts references to the center custom type.   For information about other possible values, see generic_centertype. */
    allvendors: new Field(
      centertabElemID,
      'allvendors',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allroles: new Field(
      centertabElemID,
      'allroles',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allpartners: new Field(
      centertabElemID,
      'allpartners',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    allcustomers: new Field(
      centertabElemID,
      'allcustomers',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    allemployees: new Field(
      centertabElemID,
      'allemployees',
      BuiltinTypes.BOOLEAN,
      {
      },
    ), /* Original description: The default value is F. */
    audslctrole: new Field(
      centertabElemID,
      'audslctrole',
      BuiltinTypes.STRING /* Original type was multi-select list */,
      {
      },
    ), /* Original description: You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
    portlets: new Field(
      centertabElemID,
      'portlets',
      centertab_portlets,
      {
      },
    ),
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, centertabElemID.name],
})
