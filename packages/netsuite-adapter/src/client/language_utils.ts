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
import { logger } from '@salto-io/logging'

const log = logger(module)

export const OBJECT_ID = 'objectId'
export const FEATURE_NAME = 'featureName'

export const fetchUnexpectedErrorRegex = new RegExp('(unexpected error|erreur inattendue)')
export const fetchLockedObjectErrorRegex = new RegExp(
  'You cannot download the XML file for this object because it is locked',
)

type SupportedLanguage = 'english' | 'french'

type ErrorDetectors = {
  deployStartMessageRegex: RegExp
  settingsValidationErrorRegex: RegExp
  objectValidationErrorRegexes: RegExp[]
  missingFeatureErrorRegexes: RegExp[]
  deployedObjectRegex: RegExp
  errorObjectRegex: RegExp
  manifestErrorDetailsRegex: RegExp
  configureFeatureFailRegex: RegExp
  otherErrorRegexes: RegExp[]
}

export const multiLanguageErrorDetectors: Record<SupportedLanguage, ErrorDetectors> = {
  english: {
    deployStartMessageRegex: RegExp('^Begin deployment$', 'm'),
    settingsValidationErrorRegex: RegExp('^Validation of account settings failed\\.$', 'm'),
    objectValidationErrorRegexes: [
      RegExp(`^An error occurred during custom object validation\\. \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`, 'gm'),
      RegExp(
        `^An error occured during validation of Custom Objects against the account \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`,
        'gm',
      ),
      RegExp(`^Details: The object (?<${OBJECT_ID}>[a-z0-9_]+) cannot be deployed because it is locked.`, 'gm'),
    ],
    missingFeatureErrorRegexes: [
      RegExp(`Details: You must specify the (?<${FEATURE_NAME}>\\w+)\\(.*?\\) feature in the project manifest`, 'gm'),
      RegExp(
        `Details: When the SuiteCloud project contains a \\w+, the manifest must define the (?<${FEATURE_NAME}>\\w+) feature`,
        'gm',
      ),
      RegExp(
        `Details: The following features must be specified in the manifest to use the .*: (?<${FEATURE_NAME}>\\w+)`,
        'gm',
      ),
    ],
    deployedObjectRegex: RegExp(`^(Create|Update) object -- (?<${OBJECT_ID}>[a-z0-9_]+)`, 'gm'),
    errorObjectRegex: RegExp(`^An unexpected error has occurred\\. \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`, 'gm'),
    manifestErrorDetailsRegex: RegExp(
      `Details: The manifest contains a dependency on (?<${OBJECT_ID}>[a-z0-9_]+(\\.[a-z0-9_]+)*)`,
      'gm',
    ),
    configureFeatureFailRegex: RegExp(
      `Configure feature -- (Enabling|Disabling) of the (?<${FEATURE_NAME}>\\w+)\\(.*?\\) feature has FAILED`,
    ),
    otherErrorRegexes: [
      RegExp('An error occurred during account settings validation.'),
      RegExp('An error occured during validation of Custom Objects against the account'),
      RegExp('An error occurred during manifest validation.'),
    ],
  },
  // NOTE: all non-english letters are replaced with a dot
  french: {
    deployStartMessageRegex: RegExp('^Commencer le d.ploiement$', 'm'),
    settingsValidationErrorRegex: RegExp('^La validation des param.tres du compte a .chou.\\.$', 'm'),
    objectValidationErrorRegexes: [
      RegExp(
        `^Une erreur s'est produite lors de la validation de l'objet personnalis.\\. \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`,
        'gm',
      ),
      RegExp(
        `^An error occured during validation of Custom Objects against the account \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`,
        'gm',
      ),
      RegExp(`^Details: The object (?<${OBJECT_ID}>[a-z0-9_]+) cannot be deployed because it is locked.`, 'gm'),
    ],
    missingFeatureErrorRegexes: [
      RegExp(
        `D.tails: Vous devez sp.cifier la fonctionnalit. (?<${FEATURE_NAME}>\\w+)\\(.*?\\) dans le manifeste du projet`,
        'gm',
      ),
      RegExp(
        `D.tails: When the SuiteCloud project contains a \\w+, the manifest must define the (?<${FEATURE_NAME}>\\w+) feature`,
        'gm',
      ),
      RegExp(
        `D.tails: The following features must be specified in the manifest to use the .*: (?<${FEATURE_NAME}>\\w+)`,
        'gm',
      ),
    ],
    deployedObjectRegex: RegExp(`^(Cr.er un objet|Mettre . jour l'objet) -- (?<${OBJECT_ID}>[a-z0-9_]+)`, 'gm'),
    // TODO: find in french
    errorObjectRegex: RegExp(`^An unexpected error has occurred\\. \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`, 'gm'),
    manifestErrorDetailsRegex: RegExp(
      `D.tails: Le manifeste comporte une d.pendance sur l'objet (?<${OBJECT_ID}>[a-z0-9_]+(\\.[a-z0-9_]+)*)`,
      'gm',
    ),
    configureFeatureFailRegex: RegExp(
      `Configurer la fonction -- (L'activation|La d.sactivation) de la fonction (?<${FEATURE_NAME}>\\w+)\\(.*?\\) a .chou.`,
    ),
    otherErrorRegexes: [
      RegExp('An error occurred during account settings validation.'),
      RegExp('An error occured during validation of Custom Objects against the account'),
      RegExp('An error occurred during manifest validation.'),
    ],
  },
}

const frenchRegexDetector = RegExp('(\\*\\*\\* ERREUR \\*\\*\\*|Commencer le d.ploiement)')

export const detectLanguage = (errorMessage: string): SupportedLanguage => {
  const detectedLanguage: SupportedLanguage = frenchRegexDetector.test(errorMessage) ? 'french' : 'english'

  if (detectedLanguage !== 'english') {
    log.debug('sdf language detected - %s', detectedLanguage)
  }
  return detectedLanguage
}
