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
import { Tag } from '../../../generated/entity/classification/tag';
import { getTags } from '../../../rest/tagAPI';
import { ClassificationOption } from './ClassificationSelect.interface';

const OPTION_PAGE_SIZE = 100;

export const tagsToClassificationOptions = (
  tags: Tag[]
): ClassificationOption[] =>
  tags.map((tag) => ({
    value: tag.fullyQualifiedName as string,
    label: tag.displayName || tag.name,
  }));

/** Loads the tags of one classification as options for `ClassificationSelect`. */
export const useClassificationOptions = (classification: string) => {
  const [options, setOptions] = useState<ClassificationOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    getTags({ parent: classification, limit: OPTION_PAGE_SIZE })
      .then((response) => tagsToClassificationOptions(response.data))
      .catch(() => [] as ClassificationOption[])
      .then((loaded) => {
        if (active) {
          setOptions(loaded);
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [classification]);

  return { options, isLoading };
};
