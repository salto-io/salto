/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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

export type ErrorDetectors = {
  deployStartMessageRegex: RegExp
  settingsValidationErrorRegex: RegExp
  objectValidationErrorRegexes: RegExp[]
  missingFeatureInManifestErrorRegexes: RegExp[]
  missingFeatureInAccountErrorRegex: RegExp
  deployedObjectRegex: RegExp
  errorObjectRegex: RegExp
  manifestErrorDetailsRegex: RegExp
  configureFeatureFailRegex: RegExp
  otherErrorRegexes: RegExp[]
  deployWarningTitle: RegExp
  deployWarningDetailsLine: RegExp
  deployWarningDetailsToExtract: RegExp[]
  deployWarningForCustomField: RegExp
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
    missingFeatureInManifestErrorRegexes: [
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
    missingFeatureInAccountErrorRegex: RegExp(
      `Details: To install this SuiteCloud project, the (?<${FEATURE_NAME}>\\w+\\(.*?\\)) feature must be enabled in the account.`,
      'gm',
    ),
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
    deployWarningTitle: RegExp(
      `WARNING -- One or more potential issues were found during custom object validation\\. \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`,
      'gm',
    ),
    deployWarningDetailsLine: RegExp('^Details:'),
    deployWarningDetailsToExtract: [
      RegExp('The \\w+ field is not supported .* and will be ignored'),
      RegExp('The \\w+ object field is invalid or not supported and will be ignored'),
    ],
    deployWarningForCustomField: RegExp(`(?<${OBJECT_ID}>[a-z0-9_]+) \\(customrecordcustomfield\\)`, 'gm'),
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
    missingFeatureInManifestErrorRegexes: [
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
    // TODO: find in french
    missingFeatureInAccountErrorRegex: RegExp(
      `Details: To install this SuiteCloud project, the (?<${FEATURE_NAME}>\\w+\\(.*?\\)) feature must be enabled in the account.`,
      'gm',
    ),
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
    deployWarningTitle: RegExp(
      `WARNING -- Un ou plusieurs probl.mes potentiels ont .t. d.tect.s lors de la validation d'un objet personnalis.\\. \\((?<${OBJECT_ID}>[a-z0-9_]+)\\)`,
      'gm',
    ),
    deployWarningDetailsLine: RegExp('^D.tails:'),
    deployWarningDetailsToExtract: [
      RegExp("Le champ \\w+ n'est pas pris en charge .* et sera ignor."),
      RegExp("L'objet \\w+ n'est pas valide ou n'est pas pris en charge et sera ignor."),
    ],
    deployWarningForCustomField: RegExp(`(?<${OBJECT_ID}>[a-z0-9_]+) \\(customrecordcustomfield\\)`, 'gm'),
  },
}

const frenchRegexDetector = RegExp('(\\*\\*\\* ERREUR \\*\\*\\*|Commencer le d.ploiement|Un ou plusieurs probl.mes)')

export const detectLanguage = (errorMessage: string): SupportedLanguage => {
  const detectedLanguage: SupportedLanguage = frenchRegexDetector.test(errorMessage) ? 'french' : 'english'

  if (detectedLanguage !== 'english') {
    log.debug('sdf language detected - %s', detectedLanguage)
  }
  return detectedLanguage
}
