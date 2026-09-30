/*
 *  Copyright 2026 Collate.
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
import { useEffect, useState } from 'react';
import { TECHNICAL_CLASSIFICATIONS } from '../constants/TechnicalDictionary.constants';
import { EntityReference } from '../generated/entity/data/glossaryTerm';
import { Tag } from '../generated/entity/classification/tag';
import { ServiceCategory } from '../enums/service.enum';
import { getServices } from '../rest/serviceAPI';
import { getTags } from '../rest/tagAPI';
import { getTeams } from '../rest/teamsAPI';

const OPTION_PAGE_SIZE = 100;

export interface TechnicalDictionaryOptions {
  elementTypes: Tag[];
  generationTypes: Tag[];
  creationMethods: Tag[];
  timeliness: Tag[];
  teams: EntityReference[];
  services: string[];
  isLoading: boolean;
}

const EMPTY_OPTIONS: TechnicalDictionaryOptions = {
  elementTypes: [],
  generationTypes: [],
  creationMethods: [],
  timeliness: [],
  teams: [],
  services: [],
  isLoading: true,
};

const loadTags = (classification: string) =>
  getTags({ parent: classification, limit: OPTION_PAGE_SIZE })
    .then((response) => response.data)
    .catch(() => [] as Tag[]);

/** Loads the classification tags, Teams and database services used by filters and the record modal. */
export const useTechnicalDictionaryOptions = (): TechnicalDictionaryOptions => {
  const [options, setOptions] = useState(EMPTY_OPTIONS);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadTags(TECHNICAL_CLASSIFICATIONS.ELEMENT_TYPE),
      loadTags(TECHNICAL_CLASSIFICATIONS.GENERATION_TYPE),
      loadTags(TECHNICAL_CLASSIFICATIONS.CREATION_METHOD),
      loadTags(TECHNICAL_CLASSIFICATIONS.TIMELINESS),
      getTeams()
        .then((response) =>
          response.data.map(
            (team) =>
              ({
                id: team.id,
                type: 'team',
                name: team.name,
                displayName: team.displayName,
                fullyQualifiedName: team.fullyQualifiedName,
              } as EntityReference)
          )
        )
        .catch(() => [] as EntityReference[]),
      getServices({
        serviceName: ServiceCategory.DATABASE_SERVICES,
        limit: OPTION_PAGE_SIZE,
      })
        .then((response) => response.data.map((service) => service.name))
        .catch(() => [] as string[]),
    ]).then(
      ([
        elementTypes,
        generationTypes,
        creationMethods,
        timeliness,
        teams,
        services,
      ]) => {
        if (active) {
          setOptions({
            elementTypes,
            generationTypes,
            creationMethods,
            timeliness,
            teams,
            services,
            isLoading: false,
          });
        }
      }
    );

    return () => {
      active = false;
    };
  }, []);

  return options;
};
