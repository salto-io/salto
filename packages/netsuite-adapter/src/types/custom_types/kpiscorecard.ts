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
  fields: {
    allroles: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    allpartners: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F.   If this field appears in the project, you must reference the CRM feature in the manifest file to avoid project warnings. In the manifest file, you can specify whether this feature is required in your account. CRM must be enabled for this field to appear in your account. */
    allemployees: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    audslctrole: {
      type: BuiltinTypes.STRING /* Original type was multi-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the allroles value is not equal to T.   You can specify multiple values by separating each value with a pipe (|) symbol.   This field accepts references to the role custom type.   For information about other possible values, see generic_role. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_audience)

const kpiscorecard_customElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_custom')

const kpiscorecard_custom = new ObjectType({
  elemID: kpiscorecard_customElemID,
  annotations: {
  },
  fields: {
    kpi1: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi2: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi3: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi4: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi5: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi6: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi7: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi8: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi9: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
    kpi10: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field accepts references to the savedsearch custom type.   For information about other possible values, see the following lists:   generic_savedsearches_period   generic_savedsearches_daterange */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_custom)

const kpiscorecard_highlightings_highlightingElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_highlightings_highlighting')

const kpiscorecard_highlightings_highlighting = new ObjectType({
  elemID: kpiscorecard_highlightings_highlightingElemID,
  annotations: {
  },
  fields: {
    kpiindex: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is 'ALL'. */
    condition: {
      type: enums.kpiscorecards_highlight_conditions,
      annotations: {
      },
    }, /* Original description: For information about possible values, see kpiscorecards_highlight_conditions. */
    threshold: {
      type: BuiltinTypes.NUMBER,
      annotations: {
      },
    },
    rangeindex: {
      type: BuiltinTypes.STRING,
      annotations: {
      },
    }, /* Original description: The default value is 'ALL'. */
    icon: {
      type: enums.kpiscorecards_highlight_icons,
      annotations: {
      },
    }, /* Original description: For information about possible values, see kpiscorecards_highlight_icons. */
    foregroundcolor: {
      type: BuiltinTypes.STRING /* Original type was rgb   RGB field types must be set to a valid 6–digit hexadecimal value between #000000 and #FFFFFF. The # prefix is optional. */,
      annotations: {
      },
    }, /* Original description: The default value is '#000000'. */
    backgroundcolor: {
      type: BuiltinTypes.STRING /* Original type was rgb   RGB field types must be set to a valid 6–digit hexadecimal value between #000000 and #FFFFFF. The # prefix is optional. */,
      annotations: {
      },
    }, /* Original description: The default value is '#FFFFFF'. */
    bold: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    headline: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_highlightings_highlighting)

const kpiscorecard_highlightingsElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_highlightings')

const kpiscorecard_highlightings = new ObjectType({
  elemID: kpiscorecard_highlightingsElemID,
  annotations: {
  },
  fields: {
    highlighting: {
      type: new ListType(kpiscorecard_highlightings_highlighting),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_highlightings)

const kpiscorecard_kpis_kpiElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_kpis_kpi')

const kpiscorecard_kpis_kpi = new ObjectType({
  elemID: kpiscorecard_kpis_kpiElemID,
  annotations: {
  },
  fields: {
    kpi: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   kpi_snapshots_formula   kpi_snapshots_daterange_or_period   kpi_snapshots_daterange   kpi_snapshots_custom */
    comparevalueto: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   For information about possible values, see the following lists:   kpi_snapshots_formula   kpi_snapshots_daterange_or_period   kpi_snapshots_daterange   kpi_snapshots_custom */
    comparewithprevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   The default value is F. */
    comparisontype: {
      type: enums.kpiscorecards_comparisons,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   For information about possible values, see kpiscorecards_comparisons. */
    invertcomparison: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is not present in kpi_snapshots_formula.   The default value is F. */
    formula: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 200,
      },
    }, /* Original description: This field value can be up to 200 characters long.   This field is available when the kpi value is present in kpi_snapshots_formula. */
    lessismore: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: This field is available when the kpi value is present in kpi_snapshots_formula.   The default value is F. */
    hidden: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_kpis_kpi)

const kpiscorecard_kpisElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_kpis')

const kpiscorecard_kpis = new ObjectType({
  elemID: kpiscorecard_kpisElemID,
  annotations: {
  },
  fields: {
    kpi: {
      type: new ListType(kpiscorecard_kpis_kpi),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_kpis)

const kpiscorecard_ranges_rangeElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_ranges_range')

const kpiscorecard_ranges_range = new ObjectType({
  elemID: kpiscorecard_ranges_rangeElemID,
  annotations: {
  },
  fields: {
    range: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see the following lists:   kpi_ranges_period   kpi_ranges_daterange_report   kpi_ranges_daterange_or_period   kpi_ranges_daterange */
    comparevalueto: {
      type: BuiltinTypes.STRING /* Original type was single-select list */,
      annotations: {
      },
    }, /* Original description: For information about possible values, see the following lists:   kpi_ranges_period   kpi_ranges_daterange_report   kpi_ranges_daterange_or_period   kpi_ranges_daterange */
    comparewithprevious: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    comparisontype: {
      type: enums.kpiscorecards_comparisons,
      annotations: {
      },
    }, /* Original description: For information about possible values, see kpiscorecards_comparisons. */
    invertcomparison: {
      type: BuiltinTypes.BOOLEAN,
      annotations: {
      },
    }, /* Original description: The default value is F. */
    label: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 99,
      },
    }, /* Original description: This field value can be up to 99 characters long. */
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_ranges_range)

const kpiscorecard_rangesElemID = new ElemID(constants.NETSUITE, 'kpiscorecard_ranges')

const kpiscorecard_ranges = new ObjectType({
  elemID: kpiscorecard_rangesElemID,
  annotations: {
  },
  fields: {
    range: {
      type: new ListType(kpiscorecard_ranges_range),
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})

kpiscorecardInnerTypes.push(kpiscorecard_ranges)


export const kpiscorecard = new ObjectType({
  elemID: kpiscorecardElemID,
  annotations: {
    [constants.SCRIPT_ID_PREFIX]: 'custkpiscorecard_',
  },
  fields: {
    scriptid: {
      type: BuiltinTypes.SERVICE_ID,
      annotations: {
        [constants.IS_ATTRIBUTE]: true,
      },
    }, /* Original description: This attribute value can be up to 99 characters long.   The default value is ‘custkpiscorecard’. */
    name: {
      type: BuiltinTypes.STRING,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
        [constants.IS_NAME]: true,
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 25,
      },
    }, /* Original description: This field value can be up to 25 characters long. */
    useperiods: {
      type: enums.kpiscorecards_useperiods,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: true,
      },
    }, /* Original description: For information about possible values, see kpiscorecards_useperiods. */
    description: {
      type: BuiltinTypes.STRING,
      annotations: {
        // [CORE_ANNOTATIONS.LENGTH_LIMIT]: 999,
      },
    }, /* Original description: This field value can be up to 999 characters long. */
    audience: {
      type: kpiscorecard_audience,
      annotations: {
      },
    },
    custom: {
      type: kpiscorecard_custom,
      annotations: {
      },
    },
    highlightings: {
      type: kpiscorecard_highlightings,
      annotations: {
      },
    },
    kpis: {
      type: kpiscorecard_kpis,
      annotations: {
      },
    },
    ranges: {
      type: kpiscorecard_ranges,
      annotations: {
      },
    },
  },
  path: [constants.NETSUITE, constants.TYPES_PATH, kpiscorecardElemID.name],
})
