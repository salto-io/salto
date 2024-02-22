/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { StandardType } from '../autogen/types'
import { ServiceUrlSetter } from './types'

const TYPE_TO_URL: Record<StandardType | 'file' | 'folder', string | undefined> = {
  file: 'app/common/media/mediaitemfolders.nl',
  folder: 'app/common/media/mediaitemfolders.nl',
  addressForm: 'app/common/custom/custaddressentryforms.nl',
  advancedpdftemplate: 'app/common/custom/pdftemplates.nl',
  bundleinstallationscript:
    'app/common/scripting/scriptlist.nl?scripttype=BUNDLEINSTALLATION&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  clientscript:
    'app/common/scripting/scriptlist.nl?scripttype=CLIENT&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  mapreducescript:
    'app/common/scripting/scriptlist.nl?scripttype=MAPREDUCE&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  massupdatescript:
    'app/common/scripting/scriptlist.nl?scripttype=MASSUPDATE&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  scheduledscript:
    'app/common/scripting/scriptlist.nl?scripttype=SCHEDULED&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  sdfinstallationscript:
    'app/common/scripting/scriptlist.nl?scripttype=SDFINSTALLATION&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  usereventscript:
    'app/common/scripting/scriptlist.nl?scripttype=USEREVENT&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  workflowactionscript:
    'app/common/scripting/scriptlist.nl?scripttype=ACTION&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  portlet:
    'app/common/scripting/scriptlist.nl?scripttype=PORTLET&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  restlet:
    'app/common/scripting/scriptlist.nl?scripttype=RESTLET&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  suitelet:
    'app/common/scripting/scriptlist.nl?scripttype=SCRIPTLET&apiversion=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  center: 'app/common/custom/custcenters.nl',
  centercategory: 'app/common/custom/custcategories.nl',
  centerlink: 'app/common/custom/custtasks.nl',
  centertab: 'app/common/custom/custsections.nl',
  crmcustomfield: 'app/common/custom/eventcustfields.nl',
  customlist: 'app/common/custom/custlists.nl',
  customrecordtype: 'app/common/custom/custrecords.nl',
  customsegment: 'app/common/custom/segments/segments.nl',
  customtransactiontype: 'app/common/custom/customtransactions.nl',
  emailcaptureplugin:
    'app/common/scripting/pluginlist.nl?scripttype=EMAILCAPTURE&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  customglplugin:
    'app/common/scripting/pluginlist.nl?scripttype=CUSTOMGLLINES&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  datasetbuilderplugin:
    'app/common/scripting/pluginlist.nl?scripttype=DATASETBUILDER&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  bankstatementparserplugin:
    'app/common/scripting/pluginlist.nl?scripttype=BANKSTATEMENTPARSER&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  ficonnectivityplugin:
    'app/common/scripting/pluginlist.nl?scripttype=FICONNECTIVITY&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  fiparserplugin:
    'app/common/scripting/pluginlist.nl?scripttype=FIPARSER&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  workbookbuilderplugin:
    'app/common/scripting/pluginlist.nl?scripttype=WORKBOOKBUILDER&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  pluginimplementation:
    'app/common/scripting/pluginlist.nl?scripttype=&scriptfile=&bundlefilter=BLANK&sortcol=name&sortdir=ASC&csv=HTML&OfficeXML=F&pdf=&size=50&showall=F',
  emailtemplate: 'app/crm/common/merge/emailtemplates.nl',
  entitycustomfield: 'app/common/custom/entitycustfields.nl',
  entryForm: 'app/common/custom/custentryforms.nl',
  itemcustomfield: 'app/common/custom/itemcustfields.nl',
  itemnumbercustomfield: 'app/common/custom/itemnumbercustfields.nl',
  itemoptioncustomfield: 'app/common/custom/itemoptions.nl',
  kpiscorecard: 'app/center/enhanced/kpireports.nl',
  othercustomfield: 'app/common/custom/othercustfields.nl',
  plugintype: 'app/common/scripting/plugintypelist.nl',
  role: 'app/setup/rolelist.nl',
  savedcsvimport: 'app/setup/assistants/nsimport/savedimports.nl',
  savedsearch: 'app/common/search/savedsearchlist.nl',
  secret: 'app/common/scripting/secrets/settings.nl',
  sspapplication: 'app/common/scripting/webapplist.nl',
  sublist: 'app/common/custom/customsublists.nl',
  subtab: 'app/common/custom/custfieldtabs.nl',
  transactionForm: 'app/common/custom/custforms.nl',
  transactionbodycustomfield: 'app/common/custom/bodycustfields.nl',
  transactioncolumncustomfield: 'app/common/custom/columncustfields.nl',
  translationcollection: 'app/translations/ui/managetranslations.nl#/collections',
  workflow: 'app/common/workflow/setup/workflowlist.nl',
  financiallayout: '/app/reporting/financiallayouts.nl',
  reportdefinition: '/app/reporting/savedreports.nl',
  cmscontenttype: undefined,
  customrecordactionscript: undefined,
  dataset: undefined,
  integration: undefined,
  promotionsplugin: undefined,
  publisheddashboard: undefined,
  workbook: undefined,
}

const setServiceUrl: ServiceUrlSetter = (elements, client) => {
  elements
    .filter(element => element.annotations[CORE_ANNOTATIONS.SERVICE_URL] === undefined)
    .forEach(element => {
      const url = TYPE_TO_URL[element.elemID.typeName as StandardType]
      if (url !== undefined) {
        element.annotations[CORE_ANNOTATIONS.SERVICE_URL] = new URL(url, client.url).href
      }
    })
}

export default setServiceUrl
