/*
 *  Copyright 2023 Collate.
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
import { AxiosError } from 'axios';
import { toString } from 'lodash';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EntityType } from '../../../enums/entity.enum';
import { Glossary } from '../../../generated/entity/data/glossary';
import {
  EntityStatus,
  GlossaryTerm,
} from '../../../generated/entity/data/glossaryTerm';
import { EntityHistory } from '../../../generated/type/entityHistory';
import {
  getGlossaryTermsVersion,
  getGlossaryTermsVersionsList,
  getGlossaryVersion,
  getGlossaryVersionsList,
} from '../../../rest/glossaryAPI';
import {
  getGlossaryPath,
  getGlossaryTermsVersionsPath,
  getGlossaryVersionsPath,
} from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useRequiredParams } from '../../../utils/useRequiredParams';
import { isDataDictionaryGlossary } from '../../../constants/Glossary.contant';
import Loader from '../../common/Loader/Loader';
import EntityVersionTimeLine from '../../Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';
import GlossaryV1Component from '../GlossaryV1.component';
import { ModifiedGlossary, useGlossaryStore } from '../useGlossary.store';

interface GlossaryVersionProps {
  isGlossary?: boolean;
}

const GlossaryVersion = ({ isGlossary = false }: GlossaryVersionProps) => {
  const navigate = useNavigate();
  const {
    version,
    tab = 'overview',
    id,
  } = useRequiredParams<{ version: string; tab: string; id: string }>();
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );
  const [selectedData, setSelectedData] = useState<Glossary | GlossaryTerm>();
  const [isVersionLoading, setIsVersionLoading] = useState<boolean>(true);
  const { setActiveGlossary } = useGlossaryStore();
  const { t } = useTranslation();
  const loadedIdRef = useRef<string>();

  const isApprovedSnapshot = (p: any): boolean => {
    const status = p?.entityStatus ?? p?.status ?? EntityStatus.Approved;

    return String(status).toLowerCase() === 'approved';
  };

  const fetchVersionsInfo = async (): Promise<EntityHistory | null> => {
    try {
      const res = isGlossary
        ? await getGlossaryVersionsList(id)
        : await getGlossaryTermsVersionsList(id);

      loadedIdRef.current = id;

      if (!isGlossary && res?.versions?.length) {
        const first =
          typeof res.versions[0] === 'string'
            ? JSON.parse(res.versions[0])
            : res.versions[0];

        const isCDEEntity = Boolean(
          isDataDictionaryGlossary(
            first?.fullyQualifiedName,
            typeof first?.glossary === 'string'
              ? first.glossary
              : first?.glossary?.name,
            typeof first?.glossary === 'string'
              ? undefined
              : first?.glossary?.displayName
          ) || first?.extension?.cdeVersion != null
        );

        if (isCDEEntity) {
          const approved = res.versions.filter((v: any) => {
            const p = typeof v === 'string' ? JSON.parse(v) : v;

            return isApprovedSnapshot(p);
          });
          if (approved.length > 0) {
            res.versions = approved;
          }
        }
      }

      setVersionList(res);

      return res;
    } catch (error) {
      showErrorToast(error as AxiosError);

      return null;
    }
  };

  const fetchActiveVersion = async (currentHistory?: EntityHistory) => {
    setIsVersionLoading(true);
    try {
      let targetVersion = version;

      if (!isGlossary) {
        let history = currentHistory ?? versionList;
        if (loadedIdRef.current !== id || !history?.versions?.length) {
          const fetched = await fetchVersionsInfo();
          if (fetched) {
            history = fetched;
          }
        }

        if (history?.versions?.length) {
          const first =
            typeof history.versions[0] === 'string'
              ? JSON.parse(history.versions[0])
              : history.versions[0];

          const isCDEEntity = Boolean(
            isDataDictionaryGlossary(
              first?.fullyQualifiedName,
              typeof first?.glossary === 'string'
                ? first.glossary
                : first?.glossary?.name,
              typeof first?.glossary === 'string'
                ? undefined
                : first?.glossary?.displayName
            ) || first?.extension?.cdeVersion != null
          );

          if (isCDEEntity) {
            const cleanParamVer = version
              .trim()
              .replace(/^(version:?\s*|v)/i, '');
            let matchedSnapshotVersion: string | null = null;
            let matchedCdeVer: string | null = null;

            for (const v of history.versions) {
              const p = typeof v === 'string' ? JSON.parse(v) : v;
              if (!isApprovedSnapshot(p)) {
                continue;
              }
              const raw = String(
                p?.extension?.cdeVersion ?? p?.extension?.phien_ban ?? '1.0'
              ).trim();
              const clean = raw.replace(/^(version:?\s*|v)/i, '') || '1.0';

              if (clean === cleanParamVer || toString(p.version) === version) {
                matchedSnapshotVersion = toString(p.version);
                matchedCdeVer = clean;
                break;
              }
            }

            if (matchedSnapshotVersion) {
              targetVersion = matchedSnapshotVersion;
            } else {
              // Find the first approved snapshot in history
              const firstApproved = history.versions.find((v: any) => {
                const p = typeof v === 'string' ? JSON.parse(v) : v;

                return isApprovedSnapshot(p);
              });

              if (firstApproved) {
                const p =
                  typeof firstApproved === 'string'
                    ? JSON.parse(firstApproved)
                    : firstApproved;
                targetVersion = toString(p.version);
                const raw = String(
                  p?.extension?.cdeVersion ?? p?.extension?.phien_ban ?? '1.0'
                ).trim();
                matchedCdeVer = raw.replace(/^(version:?\s*|v)/i, '') || '1.0';
              } else if (first?.version) {
                targetVersion = toString(first.version);
              }
            }

            if (matchedCdeVer && matchedCdeVer !== cleanParamVer && tab) {
              navigate(getGlossaryTermsVersionsPath(id, matchedCdeVer, tab), {
                replace: true,
              });
            }
          }
        }
      }

      const res = isGlossary
        ? await getGlossaryVersion(id, targetVersion)
        : await getGlossaryTermsVersion(id, targetVersion);

      setSelectedData(res);
      setActiveGlossary(res as ModifiedGlossary);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsVersionLoading(false);
    }
  };

  const onVersionChange = (selectedVersion: string) => {
    const path = isGlossary
      ? getGlossaryVersionsPath(id, selectedVersion)
      : getGlossaryTermsVersionsPath(id, selectedVersion, tab);
    navigate(path);
  };

  const isCDE = useMemo(() => {
    if (isGlossary) {
      return false;
    }
    const term = selectedData as GlossaryTerm;

    return isDataDictionaryGlossary(
      term?.fullyQualifiedName,
      term?.glossary?.name,
      term?.glossary?.displayName
    );
  }, [isGlossary, selectedData]);

  const currentCdeVersion = useMemo(() => {
    if (!isCDE) {
      return undefined;
    }
    const term = selectedData as GlossaryTerm;
    const raw = String(
      term?.extension?.cdeVersion ?? term?.extension?.phien_ban ?? '1.0'
    ).trim();

    return raw.replace(/^(version:?\s*|v)/i, '') || '1.0';
  }, [isCDE, selectedData]);

  const onBackHandler = () => {
    const path = getGlossaryPath(selectedData?.fullyQualifiedName);
    navigate(path);
  };

  useEffect(() => {
    fetchVersionsInfo().then((history) => {
      if (history) {
        fetchActiveVersion(history);
      } else {
        fetchActiveVersion();
      }
    });
  }, [id, version]);

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-version', { entity: t('label.glossary') })}>
      <div className="version-data">
        {/* TODO: Need to implement version component for Glossary */}
        {isVersionLoading ? (
          <Loader />
        ) : (
          <GlossaryV1Component
            isVersionsView
            isGlossaryActive={isGlossary}
            isSummaryPanelOpen={false}
            selectedData={selectedData as Glossary}
            updateGlossary={() => Promise.resolve()}
            onGlossaryDelete={() => Promise.resolve()}
            onGlossaryTermDelete={() => Promise.resolve()}
            onGlossaryTermUpdate={() => Promise.resolve()}
          />
        )}
      </div>
      <EntityVersionTimeLine
        currentCdeVersion={currentCdeVersion}
        currentVersion={toString(version)}
        entityType={EntityType.GLOSSARY}
        isCDE={isCDE}
        versionHandler={onVersionChange}
        versionList={versionList}
        onBack={onBackHandler}
      />
    </PageLayoutV1>
  );
};

export default GlossaryVersion;
