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

export const kpiscorecardInnerTypes: ObjectType[] = []

const kpiscorecardElemID = new ElemID(constants.NETSUITE, 'kpiscorecard')
const kpiscorecard_audienceElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_audience')

const kpiscorecard_audience = new ObjectType({
  elemID: kpiscorecard_audienceElemID,
  annotations: {
  },
  fields: [
    {
      name: 'allroles',
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
      name: 'allemployees',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'audslctrole',
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the allroles value is not equal to T.   You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_audience)

const kpiscorecard_customElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_custom')

const kpiscorecard_custom = new ObjectType({
  elemID: kpiscorecard_customElemID,
  annotations: {
  },
  fields: [
    {
      name: 'kpi1',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    {
      name: 'kpi2',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    {
      name: 'kpi3',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    {
      name: 'kpi4',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    {
      name: 'kpi5',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    {
      name: 'kpi6',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    {
      name: 'kpi7',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    {
      name: 'kpi8',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    {
      name: 'kpi9',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    {
      name: 'kpi10',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_custom)

const kpiscorecard_highlightings_highlightingElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_highlightings_highlighting')

const kpiscorecard_highlightings_highlighting = new ObjectType({
  elemID: kpiscorecard_highlightings_highlightingElemID,
  annotations: {
  },
  fields: [
    {
      name: 'kpiindex',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is 'ALL'. */
    {
      name: 'condition',
      type: enums.kpiscorecards_highlight_conditions,
      annotations: {
      },
    }, /* Original description: For information about possible values, see kpiscorecards_highlight_conditions. */
    {
      name: 'threshold',
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    {
      name: 'rangeindex',
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is 'ALL'. */
    {
      name: 'icon',
      type: enums.kpiscorecards_highlight_icons,
      annotations: {
      },
    }, /* Original description: For information about possible values, see kpiscorecards_highlight_icons. */
    {
      name: 'foregroundcolor',
      type: BuiltinTypes.STRING /* Original type was rgb   RGB field types must be set to a valid 6–digit hexadecimal value between #000000 and #FFFFFF. The # prefix is optional. */,
      annotations: {
      },
    }, /* Original description: The default value is '#000000'. */
    {
      name: 'backgroundcolor',
      type: BuiltinTypes.STRING /* Original type was rgb   RGB field types must be set to a valid 6–digit hexadecimal value between #000000 and #FFFFFF. The # prefix is optional. */,
      annotations: {
      },
    }, /* Original description: The default value is '#FFFFFF'. */
    {
      name: 'bold',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'headline',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_highlightings_highlighting)

const kpiscorecard_highlightingsElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_highlightings')

const kpiscorecard_highlightings = new ObjectType({
  elemID: kpiscorecard_highlightingsElemID,
  annotations: {
  },
  fields: [
    {
      name: 'highlighting',
      type: new ListType(kpiscorecard_highlightings_highlighting),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_highlightings)

const kpiscorecard_kpis_kpiElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_kpis_kpi')

const kpiscorecard_kpis_kpi = new ObjectType({
  elemID: kpiscorecard_kpis_kpiElemID,
  annotations: {
  },
  fields: [
    {
      name: 'kpi',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   kpi_snapshots_formula   kpi_snapshots_daterange_or_period   kpi_snapshots_daterange   kpi_snapshots_custom */
    {
      name: 'comparevalueto',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   For information about possible values, see the following lists:   kpi_snapshots_formula   kpi_snapshots_daterange_or_period   kpi_snapshots_daterange   kpi_snapshots_custom */
    {
      name: 'comparewithprevious',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   The default value is F. */
    {
      name: 'comparisontype',
      type: enums.kpiscorecards_comparisons,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   For information about possible values, see kpiscorecards_comparisons. */
    {
      name: 'invertcomparison',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   The default value is F. */
    {
      name: 'formula',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long.   This field is available when the kpi value is present in kpi_snapshots_formula. */
    {
      name: 'lessismore',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in kpi_snapshots_formula.   The default value is F. */
    {
      name: 'hidden',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_kpis_kpi)

const kpiscorecard_kpisElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_kpis')

const kpiscorecard_kpis = new ObjectType({
  elemID: kpiscorecard_kpisElemID,
  annotations: {
  },
  fields: [
    {
      name: 'kpi',
      type: new ListType(kpiscorecard_kpis_kpi),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_kpis)

const kpiscorecard_ranges_rangeElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_ranges_range')

const kpiscorecard_ranges_range = new ObjectType({
  elemID: kpiscorecard_ranges_rangeElemID,
  annotations: {
  },
  fields: [
    {
      name: 'range',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   kpi_ranges_period   kpi_ranges_daterange_report   kpi_ranges_daterange_or_period   kpi_ranges_daterange */
    {
      name: 'comparevalueto',
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: For information about possible values, see the following lists:   kpi_ranges_period   kpi_ranges_daterange_report   kpi_ranges_daterange_or_period   kpi_ranges_daterange */
    {
      name: 'comparewithprevious',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'comparisontype',
      type: enums.kpiscorecards_comparisons,
      annotations: {
      },
    }, /* Original description: For information about possible values, see kpiscorecards_comparisons. */
    {
      name: 'invertcomparison',
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    {
      name: 'label',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_ranges_range)

const kpiscorecard_rangesElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_ranges')

const kpiscorecard_ranges = new ObjectType({
  elemID: kpiscorecard_rangesElemID,
  annotations: {
  },
  fields: [
    {
      name: 'range',
      type: new ListType(kpiscorecard_ranges_range),
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_ranges)


export const kpiscorecard = new ObjectType({
  elemID: kpiscorecardElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custkpiscorecard_',
  },
  fields: [
    {
      name: 'scriptid',
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custkpiscorecard’. */
    {
      name: 'name',
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 25,
      },
    }, /* Original description: This field value can be up to 25 characters long. */
    {
      name: 'useperiods',
      type: enums.kpiscorecards_useperiods,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see kpiscorecards_useperiods. */
    {
      name: 'description',
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    {
      name: 'audience',
      type: kpiscorecard_audience,
      annotations: {
      },
    },
    {
      name: 'custom',
      type: kpiscorecard_custom,
      annotations: {
      },
    },
    {
      name: 'highlightings',
      type: kpiscorecard_highlightings,
      annotations: {
      },
    },
    {
      name: 'kpis',
      type: kpiscorecard_kpis,
      annotations: {
      },
    },
    {
      name: 'ranges',
      type: kpiscorecard_ranges,
      annotations: {
      },
    },
  ],
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})
