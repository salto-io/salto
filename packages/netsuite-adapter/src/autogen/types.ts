/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { TypesMap } from '../types/object_types'
import { addressFormType } from './types/custom_types/addressForm'
import { advancedpdftemplateType } from './types/custom_types/advancedpdftemplate'
import { bankstatementparserpluginType } from './types/custom_types/bankstatementparserplugin'
import { bundleinstallationscriptType } from './types/custom_types/bundleinstallationscript'
import { centerType } from './types/custom_types/center'
import { centercategoryType } from './types/custom_types/centercategory'
import { centerlinkType } from './types/custom_types/centerlink'
import { centertabType } from './types/custom_types/centertab'
import { clientscriptType } from './types/custom_types/clientscript'
import { cmscontenttypeType } from './types/custom_types/cmscontenttype'
import { crmcustomfieldType } from './types/custom_types/crmcustomfield'
import { customglpluginType } from './types/custom_types/customglplugin'
import { customlistType } from './types/custom_types/customlist'
import { customrecordactionscriptType } from './types/custom_types/customrecordactionscript'
import { customrecordtypeType } from './types/custom_types/customrecordtype'
import { customsegmentType } from './types/custom_types/customsegment'
import { customtransactiontypeType } from './types/custom_types/customtransactiontype'
import { datasetType } from './types/custom_types/dataset'
import { datasetbuilderpluginType } from './types/custom_types/datasetbuilderplugin'
import { emailcapturepluginType } from './types/custom_types/emailcaptureplugin'
import { emailtemplateType } from './types/custom_types/emailtemplate'
import { entitycustomfieldType } from './types/custom_types/entitycustomfield'
import { entryFormType } from './types/custom_types/entryForm'
import { ficonnectivitypluginType } from './types/custom_types/ficonnectivityplugin'
import { fiparserpluginType } from './types/custom_types/fiparserplugin'
import { integrationType } from './types/custom_types/integration'
import { itemcustomfieldType } from './types/custom_types/itemcustomfield'
import { itemnumbercustomfieldType } from './types/custom_types/itemnumbercustomfield'
import { itemoptioncustomfieldType } from './types/custom_types/itemoptioncustomfield'
import { kpiscorecardType } from './types/custom_types/kpiscorecard'
import { mapreducescriptType } from './types/custom_types/mapreducescript'
import { massupdatescriptType } from './types/custom_types/massupdatescript'
import { othercustomfieldType } from './types/custom_types/othercustomfield'
import { pluginimplementationType } from './types/custom_types/pluginimplementation'
import { plugintypeType } from './types/custom_types/plugintype'
import { portletType } from './types/custom_types/portlet'
import { promotionspluginType } from './types/custom_types/promotionsplugin'
import { publisheddashboardType } from './types/custom_types/publisheddashboard'
import { restletType } from './types/custom_types/restlet'
import { roleType } from './types/custom_types/role'
import { savedcsvimportType } from './types/custom_types/savedcsvimport'
import { savedsearchType } from './types/custom_types/savedsearch'
import { scheduledscriptType } from './types/custom_types/scheduledscript'
import { sdfinstallationscriptType } from './types/custom_types/sdfinstallationscript'
import { secretType } from './types/custom_types/secret'
import { sspapplicationType } from './types/custom_types/sspapplication'
import { sublistType } from './types/custom_types/sublist'
import { subtabType } from './types/custom_types/subtab'
import { suiteletType } from './types/custom_types/suitelet'
import { transactionFormType } from './types/custom_types/transactionForm'
import { transactionbodycustomfieldType } from './types/custom_types/transactionbodycustomfield'
import { transactioncolumncustomfieldType } from './types/custom_types/transactioncolumncustomfield'
import { translationcollectionType } from './types/custom_types/translationcollection'
import { usereventscriptType } from './types/custom_types/usereventscript'
import { workbookType } from './types/custom_types/workbook'
import { workbookbuilderpluginType } from './types/custom_types/workbookbuilderplugin'
import { workflowType } from './types/custom_types/workflow'
import { workflowactionscriptType } from './types/custom_types/workflowactionscript'

const customTypesNamesList = [
  'addressForm',
  'advancedpdftemplate',
  'bankstatementparserplugin',
  'bundleinstallationscript',
  'center',
  'centercategory',
  'centerlink',
  'centertab',
  'clientscript',
  'cmscontenttype',
  'crmcustomfield',
  'customglplugin',
  'customlist',
  'customrecordactionscript',
  'customrecordtype',
  'customsegment',
  'customtransactiontype',
  'dataset',
  'datasetbuilderplugin',
  'emailcaptureplugin',
  'emailtemplate',
  'entitycustomfield',
  'entryForm',
  'ficonnectivityplugin',
  'fiparserplugin',
  'integration',
  'itemcustomfield',
  'itemnumbercustomfield',
  'itemoptioncustomfield',
  'kpiscorecard',
  'mapreducescript',
  'massupdatescript',
  'othercustomfield',
  'pluginimplementation',
  'plugintype',
  'portlet',
  'promotionsplugin',
  'publisheddashboard',
  'restlet',
  'role',
  'savedcsvimport',
  'savedsearch',
  'scheduledscript',
  'sdfinstallationscript',
  'secret',
  'sspapplication',
  'sublist',
  'subtab',
  'suitelet',
  'transactionForm',
  'transactionbodycustomfield',
  'transactioncolumncustomfield',
  'translationcollection',
  'usereventscript',
  'workbook',
  'workbookbuilderplugin',
  'workflow',
  'workflowactionscript',
] as const

export type CustomType = typeof customTypesNamesList[number]

const customTypesNamesSet: ReadonlySet<CustomType> = new Set(customTypesNamesList)
export const isCustomTypeName = (name: string): name is CustomType =>
  customTypesNamesSet.has(name as CustomType)

export const getCustomTypesNames = (): CustomType[] =>
  Array.from(customTypesNamesList)

/**
* generated using types_generator.py as Netsuite don't expose a metadata API for them.
*/
export const getCustomTypes = (): TypesMap<CustomType> => {
  const addressForm = addressFormType()
  const advancedpdftemplate = advancedpdftemplateType()
  const bankstatementparserplugin = bankstatementparserpluginType()
  const bundleinstallationscript = bundleinstallationscriptType()
  const center = centerType()
  const centercategory = centercategoryType()
  const centerlink = centerlinkType()
  const centertab = centertabType()
  const clientscript = clientscriptType()
  const cmscontenttype = cmscontenttypeType()
  const crmcustomfield = crmcustomfieldType()
  const customglplugin = customglpluginType()
  const customlist = customlistType()
  const customrecordactionscript = customrecordactionscriptType()
  const customrecordtype = customrecordtypeType()
  const customsegment = customsegmentType()
  const customtransactiontype = customtransactiontypeType()
  const dataset = datasetType()
  const datasetbuilderplugin = datasetbuilderpluginType()
  const emailcaptureplugin = emailcapturepluginType()
  const emailtemplate = emailtemplateType()
  const entitycustomfield = entitycustomfieldType()
  const entryForm = entryFormType()
  const ficonnectivityplugin = ficonnectivitypluginType()
  const fiparserplugin = fiparserpluginType()
  const integration = integrationType()
  const itemcustomfield = itemcustomfieldType()
  const itemnumbercustomfield = itemnumbercustomfieldType()
  const itemoptioncustomfield = itemoptioncustomfieldType()
  const kpiscorecard = kpiscorecardType()
  const mapreducescript = mapreducescriptType()
  const massupdatescript = massupdatescriptType()
  const othercustomfield = othercustomfieldType()
  const pluginimplementation = pluginimplementationType()
  const plugintype = plugintypeType()
  const portlet = portletType()
  const promotionsplugin = promotionspluginType()
  const publisheddashboard = publisheddashboardType()
  const restlet = restletType()
  const role = roleType()
  const savedcsvimport = savedcsvimportType()
  const savedsearch = savedsearchType()
  const scheduledscript = scheduledscriptType()
  const sdfinstallationscript = sdfinstallationscriptType()
  const secret = secretType()
  const sspapplication = sspapplicationType()
  const sublist = sublistType()
  const subtab = subtabType()
  const suitelet = suiteletType()
  const transactionForm = transactionFormType()
  const transactionbodycustomfield = transactionbodycustomfieldType()
  const transactioncolumncustomfield = transactioncolumncustomfieldType()
  const translationcollection = translationcollectionType()
  const usereventscript = usereventscriptType()
  const workbook = workbookType()
  const workbookbuilderplugin = workbookbuilderpluginType()
  const workflow = workflowType()
  const workflowactionscript = workflowactionscriptType()

  return {
    addressForm: {
      type: addressForm.type,
      innerTypes: addressForm.innerTypes,
    },
    advancedpdftemplate: {
      type: advancedpdftemplate.type,
      innerTypes: advancedpdftemplate.innerTypes,
    },
    bankstatementparserplugin: {
      type: bankstatementparserplugin.type,
      innerTypes: bankstatementparserplugin.innerTypes,
    },
    bundleinstallationscript: {
      type: bundleinstallationscript.type,
      innerTypes: bundleinstallationscript.innerTypes,
    },
    center: {
      type: center.type,
      innerTypes: center.innerTypes,
    },
    centercategory: {
      type: centercategory.type,
      innerTypes: centercategory.innerTypes,
    },
    centerlink: {
      type: centerlink.type,
      innerTypes: centerlink.innerTypes,
    },
    centertab: {
      type: centertab.type,
      innerTypes: centertab.innerTypes,
    },
    clientscript: {
      type: clientscript.type,
      innerTypes: clientscript.innerTypes,
    },
    cmscontenttype: {
      type: cmscontenttype.type,
      innerTypes: cmscontenttype.innerTypes,
    },
    crmcustomfield: {
      type: crmcustomfield.type,
      innerTypes: crmcustomfield.innerTypes,
    },
    customglplugin: {
      type: customglplugin.type,
      innerTypes: customglplugin.innerTypes,
    },
    customlist: {
      type: customlist.type,
      innerTypes: customlist.innerTypes,
    },
    customrecordactionscript: {
      type: customrecordactionscript.type,
      innerTypes: customrecordactionscript.innerTypes,
    },
    customrecordtype: {
      type: customrecordtype.type,
      innerTypes: customrecordtype.innerTypes,
    },
    customsegment: {
      type: customsegment.type,
      innerTypes: customsegment.innerTypes,
    },
    customtransactiontype: {
      type: customtransactiontype.type,
      innerTypes: customtransactiontype.innerTypes,
    },
    dataset: {
      type: dataset.type,
      innerTypes: dataset.innerTypes,
    },
    datasetbuilderplugin: {
      type: datasetbuilderplugin.type,
      innerTypes: datasetbuilderplugin.innerTypes,
    },
    emailcaptureplugin: {
      type: emailcaptureplugin.type,
      innerTypes: emailcaptureplugin.innerTypes,
    },
    emailtemplate: {
      type: emailtemplate.type,
      innerTypes: emailtemplate.innerTypes,
    },
    entitycustomfield: {
      type: entitycustomfield.type,
      innerTypes: entitycustomfield.innerTypes,
    },
    entryForm: {
      type: entryForm.type,
      innerTypes: entryForm.innerTypes,
    },
    ficonnectivityplugin: {
      type: ficonnectivityplugin.type,
      innerTypes: ficonnectivityplugin.innerTypes,
    },
    fiparserplugin: {
      type: fiparserplugin.type,
      innerTypes: fiparserplugin.innerTypes,
    },
    integration: {
      type: integration.type,
      innerTypes: integration.innerTypes,
    },
    itemcustomfield: {
      type: itemcustomfield.type,
      innerTypes: itemcustomfield.innerTypes,
    },
    itemnumbercustomfield: {
      type: itemnumbercustomfield.type,
      innerTypes: itemnumbercustomfield.innerTypes,
    },
    itemoptioncustomfield: {
      type: itemoptioncustomfield.type,
      innerTypes: itemoptioncustomfield.innerTypes,
    },
    kpiscorecard: {
      type: kpiscorecard.type,
      innerTypes: kpiscorecard.innerTypes,
    },
    mapreducescript: {
      type: mapreducescript.type,
      innerTypes: mapreducescript.innerTypes,
    },
    massupdatescript: {
      type: massupdatescript.type,
      innerTypes: massupdatescript.innerTypes,
    },
    othercustomfield: {
      type: othercustomfield.type,
      innerTypes: othercustomfield.innerTypes,
    },
    pluginimplementation: {
      type: pluginimplementation.type,
      innerTypes: pluginimplementation.innerTypes,
    },
    plugintype: {
      type: plugintype.type,
      innerTypes: plugintype.innerTypes,
    },
    portlet: {
      type: portlet.type,
      innerTypes: portlet.innerTypes,
    },
    promotionsplugin: {
      type: promotionsplugin.type,
      innerTypes: promotionsplugin.innerTypes,
    },
    publisheddashboard: {
      type: publisheddashboard.type,
      innerTypes: publisheddashboard.innerTypes,
    },
    restlet: {
      type: restlet.type,
      innerTypes: restlet.innerTypes,
    },
    role: {
      type: role.type,
      innerTypes: role.innerTypes,
    },
    savedcsvimport: {
      type: savedcsvimport.type,
      innerTypes: savedcsvimport.innerTypes,
    },
    savedsearch: {
      type: savedsearch.type,
      innerTypes: savedsearch.innerTypes,
    },
    scheduledscript: {
      type: scheduledscript.type,
      innerTypes: scheduledscript.innerTypes,
    },
    sdfinstallationscript: {
      type: sdfinstallationscript.type,
      innerTypes: sdfinstallationscript.innerTypes,
    },
    secret: {
      type: secret.type,
      innerTypes: secret.innerTypes,
    },
    sspapplication: {
      type: sspapplication.type,
      innerTypes: sspapplication.innerTypes,
    },
    sublist: {
      type: sublist.type,
      innerTypes: sublist.innerTypes,
    },
    subtab: {
      type: subtab.type,
      innerTypes: subtab.innerTypes,
    },
    suitelet: {
      type: suitelet.type,
      innerTypes: suitelet.innerTypes,
    },
    transactionForm: {
      type: transactionForm.type,
      innerTypes: transactionForm.innerTypes,
    },
    transactionbodycustomfield: {
      type: transactionbodycustomfield.type,
      innerTypes: transactionbodycustomfield.innerTypes,
    },
    transactioncolumncustomfield: {
      type: transactioncolumncustomfield.type,
      innerTypes: transactioncolumncustomfield.innerTypes,
    },
    translationcollection: {
      type: translationcollection.type,
      innerTypes: translationcollection.innerTypes,
    },
    usereventscript: {
      type: usereventscript.type,
      innerTypes: usereventscript.innerTypes,
    },
    workbook: {
      type: workbook.type,
      innerTypes: workbook.innerTypes,
    },
    workbookbuilderplugin: {
      type: workbookbuilderplugin.type,
      innerTypes: workbookbuilderplugin.innerTypes,
    },
    workflow: {
      type: workflow.type,
      innerTypes: workflow.innerTypes,
    },
    workflowactionscript: {
      type: workflowactionscript.type,
      innerTypes: workflowactionscript.innerTypes,
    },
  }
}
