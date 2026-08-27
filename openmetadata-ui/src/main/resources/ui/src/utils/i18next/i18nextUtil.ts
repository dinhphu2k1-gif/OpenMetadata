/*
 *  Copyright 2022 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import i18next, { InitOptions } from 'i18next';
import { map, upperCase } from 'lodash';
import enUS from '../../locale/languages/en-us.json';
import { APPLICATION_BRAND_NAME, rebrandLocaleResources } from '../BrandUtils';
import { SupportedLocales } from './LocalUtil.interface';

export const languageSelectOptions = map(SupportedLocales, (value, key) => ({
  label: `${key} - ${upperCase(value.split('-')[0])}`,
  key: value,
}));

// Returns i18next options
export const getInitOptions = (): InitOptions => {
  return {
    supportedLngs: Object.values(SupportedLocales),
    resources: {
      'en-US': { translation: rebrandLocaleResources(enUS) },
    },
    fallbackLng: ['en-US'],
    detection: {
      order: ['querystring', 'cookie', 'navigator'],
      caches: ['cookie'], // cache user language on
    },
    interpolation: {
      escapeValue: false,
      defaultVariables: { brandName: APPLICATION_BRAND_NAME },
    },
    missingKeyHandler: (_lngs, _ns, key) =>
      // eslint-disable-next-line no-console
      console.error(`i18next: key not found "${key}"`),
    saveMissing: true,
  };
};

// Returns the current locale to use in cronstrue
export const getCurrentLocaleForConstrue = () => {
  return i18next.resolvedLanguage?.split('-')[0] ?? 'en';
};

// Map common language codes to supported locales
export const languageMap: Record<string, SupportedLocales> = {
  en: SupportedLocales.English,
  vi: SupportedLocales['Tiếng Việt'],
};

