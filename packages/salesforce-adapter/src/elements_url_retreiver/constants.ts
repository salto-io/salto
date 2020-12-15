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
export const GENERAL_URLS_MAP: Record<string, string> = {
  PermissionSet: 'lightning/setup/PermSets/home',
  PermissionSetGroup: 'lightning/setup/PermSetGroups/home',
  ApexClass: 'lightning/setup/ApexClasses/home',
  Flow: 'lightning/setup/Flows/home',
  Profile: 'lightning/setup/EnhancedProfiles/home',
  CustomMetadata: 'lightning/setup/CustomMetadata/home',
  CustomPermission: 'lightning/setup/CustomPermissions/home',
  ApexComponent: 'lightning/setup/ApexComponents/home',
  ApexPage: 'lightning/setup/ApexPages/home',
  EmailTemplate: 'lightning/setup/CommunicationTemplatesEmail/home',
  ReportType: 'lightning/setup/CustomReportTypes/home',
  AnalyticSnapshot: 'lightning/setup/AnalyticSnapshots/home',
  ApexTrigger: 'lightning/setup/ApexTriggers/home',
  Queue: 'lightning/setup/Queues/home',
  LightningComponentBundle: 'lightning/setup/LightningComponentBundles/home',
  Report: 'lightning/o/Report/home',
  Dashboard: 'lightning/o/Dashboard/home',
}

export const SETTINGS_URLS_MAP: Record<string, string> = {
  BusinessHoursSettings: 'lightning/setup/BusinessHours/home',
  LanguageSettings: 'lightning/setup/LanguageSettings/home',
  MyDomainSettings: 'lightning/setup/OrgDomain/home',
  ApexSettings: 'lightning/setup/ApexSettings/home',
}
