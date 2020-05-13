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
import { ObjectType, TypeElement } from '@salto-io/adapter-api'
import _ from 'lodash'
import { addressForm, addressFormInnerTypes } from './types/custom_types/addressForm'
import { advancedpdftemplate, advancedpdftemplateInnerTypes } from './types/custom_types/advancedpdftemplate'
import { bankstatementparserplugin, bankstatementparserpluginInnerTypes } from './types/custom_types/bankstatementparserplugin'
import { bundleinstallationscript, bundleinstallationscriptInnerTypes } from './types/custom_types/bundleinstallationscript'
import { center, centerInnerTypes } from './types/custom_types/center'
import { centercategory, centercategoryInnerTypes } from './types/custom_types/centercategory'
import { centertab, centertabInnerTypes } from './types/custom_types/centertab'
import { clientscript, clientscriptInnerTypes } from './types/custom_types/clientscript'
import { cmscontenttype, cmscontenttypeInnerTypes } from './types/custom_types/cmscontenttype'
import { crmcustomfield, crmcustomfieldInnerTypes } from './types/custom_types/crmcustomfield'
import { customglplugin, customglpluginInnerTypes } from './types/custom_types/customglplugin'
import { customlist, customlistInnerTypes } from './types/custom_types/customlist'
import { customrecordtype, customrecordtypeInnerTypes } from './types/custom_types/customrecordtype'
import { customsegment, customsegmentInnerTypes } from './types/custom_types/customsegment'
import { customtransactiontype, customtransactiontypeInnerTypes } from './types/custom_types/customtransactiontype'
import { dataset, datasetInnerTypes } from './types/custom_types/dataset'
import { emailcaptureplugin, emailcapturepluginInnerTypes } from './types/custom_types/emailcaptureplugin'
import { emailtemplate, emailtemplateInnerTypes } from './types/custom_types/emailtemplate'
import { entitycustomfield, entitycustomfieldInnerTypes } from './types/custom_types/entitycustomfield'
import { entryForm, entryFormInnerTypes } from './types/custom_types/entryForm'
import { ficonnectivityplugin, ficonnectivitypluginInnerTypes } from './types/custom_types/ficonnectivityplugin'
import { itemcustomfield, itemcustomfieldInnerTypes } from './types/custom_types/itemcustomfield'
import { itemnumbercustomfield, itemnumbercustomfieldInnerTypes } from './types/custom_types/itemnumbercustomfield'
import { itemoptioncustomfield, itemoptioncustomfieldInnerTypes } from './types/custom_types/itemoptioncustomfield'
import { kpiscorecard, kpiscorecardInnerTypes } from './types/custom_types/kpiscorecard'
import { mapreducescript, mapreducescriptInnerTypes } from './types/custom_types/mapreducescript'
import { massupdatescript, massupdatescriptInnerTypes } from './types/custom_types/massupdatescript'
import { othercustomfield, othercustomfieldInnerTypes } from './types/custom_types/othercustomfield'
import { pluginimplementation, pluginimplementationInnerTypes } from './types/custom_types/pluginimplementation'
import { plugintype, plugintypeInnerTypes } from './types/custom_types/plugintype'
import { portlet, portletInnerTypes } from './types/custom_types/portlet'
import { promotionsplugin, promotionspluginInnerTypes } from './types/custom_types/promotionsplugin'
import { publisheddashboard, publisheddashboardInnerTypes } from './types/custom_types/publisheddashboard'
import { restlet, restletInnerTypes } from './types/custom_types/restlet'
import { role, roleInnerTypes } from './types/custom_types/role'
import { savedcsvimport, savedcsvimportInnerTypes } from './types/custom_types/savedcsvimport'
import { savedsearch, savedsearchInnerTypes } from './types/custom_types/savedsearch'
import { scheduledscript, scheduledscriptInnerTypes } from './types/custom_types/scheduledscript'
import { sdfinstallationscript, sdfinstallationscriptInnerTypes } from './types/custom_types/sdfinstallationscript'
import { sspapplication, sspapplicationInnerTypes } from './types/custom_types/sspapplication'
import { sublist, sublistInnerTypes } from './types/custom_types/sublist'
import { subtab, subtabInnerTypes } from './types/custom_types/subtab'
import { suitelet, suiteletInnerTypes } from './types/custom_types/suitelet'
import { transactionForm, transactionFormInnerTypes } from './types/custom_types/transactionForm'
import { transactionbodycustomfield, transactionbodycustomfieldInnerTypes } from './types/custom_types/transactionbodycustomfield'
import { transactioncolumncustomfield, transactioncolumncustomfieldInnerTypes } from './types/custom_types/transactioncolumncustomfield'
import { translationcollection, translationcollectionInnerTypes } from './types/custom_types/translationcollection'
import { usereventscript, usereventscriptInnerTypes } from './types/custom_types/usereventscript'
import { workbook, workbookInnerTypes } from './types/custom_types/workbook'
import { workflow, workflowInnerTypes } from './types/custom_types/workflow'
import { workflowactionscript, workflowactionscriptInnerTypes } from './types/custom_types/workflowactionscript'
import { enums } from './types/enums'


/**
* generated using types_generator.py as Netsuite don't expose a metadata API for them.
*/
export const customTypes: Readonly<Record<string, ObjectType>> = {
  addressForm,
  advancedpdftemplate,
  bankstatementparserplugin,
  bundleinstallationscript,
  center,
  centercategory,
  centertab,
  clientscript,
  cmscontenttype,
  crmcustomfield,
  customglplugin,
  customlist,
  customrecordtype,
  customsegment,
  customtransactiontype,
  dataset,
  emailcaptureplugin,
  emailtemplate,
  entitycustomfield,
  entryForm,
  ficonnectivityplugin,
  itemcustomfield,
  itemnumbercustomfield,
  itemoptioncustomfield,
  kpiscorecard,
  mapreducescript,
  massupdatescript,
  othercustomfield,
  pluginimplementation,
  plugintype,
  portlet,
  promotionsplugin,
  publisheddashboard,
  restlet,
  role,
  savedcsvimport,
  savedsearch,
  scheduledscript,
  sdfinstallationscript,
  sspapplication,
  sublist,
  subtab,
  suitelet,
  transactionForm,
  transactionbodycustomfield,
  transactioncolumncustomfield,
  translationcollection,
  usereventscript,
  workbook,
  workflow,
  workflowactionscript,
}

const innerCustomTypes: ObjectType[] = [
  ...addressFormInnerTypes,
  ...advancedpdftemplateInnerTypes,
  ...bankstatementparserpluginInnerTypes,
  ...bundleinstallationscriptInnerTypes,
  ...centerInnerTypes,
  ...centercategoryInnerTypes,
  ...centertabInnerTypes,
  ...clientscriptInnerTypes,
  ...cmscontenttypeInnerTypes,
  ...crmcustomfieldInnerTypes,
  ...customglpluginInnerTypes,
  ...customlistInnerTypes,
  ...customrecordtypeInnerTypes,
  ...customsegmentInnerTypes,
  ...customtransactiontypeInnerTypes,
  ...datasetInnerTypes,
  ...emailcapturepluginInnerTypes,
  ...emailtemplateInnerTypes,
  ...entitycustomfieldInnerTypes,
  ...entryFormInnerTypes,
  ...ficonnectivitypluginInnerTypes,
  ...itemcustomfieldInnerTypes,
  ...itemnumbercustomfieldInnerTypes,
  ...itemoptioncustomfieldInnerTypes,
  ...kpiscorecardInnerTypes,
  ...mapreducescriptInnerTypes,
  ...massupdatescriptInnerTypes,
  ...othercustomfieldInnerTypes,
  ...pluginimplementationInnerTypes,
  ...plugintypeInnerTypes,
  ...portletInnerTypes,
  ...promotionspluginInnerTypes,
  ...publisheddashboardInnerTypes,
  ...restletInnerTypes,
  ...roleInnerTypes,
  ...savedcsvimportInnerTypes,
  ...savedsearchInnerTypes,
  ...scheduledscriptInnerTypes,
  ...sdfinstallationscriptInnerTypes,
  ...sspapplicationInnerTypes,
  ...sublistInnerTypes,
  ...subtabInnerTypes,
  ...suiteletInnerTypes,
  ...transactionFormInnerTypes,
  ...transactionbodycustomfieldInnerTypes,
  ...transactioncolumncustomfieldInnerTypes,
  ...translationcollectionInnerTypes,
  ...usereventscriptInnerTypes,
  ...workbookInnerTypes,
  ...workflowInnerTypes,
  ...workflowactionscriptInnerTypes,
]

export const isCustomType = (type: ObjectType): boolean =>
  !_.isUndefined(customTypes[type.elemID.name])

export const getAllTypes = (): TypeElement[] => [
  ...Object.values(customTypes),
  ...innerCustomTypes,
  ...Object.values(enums),
]
