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

/**
 * The Portal is this same UI built with VITE_APP_MODE=portal and served by the server in Portal
 * mode, for every role except Admin. Login, permissions, screens and the menu of the user's persona
 * are those of OpenMetadata. The Portal hides the system settings, and pipelines are deployed by
 * the OpenMetadata server, so their log and stop actions are not available.
 */
export const IS_PORTAL_MODE = import.meta.env.VITE_APP_MODE === 'portal';
