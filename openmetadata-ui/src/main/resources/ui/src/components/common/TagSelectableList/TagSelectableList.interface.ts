/*
 *  Copyright 2025 Collate.
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
import { PopoverProps } from 'antd';
import { TagLabel } from '../../../generated/type/tagLabel';

export interface TagSelectableListProps {
  classificationFilter?: string;
  onCancel: () => void;
  hasPermission: boolean;
  searchPlaceholder?: string;
  /** Several tags can be ticked unless set to false; a single-select list updates as soon as a tag is picked. */
  multiSelect?: boolean;
  selectedTags?: TagLabel[];
  onUpdate: (tags: TagLabel[]) => Promise<void>;
  children?: React.ReactNode;
  popoverProps?: Partial<PopoverProps>;
}
