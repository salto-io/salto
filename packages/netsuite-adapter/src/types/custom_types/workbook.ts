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
  BuiltinTypes, CORE_ANNOTATIONS, ElemID, ObjectType, createRestriction, ListType,
} from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import * as constants from '../../constants'
import { fieldTypes } from '../field_types'

export const workbookInnerTypes: ObjectType[] = []

const workbookElemID = new ElemID(constants.NETSUITE, 'workbook')
const workbook_charts_chartElemID = new ElemID(constants.NETSUITE, 'workbook_charts_chart')

const workbook_charts_chart = new ObjectType({
  elemID: workbook_charts_chartElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custchart’. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})

workbookInnerTypes.push(workbook_charts_chart)

const workbook_chartsElemID = new ElemID(constants.NETSUITE, 'workbook_charts')

const workbook_charts = new ObjectType({
  elemID: workbook_chartsElemID,
  annotations: {
  },
  fields: {
    chart: {
      refType: createRefToElmWithValue(new ListType(workbook_charts_chart)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})

workbookInnerTypes.push(workbook_charts)

const workbook_dependenciesElemID = new ElemID(constants.NETSUITE, 'workbook_dependencies')

const workbook_dependencies = new ObjectType({
  elemID: workbook_dependenciesElemID,
  annotations: {
  },
  fields: {
    dependency: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING /* Original type was single-select list */),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: This field accepts references to the dataset custom type. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})

workbookInnerTypes.push(workbook_dependencies)

const workbook_pivots_pivotElemID = new ElemID(constants.NETSUITE, 'workbook_pivots_pivot')

const workbook_pivots_pivot = new ObjectType({
  elemID: workbook_pivots_pivotElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custpivot’. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})

workbookInnerTypes.push(workbook_pivots_pivot)

const workbook_pivotsElemID = new ElemID(constants.NETSUITE, 'workbook_pivots')

const workbook_pivots = new ObjectType({
  elemID: workbook_pivotsElemID,
  annotations: {
  },
  fields: {
    pivot: {
      refType: createRefToElmWithValue(new ListType(workbook_pivots_pivot)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})

workbookInnerTypes.push(workbook_pivots)

const workbook_tables_tableElemID = new ElemID(constants.NETSUITE, 'workbook_tables_table')

const workbook_tables_table = new ObjectType({
  elemID: workbook_tables_tableElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custview’. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})

workbookInnerTypes.push(workbook_tables_table)

const workbook_tablesElemID = new ElemID(constants.NETSUITE, 'workbook_tables')

const workbook_tables = new ObjectType({
  elemID: workbook_tablesElemID,
  annotations: {
  },
  fields: {
    table: {
      refType: createRefToElmWithValue(new ListType(workbook_tables_table)),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})

workbookInnerTypes.push(workbook_tables)


export const workbook = new ObjectType({
  elemID: workbookElemID,
  annotations: {
  },
  fields: {
    scriptid: {
      refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_ATTRIBUTE]: true,
        [CORE_ANNOTATIONS.RESTRICTION]: createRestriction({ regex: '^custworkbook[0-9a-z_]+' }),
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custworkbook’. */
    name: {
      refType: createRefToElmWithValue(BuiltinTypes.STRING),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 50,
      },
    }, /* Original description: This field value can be up to 50 characters long. */
    definition: {
      refType: createRefToElmWithValue(fieldTypes.cdata),
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    },
    charts: {
      refType: createRefToElmWithValue(workbook_charts),
      annotations: {
      },
    },
    dependencies: {
      refType: createRefToElmWithValue(workbook_dependencies),
      annotations: {
      },
    },
    pivots: {
      refType: createRefToElmWithValue(workbook_pivots),
      annotations: {
      },
    },
    tables: {
      refType: createRefToElmWithValue(workbook_tables),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, workbookElemID.name],
})
